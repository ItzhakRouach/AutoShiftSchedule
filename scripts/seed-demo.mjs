// Demo seed: creates a manager account + a fully-populated workplace so the app
// can be explored immediately. Idempotent — deletes the prior demo manager
// (cascades the org) and recreates everything.
// Run: node scripts/seed-demo.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const db = createClient(URL_, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const DEMO_EMAIL = 'manager@demo.com'
const DEMO_PASSWORD = 'Demo123456'

const ROLES = [
  { name: 'אחמ״ש', color: '#E0902A' },
  { name: 'מוקדן', color: '#3D6BF5' },
  { name: 'מאבטח', color: '#13A98E' },
]
const SHIFTS = [
  { key: 'morning', name: 'בוקר', start_hour: 7, hours: 8, color: '#F2A93B', is_fallback: false, sort: 0 },
  { key: 'noon', name: 'צהריים', start_hour: 15, hours: 8, color: '#EB6A4E', is_fallback: false, sort: 1 },
  { key: 'night', name: 'לילה', start_hour: 23, hours: 8, color: '#5B61D6', is_fallback: false, sort: 2 },
  { key: 'm12_day', name: 'יום 12ש׳', start_hour: 7, hours: 12, color: '#F2A93B', is_fallback: true, sort: 3 },
  { key: 'm12_night', name: 'לילה 12ש׳', start_hour: 19, hours: 12, color: '#5B61D6', is_fallback: true, sort: 4 },
  { key: 'm12_3to15', name: '03–15', start_hour: 3, hours: 12, color: '#EB6A4E', is_fallback: true, sort: 5 },
  { key: 'm12_15to3', name: '15–03', start_hour: 15, hours: 12, color: '#5B61D6', is_fallback: true, sort: 6 },
]
const REQS = {
  morning: { 'אחמ״ש': 1, 'מוקדן': 1, 'מאבטח': 1 },
  noon:    { 'אחמ״ש': 1, 'מוקדן': 1, 'מאבטח': 1 },
  night:   { 'אחמ״ש': 1, 'מוקדן': 1, 'מאבטח': 1 },
}

// 16 employees — all with distinct hex colors.
// ≥3 shabbat observers, ≥2 holiday observers, exactly 2 mustAccept.
const EMP = [
  // mustAccept #1: strong morning preference — mgr should always see it honored
  { name: 'עומר דהן',    roles: ['אחמ״ש', 'מאבטח'], type: 'full', min: 5, mustAccept: true,  color: '#3D6BF5' },
  // mustAccept #2: strong night preference
  { name: 'שירה כהן',   roles: ['אחמ״ש', 'מוקדן', 'מאבטח'], type: 'full', min: 5, mustAccept: true, color: '#13A98E' },

  // shabbat+chag observers (3) — shabbat implies holidays per the combined toggle
  { name: 'דני לוי',    roles: ['מוקדן', 'מאבטח'], type: 'full', min: 5, shabbat: true, holidays: true, color: '#E0902A' },
  { name: 'מאור גבאי',  roles: ['אחמ״ש', 'מאבטח'], type: 'full', min: 5, shabbat: true, holidays: true, color: '#EB6A4E' },
  { name: 'טל אבני',    roles: ['אחמ״ש', 'מוקדן', 'מאבטח'], type: 'full', min: 5, shabbat: true, holidays: true, color: '#5B61D6' },

  // holiday observers (2) — holiday-only employees also have shabbat=true for consistency
  { name: 'אבי פרץ',    roles: ['אחמ״ש', 'מאבטח'], type: 'full', min: 5, shabbat: true, holidays: true, color: '#B05AB5' },
  { name: 'ליאת אזולאי', roles: ['מוקדן', 'מאבטח'], type: 'part', min: 2, max: 4, shabbat: true, holidays: true, color: '#2E9E6B' },

  // rest of the roster
  { name: 'יוסי מזרחי', roles: ['מאבטח'], type: 'full', min: 5, weekdayNights: true, color: '#D94F6A' },
  { name: 'נועה ברק',   roles: ['מוקדן', 'מאבטח'], type: 'part', min: 2, max: 4, color: '#C0598F' },
  { name: 'רותם שמש',   roles: ['מוקדן', 'מאבטח'], type: 'student', max: 3, color: '#7A8B3D' },
  { name: 'רון שלו',    roles: ['מוקדן', 'מאבטח'], type: 'full', min: 5, color: '#2BB3C0' },
  { name: 'גיא נחמיאס', roles: ['מאבטח'], type: 'full', min: 5, color: '#D08A2E' },
  { name: 'אורי כץ',   roles: ['אחמ״ש', 'מאבטח'], type: 'full', min: 5, color: '#6A4EC0' },
  { name: 'מיכל רז',   roles: ['מוקדן', 'מאבטח'], type: 'part', min: 3, max: 5, color: '#4EB5A0' },
  { name: 'עידן בר',    roles: ['אחמ״ש', 'מוקדן', 'מאבטח'], type: 'full', min: 5, color: '#C0934E' },
  { name: 'נטע גל',    roles: ['מוקדן', 'מאבטח'], type: 'full', min: 5, color: '#8B3D6A' },
]

