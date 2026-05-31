# Employee Weekly Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow employees to submit preferred-shift and day-off requests for the upcoming week, and manage multi-day vacation ranges, via `/me/requests`.

**Architecture:** A pure TDD date-helper + server data context feeds a Server Page that renders a read-only or editable 7-day request grid with Sheet-based day editing; Server Actions perform the mutations (upsert request, add/remove vacation) guarded by Zod validation and period-status checks. All files ≤ 200 lines.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (RLS + RPC), Zod 4, Vitest, Playwright.

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/lib/dates/week.ts` | **CREATE** | `upcomingWeekStartISO(today)` + `formatHebDate(iso)` — pure date helpers |
| `src/lib/dates/week.test.ts` | **CREATE** | TDD unit tests for the two date functions |
| `src/lib/requests/context.ts` | **CREATE** | `getEmployeeRequestsContext(supabase)` — fetch all data needed for /me/requests |
| `src/lib/validation/request.ts` | **CREATE** | Zod schemas: `saveDayRequestSchema`, `addVacationSchema` |
| `src/lib/validation/request.test.ts` | **CREATE** | Unit tests for the two Zod schemas |
| `src/app/(employee)/me/requests/actions.ts` | **CREATE** | Server Actions: `saveDayRequest`, `addVacation`, `removeVacation` |
| `src/app/(employee)/me/requests/page.tsx` | **CREATE** | Server page: fetch context, render layout, delegate to client components |
| `src/app/(employee)/me/requests/RequestsHeader.tsx` | **CREATE** | Week label + progress bar ("X מתוך 7") |
| `src/app/(employee)/me/requests/DayList.tsx` | **CREATE** | Client: 7 day cards; opens Sheet for editing |
| `src/app/(employee)/me/requests/DayEditor.tsx` | **CREATE** | Client: shift-toggle list + day-off toggle inside Sheet |
| `src/app/(employee)/me/requests/VacationSection.tsx` | **CREATE** | Client: list vacations + add-vacation form + delete |
| `src/app/(employee)/me/page.tsx` | **MODIFY** | Add navigation link to /me/requests |
| `src/components/ui/Icon.tsx` | **MODIFY** | Add `info`, `plane`, `sunset`, `checkCircle`, `bell`, `clock`, `calendar` icon paths (needed by new UI) |
| `e2e/requests.spec.ts` | **CREATE** | E2E: full flow manager→invite→employee→/me/requests→save→reload assertions |

---

## Task 1: Add missing icon paths to Icon.tsx

The new components need icons from the design template (`info`, `plane`, `sunset`, `checkCircle`, `bell`, `clock`, `calendar`) that are not yet in `src/components/ui/Icon.tsx`.

**Files:**
- Modify: `src/components/ui/Icon.tsx`

- [ ] **Step 1: Read the current Icon.tsx to see which icons already exist**

Run: `cat src/components/ui/Icon.tsx | grep -o "'[a-z][a-zA-Z]*':" | sort`

Expected output lists: `'arrowLeft':`, `'check':`, `'chevronLeft':`, `'edit':`, `'logout':`, `'minus':`, `'moon':`, `'phone':`, `'plus':`, `'shield':`, `'sun':`, `'users':`, `'x':`

- [ ] **Step 2: Extend the IconName type and add missing paths**

Edit `src/components/ui/Icon.tsx`. Change the `IconName` type:

```typescript
export type IconName =
  | 'users'
  | 'plus'
  | 'check'
  | 'x'
  | 'chevronLeft'
  | 'phone'
  | 'shield'
  | 'sun'
  | 'moon'
  | 'minus'
  | 'arrowLeft'
  | 'edit'
  | 'logout'
  // New icons for requests UI
  | 'info'
  | 'plane'
  | 'sunset'
  | 'checkCircle'
  | 'bell'
  | 'clock'
  | 'calendar'
```

Then inside the `paths` record, add after the `logout` entry:

```typescript
    info: (
      <>
        <circle {...p} cx="12" cy="12" r="9" />
        <path {...p} d="M12 11v5M12 8v.1" />
      </>
    ),
    plane: (
      <path
        {...p}
        d="M21 15.5 3.5 11V8.8l2 .6L8 7.2l-1.5-4 2-1 3.2 3.7 5.3-1.4a1.8 1.8 0 0 1 1 3.4L13 11.8l1 5.7-1.8 1-2-4.3-4 2.4Z"
      />
    ),
    sunset: (
      <path
        {...p}
        d="M12 4v6M9 7l3 3 3-3M3 17h2.5M18.5 17H21M6.5 17a5.5 5.5 0 0 1 11 0M3 21h18"
      />
    ),
    checkCircle: (
      <>
        <circle {...p} cx="12" cy="12" r="9" />
        <path {...p} d="M8 12.2 11 15.2 16.2 9.4" />
      </>
    ),
    bell: (
      <>
        <path {...p} d="M6.5 10a5.5 5.5 0 0 1 11 0c0 5 1.5 6.5 1.5 6.5H5s1.5-1.5 1.5-6.5Z" />
        <path {...p} d="M10 19.5a2 2 0 0 0 4 0" />
      </>
    ),
    clock: (
      <>
        <circle {...p} cx="12" cy="12" r="8.5" />
        <path {...p} d="M12 7v5.2l3.4 2" />
      </>
    ),
    calendar: (
      <>
        <rect {...p} x="3.5" y="5" width="17" height="15" rx="3" />
        <path {...p} d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
      </>
    ),
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
git add src/components/ui/Icon.tsx
git commit -m "feat(ui): add info/plane/sunset/checkCircle/bell/clock/calendar icons"
```

---

## Task 2: Date helper (TDD)

**Files:**
- Create: `src/lib/dates/week.test.ts`
- Create: `src/lib/dates/week.ts`

- [ ] **Step 1: Write the failing test first**

Create `src/lib/dates/week.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { upcomingWeekStartISO, formatHebDate } from './week'

