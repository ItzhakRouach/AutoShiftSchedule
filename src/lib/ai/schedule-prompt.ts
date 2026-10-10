// Prompts for the second-opinion generator.
//
// The system half is the byte-stable domain ruleset plus the generation task,
// so it sits behind a cache breakpoint and repeat runs pay ~10% on input. Only
// the week goes in the user turn.
import type { EngineInput } from '@/lib/scheduling/types'
import { encodeWeek } from './encode-week'
import { DOMAIN_RULESET } from './ruleset'
import type { Violation } from './proposal-types'

const TASK = `TASK: produce a staffing schedule for this week.

Fill every "# NEED day|shift|role|count" row with that many DIFFERENT workers who
hold the role. Never break a HARD RULE — a row that breaks one is discarded, which
leaves the slot empty, so a legal schedule always beats an ambitious one.

Pursue the SOFT GOALS in their stated priority order. In particular:
- Grant as many requested shifts as you can, but do not let one worker's requests
  excuse them from nights. Every worker who can work nights should carry roughly
  their share; if someone works 4+ shifts and has no night while another has 3,
  that is wrong unless their availability bars nights.
- Spread אחמ״ש work evenly across the workers who hold it, and give each אחמ״ש
  holder at least half of their own shifts in that role.
- Respect each worker's min/max shifts.

Use a 12h variant ONLY where three 8h shifts genuinely cannot be staffed. Prefer
the m12_day + m12_night pair. In "twelveHour", list one entry per block, and in
its "roles" give one {shift, role} per base window the variant fills:
m12_day fills M and A; m12_night fills N; m12_3to15 fills N and M; m12_15to3
fills A and N. A 12h counts as ONE shift for that worker and they work nothing
else that day.

Use the short keys exactly as given (e3, R1) and the shift letters M, A, N.
Put a one-paragraph Hebrew rationale in "notes" — what you optimised and what you
had to trade away. Do not put anything else in "notes".`

export function buildGeneratePrompt(input: EngineInput) {
  const { text, maps } = encodeWeek(input)
  return { system: `${DOMAIN_RULESET}\n\n${TASK}`, user: text, maps }
}

const DESCRIBE: Record<Violation['kind'], string> = {
  unknown_employee: 'no such worker key',
  unknown_role: 'no such role key',
  bad_shift: 'not a valid shift letter',
  no_such_requirement: 'no staffing is required for that day/shift/role',
  duplicate_day: 'that worker already works that day (one shift per day)',
  slot_over_capacity: 'that slot was already full',
  role_not_held: 'the worker does not hold that role',
  hard_constraint: 'breaks a hard rule',
  bad_variant: 'not a valid 12h variant',
  twelve_role_not_held: 'the worker does not hold the role for a window the 12h covers',
  twelve_illegal: 'the 12h breaks a hard rule for a window it touches',
  twelve_covers_nothing: 'that 12h filled no required window',
}

/**
 * The repair turn. Violations are reported in the model's OWN key space with the
 * engine's reason, so it can fix precisely what was wrong instead of guessing.
 */
export function buildRepairUser(violations: Violation[], accepted: number): string {
  const lines = violations.slice(0, 60).map((v) => {
    const where = [v.emp, `day ${v.day}`, v.shift, v.role, v.variant].filter(Boolean).join(' ')
    const why = v.reason ? `${DESCRIBE[v.kind]} (${v.reason})` : DESCRIBE[v.kind]
    return `- ${where}: ${why}`
  })
  const more = violations.length > lines.length ? `\n(+${violations.length - lines.length} more)` : ''
  return `${violations.length} of your rows were REJECTED and dropped; ${accepted} were accepted.

${lines.join('\n')}${more}

Send the COMPLETE schedule again, corrected. Keep the rows that were accepted,
replace each rejected row with a legal alternative, and leave a slot empty rather
than filling it illegally.`
}