function upcomingSundayISO() {
  const d = new Date()
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + ((7 - day) % 7))
  return d.toISOString().slice(0, 10)
}

/** The Sunday one week BEFORE the given Sunday ISO date. */
function priorSundayISO(sundayISO) {
  const d = new Date(sundayISO + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 7)
  return d.toISOString().slice(0, 10)
}

// Optional: limit the number of seeded employees via CLI arg, e.g.
//   node scripts/seed-demo.mjs 9   → seeds the first 9 employees
const EMP_COUNT = Number.parseInt(process.argv[2] ?? '', 10)
const EMPLOYEES = Number.isFinite(EMP_COUNT) && EMP_COUNT > 0 ? EMP.slice(0, EMP_COUNT) : EMP

/**
 * Build realistic/varied shift requests for one employee.
 *
 * Rules (deterministic by employee index i):
 *  - 1 full day off (day = (i * 3 + 2) % 7)
 *  - 2 days with 2 preferred shifts (days = (i+1)%7 and (i+4)%7)
 *  - Remaining 4 days: 1 preferred shift each, cycling through morning/noon/night
 *  - mustAccept employees get their strong preference on 5+ days (morning or night)
 */
function buildRequests(empId, empDef, i, periodId, shiftId) {
  const OFF_DAY = (i * 3 + 2) % 7
  const DOUBLE_A = (i + 1) % 7
  const DOUBLE_B = (i + 4) % 7
  const cycle = ['morning', 'noon', 'night']
  const reqs = []

  // mustAccept employees have a very strong single preference
  const isMustAccept = !!empDef.mustAccept
  const mustPrefer = i === 0 ? 'morning' : 'night' // emp[0]=עומר→morning, emp[1]=שירה→night

  for (let d = 0; d < 7; d++) {
    if (d === OFF_DAY) {
      reqs.push({ period_id: periodId, employee_id: empId, day_of_week: d, is_off: true, preferred_shift_ids: [] })
      continue
    }

    let preferred
    if (isMustAccept) {
      // Always 1 strong preference so the engine honors it visibly
      preferred = [shiftId[mustPrefer]]
    } else if (d === DOUBLE_A || d === DOUBLE_B) {
      // 2 preferred shifts on these days
      const sk1 = cycle[d % 3]
      const sk2 = cycle[(d + 1) % 3]
      preferred = [shiftId[sk1], shiftId[sk2]]
    } else {
      // 1 preferred shift, cycling deterministically
      preferred = [shiftId[cycle[(i + d) % 3]]]
    }

    reqs.push({ period_id: periodId, employee_id: empId, day_of_week: d, is_off: false, preferred_shift_ids: preferred })
  }
  return reqs
}