describe('upcomingWeekStartISO', () => {
  it('returns the same Sunday when today IS Sunday', () => {
    // 2026-06-07 is a Sunday
    const result = upcomingWeekStartISO(new Date(2026, 5, 7))
    expect(result).toBe('2026-06-07')
  })

  it('returns the NEXT Sunday when today is a Wednesday', () => {
    // 2026-06-03 is a Wednesday → next Sunday is 2026-06-07
    const result = upcomingWeekStartISO(new Date(2026, 5, 3))
    expect(result).toBe('2026-06-07')
  })

  it('returns the NEXT Sunday when today is Saturday', () => {
    // 2026-06-06 is a Saturday → next Sunday is 2026-06-07
    const result = upcomingWeekStartISO(new Date(2026, 5, 6))
    expect(result).toBe('2026-06-07')
  })

  it('returns the NEXT Sunday when today is Monday', () => {
    // 2026-06-01 is a Monday → next Sunday is 2026-06-07
    const result = upcomingWeekStartISO(new Date(2026, 5, 1))
    expect(result).toBe('2026-06-07')
  })

  it('formats as YYYY-MM-DD with zero-padding', () => {
    // 2026-01-04 is a Sunday
    const result = upcomingWeekStartISO(new Date(2026, 0, 4))
    expect(result).toBe('2026-01-04')
  })
})

describe('formatHebDate', () => {
  it('formats 2026-05-31 as "31.5"', () => {
    expect(formatHebDate('2026-05-31')).toBe('31.5')
  })

  it('formats 2026-01-04 as "4.1"', () => {
    expect(formatHebDate('2026-01-04')).toBe('4.1')
  })

  it('formats 2026-12-25 as "25.12"', () => {
    expect(formatHebDate('2026-12-25')).toBe('25.12')
  })
})
```

- [ ] **Step 2: Run the test to confirm it FAILS**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npx vitest run src/lib/dates/week.test.ts 2>&1`

Expected: FAIL with something like "Cannot find module './week'".

- [ ] **Step 3: Implement the date helpers**

Create `src/lib/dates/week.ts`:

```typescript
/**
 * Returns the ISO date string (YYYY-MM-DD) of the upcoming Sunday.
 * If `today` is already Sunday (getDay() === 0), returns today itself.
 * Pure function — takes `today` as a param for testability.
 */
export function upcomingWeekStartISO(today: Date): string {
  const day = today.getDay() // 0 = Sunday, 6 = Saturday
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  const sunday = new Date(today)
  sunday.setDate(today.getDate() + daysUntilSunday)
  return formatISO(sunday)
}

/** Formats a Date as YYYY-MM-DD (local time, zero-padded). */
function formatISO(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Formats an ISO date string (YYYY-MM-DD) as a short Hebrew date.
 * Examples: "2026-05-31" → "31.5", "2026-01-04" → "4.1"
 */
export function formatHebDate(iso: string): string {
  const [, mm, dd] = iso.split('-')
  return `${Number(dd)}.${Number(mm)}`
}
```

- [ ] **Step 4: Run the tests — all must PASS**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npx vitest run src/lib/dates/week.test.ts 2>&1`

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
git add src/lib/dates/week.ts src/lib/dates/week.test.ts
git commit -m "feat(dates): upcomingWeekStartISO + formatHebDate helpers (TDD)"
```

---

## Task 3: Zod validation schemas (TDD)

**Files:**
- Create: `src/lib/validation/request.ts`
- Create: `src/lib/validation/request.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/validation/request.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { saveDayRequestSchema, addVacationSchema } from './request'

const validUUID = '550e8400-e29b-41d4-a716-446655440000'
const uuid2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

describe('saveDayRequestSchema', () => {
  const base = {
    periodId: validUUID,
    employeeId: validUUID,
    dayOfWeek: 0,
    isOff: false,
    preferredShiftIds: [],
  }

  it('accepts a valid day-off request', () => {
    const result = saveDayRequestSchema.safeParse({ ...base, isOff: true })
    expect(result.success).toBe(true)
  })

  it('accepts a valid preferred-shift request', () => {
    const result = saveDayRequestSchema.safeParse({
      ...base,
      preferredShiftIds: [validUUID, uuid2],
    })
    expect(result.success).toBe(true)
  })

  it('rejects dayOfWeek < 0', () => {
    const result = saveDayRequestSchema.safeParse({ ...base, dayOfWeek: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects dayOfWeek > 6', () => {
    const result = saveDayRequestSchema.safeParse({ ...base, dayOfWeek: 7 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid periodId UUID', () => {
    const result = saveDayRequestSchema.safeParse({ ...base, periodId: 'bad' })
    expect(result.success).toBe(false)
  })

  it('rejects preferredShiftIds with non-UUID entries', () => {
    const result = saveDayRequestSchema.safeParse({ ...base, preferredShiftIds: ['not-a-uuid'] })
    expect(result.success).toBe(false)
  })
})

describe('addVacationSchema', () => {
  it('accepts valid date range', () => {
    const result = addVacationSchema.safeParse({
      employeeId: validUUID,
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
    })
    expect(result.success).toBe(true)
  })

  it('accepts same-day range (dateFrom === dateTo)', () => {
    const result = addVacationSchema.safeParse({
      employeeId: validUUID,
      dateFrom: '2026-06-01',
      dateTo: '2026-06-01',
    })
    expect(result.success).toBe(true)
  })

  it('rejects when dateTo is before dateFrom', () => {
    const result = addVacationSchema.safeParse({
      employeeId: validUUID,
      dateFrom: '2026-06-07',
      dateTo: '2026-06-01',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues[0]
      expect(issue.message).toMatch(/תאריך/)
    }
  })

  it('rejects invalid date format', () => {
    const result = addVacationSchema.safeParse({
      employeeId: validUUID,
      dateFrom: 'not-a-date',
      dateTo: '2026-06-01',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid employeeId UUID', () => {
    const result = addVacationSchema.safeParse({
      employeeId: 'bad',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run to confirm FAIL**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npx vitest run src/lib/validation/request.test.ts 2>&1`

