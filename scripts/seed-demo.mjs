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
const EMP = [
  { name: 'דני לוי', roles: ['מוקדן', 'מאבטח'], type: 'full', min: 5, shabbat: true, color: '#3D6BF5' },
  { name: 'שירה כהן', roles: ['אחמ״ש', 'מוקדן', 'מאבטח'], type: 'full', min: 5, color: '#E0902A' },
  { name: 'יוסי מזרחי', roles: ['מאבטח'], type: 'full', min: 5, color: '#13A98E', weekdayNights: true },
  { name: 'נועה ברק', roles: ['מוקדן', 'מאבטח'], type: 'part', min: 2, max: 4, color: '#9B5DE0' },
  { name: 'אבי פרץ', roles: ['אחמ״ש', 'מאבטח'], type: 'full', min: 5, holidays: true, color: '#EB6A4E' },
  { name: 'רותם שמש', roles: ['מוקדן', 'מאבטח'], type: 'student', max: 3, color: '#2BB3C0' },
  { name: 'עומר דהן', roles: ['אחמ״ש', 'מאבטח'], type: 'full', min: 5, mustAccept: true, color: '#C0598F' },
  { name: 'ליאת אזולאי', roles: ['מוקדן', 'מאבטח'], type: 'part', min: 2, max: 4, color: '#7A8B3D' },
  { name: 'מאור גבאי', roles: ['אחמ״ש', 'מאבטח'], type: 'full', min: 5, shabbat: true, color: '#5B61D6' },
  { name: 'טל אבני', roles: ['אחמ״ש', 'מוקדן', 'מאבטח'], type: 'full', min: 5, color: '#2BB3C0' },
  { name: 'רון שלו', roles: ['מוקדן', 'מאבטח'], type: 'full', min: 5, color: '#D08A2E' },
  { name: 'גיא נחמיאס', roles: ['מאבטח'], type: 'full', min: 5, color: '#13A98E' },
  { name: 'אורי כץ', roles: ['אחמ״ש', 'מאבטח'], type: 'full', min: 5, color: '#E0902A' },
  { name: 'מיכל רז', roles: ['מוקדן', 'מאבטח'], type: 'part', min: 3, max: 5, color: '#9B5DE0' },
  { name: 'עידן בר', roles: ['אחמ״ש', 'מוקדן', 'מאבטח'], type: 'full', min: 5, color: '#3D6BF5' },
  { name: 'נטע גל', roles: ['מוקדן', 'מאבטח'], type: 'full', min: 5, color: '#C0598F' },
]

function upcomingSundayISO() {
  const d = new Date()
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + ((7 - day) % 7))
  return d.toISOString().slice(0, 10)
}

// Optional: limit the number of seeded employees via CLI arg, e.g.
//   node scripts/seed-demo.mjs 9   → seeds the first 9 employees (for testing
// the scheduler at different staffing levels). Default = all.
const EMP_COUNT = Number.parseInt(process.argv[2] ?? '', 10)
const EMPLOYEES = Number.isFinite(EMP_COUNT) && EMP_COUNT > 0 ? EMP.slice(0, EMP_COUNT) : EMP

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

  // 7. upcoming period + sample requests (so the engine has preferences to honor)
  const week = upcomingSundayISO()
  const { data: period } = await db.from('schedule_periods').insert({ workplace_id: W, week_start_date: week, status: 'collecting' }).select('id').single()
  const prefByIdx = ['morning', 'noon', 'night']
  const reqs = []
  empIds.forEach((e, i) => {
    for (let d = 0; d < 7; d++) {
      if (d === ((i + 2) % 7)) { reqs.push({ period_id: period.id, employee_id: e.id, day_of_week: d, is_off: true, preferred_shift_ids: [] }); continue }
      const sk = prefByIdx[(i + d) % 3]
      reqs.push({ period_id: period.id, employee_id: e.id, day_of_week: d, is_off: false, preferred_shift_ids: [shiftId[sk]] })
    }
  })
  await db.from('requests').insert(reqs)

  console.log('\n✅ Demo seeded.')
  console.log('   Manager login →  email: ' + DEMO_EMAIL + '   password: ' + DEMO_PASSWORD)
  console.log('   Workplace: מוקד ראשי · employees: ' + EMPLOYEES.length + ' · requirements + a week of requests ready.')
  console.log('   Log in, open שיבוץ, press "צור סידור אוטומטי", then פרסם — and check the dashboard.')
}
main().catch((e) => { console.error(e); process.exit(1) })