async function main() {
  // 1. cleanup prior demo manager (cascades org → everything)
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
  const prior = list?.users?.find((u) => u.email === DEMO_EMAIL)
  if (prior) { await db.auth.admin.deleteUser(prior.id); console.log('removed prior demo user') }

  // 2. manager auth user
  const { data: created, error: uErr } = await db.auth.admin.createUser({
    email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true,
  })
  if (uErr) throw uErr
  const userId = created.user.id

  // 3. org + workplace
  const { data: org } = await db.from('organizations').insert({ owner_user_id: userId, name: 'מוקד אבטחה מרכז' }).select('id').single()
  const { data: wp } = await db.from('workplaces').insert({ org_id: org.id, name: 'מוקד ראשי' }).select('id').single()
  const W = wp.id

  // 4. roles + shift_types + settings
  const { data: roles } = await db.from('roles').insert(ROLES.map((r) => ({ ...r, workplace_id: W }))).select('id, name')
  const roleId = Object.fromEntries(roles.map((r) => [r.name, r.id]))
  const { data: shifts } = await db.from('shift_types').insert(SHIFTS.map((s) => ({ ...s, workplace_id: W }))).select('id, key')
  const shiftId = Object.fromEntries(shifts.map((s) => [s.key, s.id]))
  await db.from('workplace_settings').insert({
    workplace_id: W, min_rest_hours: 8, ideal_rest_hours: 16, allow_12h_fallback: true,
    request_deadline_dow: 4, request_deadline_time: '18:00', publish_dow: 5, publish_time: '12:00',
  })

  // 5. requirements (every day of week)
  const reqRows = []
  for (let dow = 0; dow < 7; dow++)
    for (const sk of ['morning', 'noon', 'night'])
      for (const [rn, c] of Object.entries(REQS[sk]))
        reqRows.push({ workplace_id: W, day_of_week: dow, shift_type_id: shiftId[sk], role_id: roleId[rn], count: c })
  await db.from('shift_requirements').insert(reqRows)

  // 6. employees + roles + availability
  const empIds = []
  for (const e of EMPLOYEES) {
    const { data: emp } = await db.from('employees').insert({
      workplace_id: W, name: e.name, color: e.color, status: 'active',
      employment_type: e.type, min_shifts_per_week: e.min ?? 0, max_shifts_per_week: e.max ?? null,
      observes_shabbat: !!e.shabbat, observes_holidays: !!e.holidays, must_accept: !!e.mustAccept,
    }).select('id').single()
    empIds.push({ id: emp.id, ...e })
    await db.from('employee_roles').insert(e.roles.map((rn) => ({ employee_id: emp.id, role_id: roleId[rn] })))
    if (e.weekdayNights) {
      const av = []
      for (let d = 0; d <= 4; d++) av.push({ employee_id: emp.id, day_of_week: d, shift_type_id: shiftId.night })
      for (const sk of ['morning', 'noon']) av.push({ employee_id: emp.id, day_of_week: 5, shift_type_id: shiftId[sk] })
      for (const sk of ['morning', 'noon', 'night']) av.push({ employee_id: emp.id, day_of_week: 6, shift_type_id: shiftId[sk] })
      await db.from('employee_availability').insert(av)
    }
  }

  // 7. upcoming period + varied requests (engine has rich preferences to honor)
  const week = upcomingSundayISO()
  const { data: period } = await db.from('schedule_periods').insert({ workplace_id: W, week_start_date: week, status: 'collecting' }).select('id').single()
  const reqs = []
  empIds.forEach((e, i) => {
    reqs.push(...buildRequests(e.id, e, i, period.id, shiftId))
  })
  await db.from('requests').insert(reqs)

  // 8. PRIOR PUBLISHED period (the week before) — cross-week fairness demo.
  // Deliberately leave 2 named employees BELOW their minimum so the upcoming
  // schedule prioritizes them toward their minimum. Not a full legal roster —
  // just enough assignment rows to create a realistic carry-over deficit.
  const SHORTED = new Set(['אורי כץ', 'גיא נחמיאס']) // both min 5 → seeded only 1–2 shifts
  const priorWeek = priorSundayISO(week)
  const { data: priorPeriod } = await db
    .from('schedule_periods')
    .insert({ workplace_id: W, week_start_date: priorWeek, status: 'published' })
    .select('id').single()
  const priorShifts = ['morning', 'noon', 'night']
  const asg = []
  empIds.forEach((e) => {
    const role = roleId[e.roles[0]]
    // Shorted employees get 1–2 shifts; everyone else gets up to 5 (≥ their min).
    const target = SHORTED.has(e.name) ? (e.name === 'אורי כץ' ? 1 : 2) : 5
    for (let day = 0; day < target; day++) {
      asg.push({
        period_id: priorPeriod.id, employee_id: e.id, day_of_week: day,
        shift_type_id: shiftId[priorShifts[day % 3]], role_id: role, source: 'auto',
      })
    }
  })
  await db.from('assignments').insert(asg)

  console.log('\n✅ Demo seeded.')
  console.log('   Manager login →  email: ' + DEMO_EMAIL + '   password: ' + DEMO_PASSWORD)
  console.log('   Workplace: מוקד ראשי · employees: ' + EMPLOYEES.length + ' · requirements + a week of requests ready.')
  console.log('   mustAccept: עומר (morning) + שירה (night)  |  שומר שבת וחג: דני, מאור, טל, אבי, ליאת')
  console.log('   Prior PUBLISHED week (' + priorWeek + ') left אורי כץ (1) + גיא נחמיאס (2) below min 5 →')
  console.log('   the new schedule prioritizes them toward their minimum (cross-week fairness).')
  console.log('   Log in, open שיבוץ, press "צור סידור אוטומטי", then פרסם — and check the dashboard.')
}
main().catch((e) => { console.error(e); process.exit(1) })