Expected: FAIL with "Cannot find module './request'".

- [ ] **Step 3: Implement the schemas**

Create `src/lib/validation/request.ts`:

```typescript
import { z } from 'zod'

export const saveDayRequestSchema = z.object({
  periodId: z.string().uuid({ message: 'מזהה תקופה לא תקין' }),
  employeeId: z.string().uuid({ message: 'מזהה עובד לא תקין' }),
  dayOfWeek: z
    .number()
    .int()
    .min(0, { message: 'יום שבוע לא תקין' })
    .max(6, { message: 'יום שבוע לא תקין' }),
  isOff: z.boolean(),
  preferredShiftIds: z.array(z.string().uuid({ message: 'מזהה משמרת לא תקין' })),
})

export type SaveDayRequestInput = z.infer<typeof saveDayRequestSchema>

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/

export const addVacationSchema = z
  .object({
    employeeId: z.string().uuid({ message: 'מזהה עובד לא תקין' }),
    dateFrom: z.string().regex(isoDateRegex, { message: 'תאריך התחלה לא תקין' }),
    dateTo: z.string().regex(isoDateRegex, { message: 'תאריך סיום לא תקין' }),
  })
  .refine((d) => d.dateTo >= d.dateFrom, {
    message: 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה',
    path: ['dateTo'],
  })

export type AddVacationInput = z.infer<typeof addVacationSchema>
```

- [ ] **Step 4: Run to confirm all PASS**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npx vitest run src/lib/validation/request.test.ts 2>&1`

Expected: all 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
git add src/lib/validation/request.ts src/lib/validation/request.test.ts
git commit -m "feat(validation): saveDayRequest + addVacation Zod schemas (TDD)"
```

---

## Task 4: Data context helper

**Files:**
- Create: `src/lib/requests/context.ts`

- [ ] **Step 1: Create the context helper**

Create `src/lib/requests/context.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { upcomingWeekStartISO } from '@/lib/dates/week'

export interface ShiftTypeRow {
  id: string
  key: string
  name: string
  start_hour: number
  hours: number
  color: string
  sort: number
}

export interface RequestRow {
  id: string
  day_of_week: number
  is_off: boolean
  preferred_shift_ids: string[]
}

export interface VacationRow {
  id: string
  date_from: string
  date_to: string
}

export interface EmployeeRequestsContext {
  employee: { id: string; name: string; workplace_id: string }
  weekStart: string
  period: { id: string; status: 'collecting' | 'locked' | 'published' } | null
  shiftTypes: ShiftTypeRow[]
  /** Map: day_of_week (0–6) → RequestRow */
  requestsByDay: Record<number, RequestRow>
  vacations: VacationRow[]
}

/**
 * Resolves all data needed to render /me/requests for the authenticated employee.
 * Returns null if the current user has no employee row.
 */
export async function getEmployeeRequestsContext(
  supabase: SupabaseClient,
): Promise<EmployeeRequestsContext | null> {
  const { data: emp } = await supabase
    .from('employees')
    .select('id, name, workplace_id')
    .limit(1)
    .maybeSingle()

  if (!emp) return null

  const weekStart = upcomingWeekStartISO(new Date())

  // Ensure the period exists (RPC creates it if needed) — employees cannot INSERT directly.
  const { data: periodId, error: rpcError } = await supabase.rpc('ensure_upcoming_period', {
    wp: emp.workplace_id,
    wk: weekStart,
  })

  if (rpcError || !periodId) return null

  const [{ data: periodRow }, { data: shiftTypesRaw }, { data: requestsRaw }, { data: vacationsRaw }] =
    await Promise.all([
      supabase
        .from('schedule_periods')
        .select('id, status')
        .eq('id', periodId)
        .maybeSingle(),
      supabase
        .from('shift_types')
        .select('id, key, name, start_hour, hours, color, sort')
        .eq('workplace_id', emp.workplace_id)
        .eq('is_fallback', false)
        .order('sort'),
      supabase
        .from('requests')
        .select('id, day_of_week, is_off, preferred_shift_ids')
        .eq('period_id', periodId)
        .eq('employee_id', emp.id),
      supabase
        .from('employee_vacations')
        .select('id, date_from, date_to')
        .eq('employee_id', emp.id)
        .order('date_from'),
    ])

  const requestsByDay: Record<number, RequestRow> = {}
  for (const r of requestsRaw ?? []) {
    requestsByDay[r.day_of_week] = r as RequestRow
  }

  return {
    employee: emp,
    weekStart,
    period: periodRow as { id: string; status: 'collecting' | 'locked' | 'published' } | null,
    shiftTypes: (shiftTypesRaw ?? []) as ShiftTypeRow[],
    requestsByDay,
    vacations: (vacationsRaw ?? []) as VacationRow[],
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
git add src/lib/requests/context.ts
git commit -m "feat(requests): getEmployeeRequestsContext data helper"
```

---

## Task 5: Server Actions

**Files:**
- Create: `src/app/(employee)/me/requests/actions.ts`

- [ ] **Step 1: Create the actions file**

Create `src/app/(employee)/me/requests/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { saveDayRequestSchema, addVacationSchema } from '@/lib/validation/request'

export type ActionResult = { ok: true } | { error: string }

export async function saveDayRequest(input: unknown): Promise<ActionResult> {
  const parsed = saveDayRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'נתונים לא תקינים' }
  }
  const { periodId, employeeId, dayOfWeek, isOff, preferredShiftIds } = parsed.data

  const supabase = await createClient()

  // Guard: period must be 'collecting'
  const { data: period } = await supabase
    .from('schedule_periods')
    .select('status')
    .eq('id', periodId)
    .maybeSingle()

  if (!period) return { error: 'תקופה לא נמצאה' }
  if (period.status !== 'collecting') {
    return { error: 'הבקשות נעולות — חלון ההגשה נסגר' }
  }

  const { error } = await supabase.from('requests').upsert(
    {
      period_id: periodId,
      employee_id: employeeId,
      day_of_week: dayOfWeek,
      is_off: isOff,
      preferred_shift_ids: preferredShiftIds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'period_id,employee_id,day_of_week' },
  )

  if (error) return { error: 'שגיאה בשמירת הבקשה' }

  revalidatePath('/me/requests')
  return { ok: true }
}

export async function addVacation(input: unknown): Promise<ActionResult> {
  const parsed = addVacationSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? 'נתונים לא תקינים' }
  }
  const { employeeId, dateFrom, dateTo } = parsed.data

  const supabase = await createClient()

  const { error } = await supabase.from('employee_vacations').insert({
    employee_id: employeeId,
    date_from: dateFrom,
    date_to: dateTo,
  })

  if (error) return { error: 'שגיאה בהוספת חופשה' }

  revalidatePath('/me/requests')
  return { ok: true }
}

export async function removeVacation(id: string): Promise<ActionResult> {
  if (!id) return { error: 'מזהה חופשה חסר' }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_vacations')
    .delete()
    .eq('id', id)
    .select('id')

  if (error || !data || data.length === 0) {
    return { error: 'שגיאה במחיקת חופשה' }
  }

  revalidatePath('/me/requests')
  return { ok: true }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
git add "src/app/(employee)/me/requests/actions.ts"
git commit -m "feat(requests): saveDayRequest / addVacation / removeVacation server actions"
```

---

## Task 6: RequestsHeader component

**Files:**
- Create: `src/app/(employee)/me/requests/RequestsHeader.tsx`

- [ ] **Step 1: Create the header component**

Create `src/app/(employee)/me/requests/RequestsHeader.tsx`:

```typescript
import React from 'react'

interface RequestsHeaderProps {
  weekLabel: string
  filled: number
  total: number
  isReadOnly: boolean
}

export function RequestsHeader({ weekLabel, filled, total, isReadOnly }: RequestsHeaderProps) {
  return (
    <div>
      {/* Screen heading */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '6px 2px 18px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-2)',
              marginBottom: 3,
            }}
          >
            שבוע {weekLabel}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.8px',
            }}
          >
            הבקשות שלי
          </h1>
        </div>
      </div>

      {/* Read-only banner */}
      {isReadOnly && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 14px',
            borderRadius: 'var(--r-md)',
            background: 'rgba(220,70,70,0.1)',
            border: '1px solid rgba(220,70,70,0.25)',
            marginBottom: 16,
          }}
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D8423B"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 4 21 19.5H3L12 4Z" />
            <path d="M12 10v4.2M12 17.2v.1" />
          </svg>
          <div style={{ fontSize: 13, color: '#D8423B', fontWeight: 600 }}>
            חלון הגשת הבקשות נסגר — הסידור נעול
          </div>
        </div>
      )}

      {/* Info banner (only when collecting) */}
      {!isReadOnly && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 14px',
            borderRadius: 'var(--r-md)',
            background: 'var(--accent-soft)',
            marginBottom: 16,
          }}
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8v.1" />
          </svg>
          <div
            style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, flex: 1 }}
          >
            לחצו על יום כדי לבחור משמרות מועדפות או לסמן יום חופש. ניתן לבחור יותר ממשמרת אחת.
          </div>
        </div>
      )}

      {/* Progress */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-2)',
          marginBottom: 8,
        }}
      >
        {filled === total ? 'כל הימים מולאו ✓' : `מולאו ${filled} מתוך ${total} ימים`}
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 99,
          background: 'var(--surface-sunk)',
          marginBottom: 16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(filled / total) * 100}%`,
            height: '100%',
            borderRadius: 99,
            background: 'var(--accent)',
            transition: 'width .4s ease',
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
git add "src/app/(employee)/me/requests/RequestsHeader.tsx"
git commit -m "feat(requests): RequestsHeader component (week label, progress bar, banners)"
```

---

## Task 7: DayEditor client component

**Files:**
- Create: `src/app/(employee)/me/requests/DayEditor.tsx`

- [ ] **Step 1: Create DayEditor**

Create `src/app/(employee)/me/requests/DayEditor.tsx`:

```typescript
'use client'

import React, { useState, useTransition } from 'react'
import { Btn } from '@/components/ui/Btn'
import { SHIFT_META } from '@/lib/domain/constants'
import type { ShiftTypeRow, RequestRow } from '@/lib/requests/context'
import { saveDayRequest, type ActionResult } from './actions'

interface DayEditorProps {
  shiftTypes: ShiftTypeRow[]
  /** The current request row, or null if not yet saved for this day */
  request: RequestRow | null
  periodId: string
  employeeId: string
  dayOfWeek: number
  onDone: () => void
}

export function DayEditor({
  shiftTypes,
  request,
  periodId,
  employeeId,
  dayOfWeek,
  onDone,
}: DayEditorProps) {
  const [isOff, setIsOff] = useState(request?.is_off ?? false)
  const [selectedIds, setSelectedIds] = useState<string[]>(
    request?.preferred_shift_ids ?? [],
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleShift(id: string) {
    if (isOff) return
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function toggleOff() {
    setIsOff((prev) => !prev)
    if (!isOff) setSelectedIds([])
  }

  function handleSave() {
    startTransition(async () => {
      const result: ActionResult = await saveDayRequest({
        periodId,
        employeeId,
        dayOfWeek,
        isOff,
        preferredShiftIds: isOff ? [] : selectedIds,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        onDone()
      }
    })
  }

  return (
    <div>
      <div
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: 'var(--text-2)',
          marginBottom: 10,
        }}
      >
        משמרות מועדפות
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {shiftTypes.map((st) => {
          const meta = SHIFT_META[st.key as keyof typeof SHIFT_META]
          const on = !isOff && selectedIds.includes(st.id)
          const color = meta?.color ?? st.color
          const soft = meta?.soft ?? `${st.color}22`

          return (
            <button
              key={st.id}
              onClick={() => toggleShift(st.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                padding: '12px 14px',
                textAlign: 'start',
                borderRadius: 'var(--r-md)',
                cursor: isOff ? 'default' : 'pointer',
                width: '100%',
                border: `1.5px solid ${on ? color : 'var(--border)'}`,
                background: on ? soft : 'var(--surface)',
                opacity: isOff ? 0.4 : 1,
                transition: 'all .12s ease',
                fontFamily: 'var(--font)',
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 'var(--r-sm)',
                  background: soft,
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {st.name.slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  {st.name}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  {meta?.time ?? `${st.start_hour}:00`}
                </div>
              </div>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 99,
                  flexShrink: 0,
                  border: `2px solid ${on ? color : 'var(--border-strong)'}`,
                  background: on ? color : 'transparent',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                }}
              >
                {on && '✓'}
              </span>
            </button>
          )
        })}
      </div>

      <div
        style={{ height: 1, background: 'var(--border)', margin: '16px 0' }}
      />

      {/* Day-off toggle */}
      <button
        onClick={toggleOff}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          padding: '12px 14px',
          width: '100%',
          textAlign: 'start',
          borderRadius: 'var(--r-md)',
          cursor: 'pointer',
          fontFamily: 'var(--font)',
          border: `1.5px solid ${isOff ? '#C0598F' : 'var(--border)'}`,
          background: isOff ? 'rgba(192,89,143,0.1)' : 'var(--surface)',
          transition: 'all .12s ease',
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 'var(--r-sm)',
            background: 'rgba(192,89,143,0.13)',
            color: '#C0598F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✈
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            יום חופש / לא זמין
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            לא אשובץ ביום זה
          </div>
        </div>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 99,
            flexShrink: 0,
            border: `2px solid ${isOff ? '#C0598F' : 'var(--border-strong)'}`,
            background: isOff ? '#C0598F' : 'transparent',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
          }}
        >
          {isOff && '✓'}
        </span>
      </button>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            background: 'rgba(220,70,70,0.1)',
            color: '#D8423B',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ height: 18 }} />
      <Btn
        variant="primary"
        size="lg"
        style={{ width: '100%' }}
        onClick={handleSave}
        disabled={isPending}
      >
        {isPending ? 'שומר...' : 'שמירה'}
      </Btn>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
git add "src/app/(employee)/me/requests/DayEditor.tsx"
git commit -m "feat(requests): DayEditor client component (shift toggles + day-off)"
```

---

## Task 8: DayList client component

**Files:**
- Create: `src/app/(employee)/me/requests/DayList.tsx`

- [ ] **Step 1: Create DayList**

The 7 Hebrew day names (Sunday-first) and their dates for the upcoming week are passed as props from the server page.

Create `src/app/(employee)/me/requests/DayList.tsx`:

```typescript
'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { SHIFT_META } from '@/lib/domain/constants'
import type { ShiftTypeRow, RequestRow } from '@/lib/requests/context'
import { DayEditor } from './DayEditor'

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

interface DayCard {
  dayOfWeek: number // 0–6
  dateLabel: string // e.g. "1.6"
  request: RequestRow | null
}

interface DayListProps {
  days: DayCard[]
  shiftTypes: ShiftTypeRow[]
  periodId: string
  employeeId: string
  isReadOnly: boolean
}

export function DayList({
  days,
  shiftTypes,
  periodId,
  employeeId,
  isReadOnly,
}: DayListProps) {
  const [editDay, setEditDay] = useState<number | null>(null)

  const activeDayCard = editDay !== null ? days.find((d) => d.dayOfWeek === editDay) ?? null : null

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {days.map((day) => {
          const r = day.request
          return (
            <Card
              key={day.dayOfWeek}
              pad={0}
              interactive={!isReadOnly}
              onClick={isReadOnly ? undefined : () => setEditDay(day.dayOfWeek)}
              style={{ overflow: 'hidden' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  padding: '13px 14px',
                }}
              >
                {/* Day name + date */}
                <div style={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
                  <div
                    style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}
                  >
                    {HEB_DAYS[day.dayOfWeek]}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-3)',
                      fontWeight: 600,
                    }}
                  >
                    {day.dateLabel}
                  </div>
                </div>

                <div
                  style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }}
                />

                {/* Request content */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  {r?.is_off ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#C0598F',
                        background: 'rgba(192,89,143,0.12)',
                        padding: '6px 12px',
                        borderRadius: 99,
                      }}
                    >
                      יום חופש
                    </span>
                  ) : r && r.preferred_shift_ids.length > 0 ? (
                    shiftTypes
                      .filter((st) => r.preferred_shift_ids.includes(st.id))
                      .map((st) => {
                        const meta = SHIFT_META[st.key as keyof typeof SHIFT_META]
                        const color = meta?.color ?? st.color
                        const soft = meta?.soft ?? `${st.color}22`
                        return (
                          <span
                            key={st.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 13,
                              fontWeight: 700,
                              color,
                              background: soft,
                              padding: '6px 11px',
                              borderRadius: 99,
                            }}
                          >
                            {st.name}
                          </span>
                        )
                      })
                  ) : (
                    <span
                      style={{
                        fontSize: 14,
                        color: 'var(--text-3)',
                        fontWeight: 600,
                      }}
                    >
                      {isReadOnly ? 'לא הוגשה בקשה' : 'טרם נבחר — הקישו להוספה'}
                    </span>
                  )}
                </div>

                {!isReadOnly && (
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-3)"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.5 5 8 12l6.5 7" />
                  </svg>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Day editor sheet */}
      <Sheet
        open={editDay !== null}
        onClose={() => setEditDay(null)}
        title={
          activeDayCard
            ? `${HEB_DAYS[activeDayCard.dayOfWeek]} · ${activeDayCard.dateLabel}`
            : ''
        }
      >
        {editDay !== null && activeDayCard !== null && (
          <DayEditor
            shiftTypes={shiftTypes}
            request={activeDayCard.request}
            periodId={periodId}
            employeeId={employeeId}
            dayOfWeek={editDay}
            onDone={() => setEditDay(null)}
          />
        )}
      </Sheet>
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
git add "src/app/(employee)/me/requests/DayList.tsx"
git commit -m "feat(requests): DayList client component (7 day cards + Sheet)"
```

---

## Task 9: VacationSection client component

**Files:**
- Create: `src/app/(employee)/me/requests/VacationSection.tsx`

- [ ] **Step 1: Create VacationSection**

Create `src/app/(employee)/me/requests/VacationSection.tsx`:

```typescript
'use client'

import React, { useState, useTransition } from 'react'
import { Card } from '@/components/ui/Card'
import { Btn } from '@/components/ui/Btn'
import type { VacationRow } from '@/lib/requests/context'
import { addVacation, removeVacation } from './actions'

interface VacationSectionProps {
  employeeId: string
  vacations: VacationRow[]
  isReadOnly: boolean
}

export function VacationSection({ employeeId, vacations, isReadOnly }: VacationSectionProps) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    setAddError(null)
    startTransition(async () => {
      const result = await addVacation({ employeeId, dateFrom, dateTo })
      if ('error' in result) {
        setAddError(result.error)
      } else {
        setDateFrom('')
        setDateTo('')
      }
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      await removeVacation(id)
    })
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: 'var(--font)',
    minWidth: 0,
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: 'var(--text)',
          marginBottom: 12,
          letterSpacing: '-0.3px',
        }}
      >
        חופשות ואי-זמינות
      </div>

      {/* Existing vacations */}
      {vacations.length === 0 ? (
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-3)',
            marginBottom: 16,
            padding: '12px 0',
          }}
        >
          אין חופשות מוגדרות
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {vacations.map((v) => (
            <Card
              key={v.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {v.date_from} – {v.date_to}
              </div>
              {!isReadOnly && (
                <button
                  onClick={() => handleRemove(v.id)}
                  disabled={isPending}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#D8423B',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'var(--font)',
                    padding: '4px 8px',
                  }}
                >
                  הסר
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add vacation form */}
      {!isReadOnly && (
        <Card style={{ padding: '16px' }}>
          <div
            style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 12 }}
          >
            הוספת חופשה
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={inputStyle}
              aria-label="תאריך התחלה"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={inputStyle}
              aria-label="תאריך סיום"
            />
          </div>
          {addError && (
            <div
              style={{
                marginBottom: 10,
                fontSize: 13,
                color: '#D8423B',
                fontWeight: 600,
              }}
            >
              {addError}
            </div>
          )}
          <Btn
            variant="soft"
            size="md"
            style={{ width: '100%' }}
            onClick={handleAdd}
            disabled={isPending || !dateFrom || !dateTo}
          >
            הוסף חופשה
          </Btn>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
git add "src/app/(employee)/me/requests/VacationSection.tsx"
git commit -m "feat(requests): VacationSection client component (list + add/remove)"
```

---

## Task 10: Server page + navigation link

**Files:**
- Create: `src/app/(employee)/me/requests/page.tsx`
- Modify: `src/app/(employee)/me/page.tsx`

- [ ] **Step 1: Create the requests page**

The server page computes day date-labels from `weekStart` and fans them out as props.

Create `src/app/(employee)/me/requests/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getEmployeeRequestsContext } from '@/lib/requests/context'
import { formatHebDate } from '@/lib/dates/week'
import { RequestsHeader } from './RequestsHeader'
import { DayList } from './DayList'
import { VacationSection } from './VacationSection'

export default async function RequestsPage() {
  const supabase = await createClient()
  const ctx = await getEmployeeRequestsContext(supabase)

  if (!ctx) redirect('/login')

  const { employee, weekStart, period, shiftTypes, requestsByDay, vacations } = ctx
  const isReadOnly = !period || period.status !== 'collecting'

  // Build date label for each day of the week starting at weekStart
  const weekStartDate = new Date(weekStart + 'T00:00:00')
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate)
    d.setDate(weekStartDate.getDate() + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return {
      dayOfWeek: i,
      dateLabel: formatHebDate(iso),
      request: requestsByDay[i] ?? null,
    }
  })

  const filled = days.filter((d) => d.request?.is_off || (d.request?.preferred_shift_ids?.length ?? 0) > 0).length

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        padding: '16px 16px 48px',
        maxWidth: 540,
        margin: '0 auto',
        direction: 'rtl',
      }}
    >
      {/* Back link */}
      <Link
        href="/me"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--accent)',
          textDecoration: 'none',
          marginBottom: 12,
        }}
      >
        ← חזרה
      </Link>

      <RequestsHeader
        weekLabel={formatHebDate(weekStart)}
        filled={filled}
        total={7}
        isReadOnly={isReadOnly}
      />

      <DayList
        days={days}
        shiftTypes={shiftTypes}
        periodId={period?.id ?? ''}
        employeeId={employee.id}
        isReadOnly={isReadOnly}
      />

      <VacationSection
        employeeId={employee.id}
        vacations={vacations}
        isReadOnly={isReadOnly}
      />
    </main>
  )
}
```

- [ ] **Step 2: Add the navigation link to /me**

Edit `src/app/(employee)/me/page.tsx`. Replace the placeholder "הסידור והבקשות שלך — בקרוב" `<div>` with:

```tsx
        <Link
          href="/me/requests"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            borderRadius: 'var(--r-md)',
            fontWeight: 700,
            fontSize: 15,
            textDecoration: 'none',
            border: '1px solid transparent',
            marginBottom: 24,
          }}
        >
          <span>הגשת בקשות לשבוע הקרוב</span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: 'scaleX(-1)' }}
          >
            <path d="M14.5 5 8 12l6.5 7" />
          </svg>
        </Link>
```

Also add `import Link from 'next/link'` at the top of the file (check it's not already there).

- [ ] **Step 3: Verify TypeScript and build**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npx tsc --noEmit 2>&1 | head -30`

Expected: no errors.

- [ ] **Step 4: Run all unit tests**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npm test 2>&1`

Expected: all tests pass (includes week.test.ts, request.test.ts, and all prior tests).

- [ ] **Step 5: Check no file exceeds 200 lines**

Run:
```bash
find /Users/tzachir/Desktop/MyApps/AutoShiftSchedule/src -name "*.tsx" -o -name "*.ts" | xargs wc -l | awk '$1>200 && $2!="total"'
```

Expected: empty output.

- [ ] **Step 6: Commit**

```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
git add "src/app/(employee)/me/requests/page.tsx" "src/app/(employee)/me/page.tsx"
git commit -m "feat(requests): /me/requests server page + /me navigation link"
```

---

## Task 11: E2E test

**Files:**
- Create: `e2e/requests.spec.ts`

- [ ] **Step 1: Create the E2E spec**

Create `e2e/requests.spec.ts`:

```typescript
import { test, expect, Browser } from '@playwright/test'

async function signupAndOnboard(
  browser: Browser,
  email: string,
  password: string,
  orgName: string,
  workplaceName: string,
) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(email)
  await page.getByLabel('סיסמה').fill(password)
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })
  await page.getByLabel('שם הארגון').fill(orgName)
  await page.getByLabel('שם מקום העבודה').fill(workplaceName)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
  return { page, context }
}

async function createInviteCode(managerPage: ReturnType<typeof managerPage>): Promise<string> {
  await managerPage.goto('/team')
  await managerPage.getByRole('button', { name: 'צור קוד הזמנה' }).click()
  const codeEl = managerPage.locator('div[style*="monospace"]')
  await expect(codeEl).toBeVisible({ timeout: 10000 })
  return (await codeEl.textContent())?.trim() ?? ''
}

test('employee requests: full flow (mark day-off, preferred shift, vacation)', async ({ browser }) => {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  const managerEmail = `mgr+${uuid}@example.com`
  const password = 'TestPass123!'
  const orgName = `ארגון ${uuid}`
  const workplaceName = `מקום עבודה ${uuid}`

  // ── 1. Manager signs up + onboards ──────────────────────────────────────
  const { page: managerPage, context: managerContext } = await signupAndOnboard(
    browser,
    managerEmail,
    password,
    orgName,
    workplaceName,
  )

  // ── 2. Manager creates invite ────────────────────────────────────────────
  await managerPage.goto('/team')
  await managerPage.getByRole('button', { name: 'צור קוד הזמנה' }).click()
  const codeEl = managerPage.locator('div[style*="monospace"]')
  await expect(codeEl).toBeVisible({ timeout: 10000 })
  const code = (await codeEl.textContent())?.trim() ?? ''
  expect(code).toMatch(/^[A-Z2-9]{8}$/)

  // ── 3. Employee signs up via join link ───────────────────────────────────
  const empUuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  const empEmail = `emp+${empUuid}@example.com`
  const empPassword = 'EmpPass456!'
  const empName = 'ישראל ישראלי'

  const empContext = await browser.newContext()
  const empPage = await empContext.newPage()

  await empPage.goto(`/join/${code}`)
  await expect(empPage.getByRole('heading', { name: /הצטרפות/ })).toBeVisible({ timeout: 10000 })
  await empPage.getByLabel('שם מלא').fill(empName)
  await empPage.getByLabel('אימייל').fill(empEmail)
  await empPage.getByLabel('סיסמה').fill(empPassword)
  await empPage.getByRole('button', { name: 'הצטרפות' }).click()
  await expect(empPage).toHaveURL(/\/me/, { timeout: 15000 })

  // ── 4. Employee navigates to /me/requests ────────────────────────────────
  await empPage.getByRole('link', { name: /הגשת בקשות/ }).click()
  await expect(empPage).toHaveURL(/\/me\/requests/, { timeout: 10000 })
  await expect(empPage.getByRole('heading', { name: 'הבקשות שלי' })).toBeVisible()

  // ── 5. Mark day 0 (ראשון) as day-off ────────────────────────────────────
  // Click the first day card
  const dayCards = empPage.locator('[style*="overflow: hidden"]')
  await dayCards.first().click()

  // Sheet opens — click "יום חופש / לא זמין"
  await expect(empPage.getByText('יום חופש / לא זמין')).toBeVisible({ timeout: 5000 })
  await empPage.getByText('יום חופש / לא זמין').click()
  await empPage.getByRole('button', { name: 'שמירה' }).click()

  // Sheet closes — day shows "יום חופש"
  await expect(empPage.getByText('יום חופש')).toBeVisible({ timeout: 5000 })

  // ── 6. Select a preferred shift on day 1 (שני) ──────────────────────────
  await dayCards.nth(1).click()
  await expect(empPage.getByText('משמרות מועדפות')).toBeVisible({ timeout: 5000 })
  // Click the first shift button (בוקר / morning)
  const shiftBtns = empPage.locator('button').filter({ hasText: 'בוקר' })
  await shiftBtns.first().click()
  await empPage.getByRole('button', { name: 'שמירה' }).click()

  // Sheet closes — day shows the shift chip
  await expect(empPage.getByText('בוקר')).toBeVisible({ timeout: 5000 })

  // ── 7. Reload and assert persistence ────────────────────────────────────
  await empPage.reload()
  await expect(empPage).toHaveURL(/\/me\/requests/)
  await expect(empPage.getByText('יום חופש')).toBeVisible({ timeout: 10000 })
  await expect(empPage.getByText('בוקר')).toBeVisible()

  // ── 8. Add a vacation range ──────────────────────────────────────────────
  await empPage.getByLabel('תאריך התחלה').fill('2026-07-01')
  await empPage.getByLabel('תאריך סיום').fill('2026-07-07')
  await empPage.getByRole('button', { name: 'הוסף חופשה' }).click()
  await expect(empPage.getByText('2026-07-01 – 2026-07-07')).toBeVisible({ timeout: 5000 })

  // Reload and assert vacation persists
  await empPage.reload()
  await expect(empPage.getByText('2026-07-01 – 2026-07-07')).toBeVisible({ timeout: 10000 })

  await empContext.close()
  await managerContext.close()
})
```

- [ ] **Step 2: Run a build check before running E2E**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npm run build 2>&1 | tail -20`

Expected: `✓ Compiled successfully` or similar (no errors, no TypeError).

- [ ] **Step 3: Run E2E tests**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npm run e2e 2>&1 | tail -40`

Expected: all tests pass, including the new `requests.spec.ts` test.

- [ ] **Step 4: Verify no server errors in E2E output**

Run: `cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule && npm run e2e 2>&1 | grep -i "TypeError\|PGRST116\|500\|Error:" || echo "No server errors found"`

Expected: "No server errors found".

- [ ] **Step 5: Final line-count check**

Run:
```bash
find /Users/tzachir/Desktop/MyApps/AutoShiftSchedule/src -name "*.tsx" -o -name "*.ts" | xargs wc -l | awk '$1>200 && $2!="total"'
```

Expected: empty output.

- [ ] **Step 6: Commit**

```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
git add e2e/requests.spec.ts
git commit -m "test(e2e): employee requests full flow (day-off, preferred shift, vacation)"
```

---

## Task 12: Final integration commit

- [ ] **Step 1: Run all checks**

```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all pass with no errors.

- [ ] **Step 2: Final commit**

```bash
cd /Users/tzachir/Desktop/MyApps/AutoShiftSchedule
git add -A
git commit -m "feat(requests): employee weekly requests (preferred shifts/day-off) + vacation ranges" --trailer "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist

- **Sunday math:** `upcomingWeekStartISO` — getDay() returns 0 for Sunday, so `daysUntilSunday = 0` for Sundays (returns self). For Wednesday (getDay()=3), `7-3=4` days forward → next Sunday. ✓
- **TDD flow:** Tests are written before implementation in Tasks 2 and 3. Each test is run to verify FAIL before implementation. ✓
- **Period status guard:** `saveDayRequest` fetches period.status and returns Hebrew error if not 'collecting'. ✓  
- **Read-only mode:** Both `DayList` (no onClick, shows different placeholder) and `VacationSection` (hides add form) respect `isReadOnly`. ✓
- **Only base shifts selectable:** `context.ts` fetches `is_fallback = false` shift types only. ✓
- **E2E persistence check:** After marking day-off + preferred shift, `empPage.reload()` is called and assertions repeat. ✓
- **File sizes:** Components split into Header (≤90L), DayList (≤140L), DayEditor (≤140L), VacationSection (≤130L), page (≤70L), context (≤90L), actions (≤65L). All well under 200 lines. ✓
- **No new migrations:** RLS tables `requests`, `employee_vacations`, `schedule_periods`, and the `ensure_upcoming_period` RPC already exist (migrations 006, 007). ✓
- **redirect() outside try/catch:** Both `context.ts` (returns null, page redirects) and `page.tsx` (calls redirect at top level). ✓
- **Spec coverage gaps:** ✓ All 5 spec sections covered: date helper, context, actions, UI, tests.
