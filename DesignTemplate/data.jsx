// data.jsx — domain data + the automatic scheduling engine

// ── Week being planned ───────────────────────────────────────
const WEEK_LABEL = '31 במאי – 6 ביוני';
const DAYS = [
  { i: 0, name: 'ראשון',  short: 'א׳', date: '31.5' },
  { i: 1, name: 'שני',    short: 'ב׳', date: '1.6'  },
  { i: 2, name: 'שלישי',  short: 'ג׳', date: '2.6'  },
  { i: 3, name: 'רביעי',  short: 'ד׳', date: '3.6'  },
  { i: 4, name: 'חמישי',  short: 'ה׳', date: '4.6'  },
  { i: 5, name: 'שישי',   short: 'ו׳', date: '5.6'  },
  { i: 6, name: 'שבת',    short: 'ש׳', date: '6.6'  },
];

// ── Employees ────────────────────────────────────────────────
// roles = which roles this person is allowed to fill
const EMPLOYEES = [
  { id: 'e1',  name: 'דני לוי',      roles: ['מוקדן', 'מאבטח'],            minShifts: 4, color: '#3D6BF5', phone: '052-1100221', since: '2023' },
  { id: 'e2',  name: 'שירה כהן',     roles: ['אחמ״ש', 'מוקדן', 'מאבטח'],   minShifts: 5, color: '#E0902A', phone: '054-2233101', since: '2021' },
  { id: 'e3',  name: 'יוסי מזרחי',   roles: ['מאבטח'],                     minShifts: 5, color: '#13A98E', phone: '050-7788123', since: '2022' },
  { id: 'e4',  name: 'נועה ברק',     roles: ['מוקדן', 'מאבטח'],            minShifts: 4, color: '#9B5DE0', phone: '053-9911234', since: '2024' },
  { id: 'e5',  name: 'אבי פרץ',      roles: ['אחמ״ש', 'מאבטח'],            minShifts: 5, color: '#EB6A4E', phone: '052-6655321', since: '2020' },
  { id: 'e6',  name: 'רותם שמש',     roles: ['מוקדן', 'מאבטח'],            minShifts: 4, color: '#2BB3C0', phone: '058-4433221', since: '2023' },
  { id: 'e7',  name: 'עומר דהן',     roles: ['אחמ״ש', 'מאבטח'],            minShifts: 5, color: '#C0598F', phone: '054-8822119', since: '2022' },
  { id: 'e8',  name: 'ליאת אזולאי',  roles: ['מוקדן', 'מאבטח'],            minShifts: 4, color: '#7A8B3D', phone: '050-3344556', since: '2024' },
  { id: 'e9',  name: 'מאור גבאי',    roles: ['אחמ״ש', 'מאבטח'],            minShifts: 5, color: '#5B61D6', phone: '053-2211009', since: '2021' },
  { id: 'e10', name: 'תמר נחום',     roles: ['מוקדן', 'מאבטח'],            minShifts: 4, color: '#D08A2E', phone: '052-9988771', since: '2023' },
];
const ME_ID = 'e1'; // the logged-in employee

// ── Shift requirements (manager-configurable) ────────────────
// per shift type: how many of each role are required
const DEFAULT_REQUIREMENTS = {
  morning: { 'אחמ״ש': 1, 'מוקדן': 1, 'מאבטח': 1 },
  noon:    { 'אחמ״ש': 0, 'מוקדן': 1, 'מאבטח': 1 },
  night:   { 'אחמ״ש': 1, 'מוקדן': 0, 'מאבטח': 1 },
};

// ── Requests ─────────────────────────────────────────────────
// requests[empId] = array length 7 of { off:bool, shifts:[shiftIds] }
// Deterministic generator so the demo is stable across reloads.
function lcg(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function buildRequests() {
  const rnd = lcg(73);
  const out = {};
  EMPLOYEES.forEach((emp, idx) => {
    const week = [];
    const offDay = Math.floor(rnd() * 7);          // one day off
    const offDay2 = (offDay + 2 + Math.floor(rnd() * 3)) % 7;
    for (let d = 0; d < 7; d++) {
      if (d === offDay || d === offDay2) { week.push({ off: true, shifts: [] }); continue; }
      // pick 1–2 preferred shifts, biased so coverage works out
      const pool = ['morning', 'noon', 'night'];
      const pick = [];
      const n = rnd() < 0.55 ? 1 : 2;
      // rotate preference by employee index for spread
      const start = (idx + d) % 3;
      for (let k = 0; k < n; k++) pick.push(pool[(start + k) % 3]);
      week.push({ off: false, shifts: [...new Set(pick)] });
    }
    out[emp.id] = week;
  });
  // Make "me" partially filled so the user has something to do on the requests screen
  out[ME_ID] = [
    { off: false, shifts: ['morning'] },
    { off: false, shifts: ['morning', 'noon'] },
    { off: true,  shifts: [] },
    { off: false, shifts: ['night'] },
    { off: false, shifts: [] },
    { off: false, shifts: [] },
    { off: false, shifts: [] },
  ];
  return out;
}

// ── The automatic scheduling engine ──────────────────────────
// Greedy assignment honoring: roles, requests, 1 shift/day, 8h rest, min shifts.
// Returns { grid, assignmentsByEmp, warnings, stats }
const REST_HOURS = 8;

function shiftEndAbs(dayIndex, shiftId) {
  const m = SHIFT_META[shiftId];
  return dayIndex * 24 + m.start + m.hours; // absolute hour
}
function shiftStartAbs(dayIndex, shiftId) {
  return dayIndex * 24 + SHIFT_META[shiftId].start;
}

function generateSchedule(requests, requirements) {
  // assignment record per employee: list of {day, shift}
  const assigned = {};
  EMPLOYEES.forEach(e => (assigned[e.id] = []));
  // grid[day][shift] = { [role]: [empIds] }
  const grid = DAYS.map(() => ({
    morning: emptyRoleBuckets(), noon: emptyRoleBuckets(), night: emptyRoleBuckets(),
  }));
  const warnings = [];

  function emptyRoleBuckets() { return { 'אחמ״ש': [], 'מוקדן': [], 'מאבטח': [] }; }

  function restOK(empId, day, shift) {
    const s = shiftStartAbs(day, shift), e = shiftEndAbs(day, shift);
    return assigned[empId].every(a => {
      const as = shiftStartAbs(a.day, a.shift), ae = shiftEndAbs(a.day, a.shift);
      // gap between the two intervals must be >= REST_HOURS (and no overlap)
      const gap = s >= ae ? s - ae : (as >= e ? as - e : -1);
      return gap >= REST_HOURS;
    });
  }
  function worksThatDay(empId, day) {
    return assigned[empId].some(a => a.day === day);
  }

  // candidate scoring: prefer those who requested it, then who are under their min, then fewer total shifts
  function candidates(day, shift, role, requireRequested) {
    return EMPLOYEES.filter(e => {
      if (!e.roles.includes(role)) return false;
      const req = requests[e.id][day];
      if (req.off) return false;
      if (worksThatDay(e.id, day)) return false;
      if (!restOK(e.id, day, shift)) return false;
      if (requireRequested && !req.shifts.includes(shift)) return false;
      return true;
    }).sort((a, b) => {
      const ar = requests[a.id][day].shifts.includes(shift) ? 0 : 1;
      const br = requests[b.id][day].shifts.includes(shift) ? 0 : 1;
      if (ar !== br) return ar - br;
      const aUnder = assigned[a.id].length < a.minShifts ? 0 : 1;
      const bUnder = assigned[b.id].length < b.minShifts ? 0 : 1;
      if (aUnder !== bUnder) return aUnder - bUnder;
      return assigned[a.id].length - assigned[b.id].length;
    });
  }

  // Pass 1: fill from people who requested the shift. Pass 2: relax to anyone available.
  for (const pass of [true, false]) {
    for (let d = 0; d < 7; d++) {
      for (const shift of SHIFT_ORDER) {
        for (const role of ROLES) {
          const need = (requirements[shift] || {})[role] || 0;
          while (grid[d][shift][role].length < need) {
            const cand = candidates(d, shift, role, pass)[0];
            if (!cand) break;
            grid[d][shift][role].push(cand.id);
            assigned[cand.id].push({ day: d, shift, role });
          }
        }
      }
    }
  }

  // Collect warnings for unfilled slots
  for (let d = 0; d < 7; d++) {
    for (const shift of SHIFT_ORDER) {
      for (const role of ROLES) {
        const need = (requirements[shift] || {})[role] || 0;
        const have = grid[d][shift][role].length;
        if (have < need) {
          warnings.push({ day: d, shift, role, missing: need - have });
        }
      }
    }
  }

  // Stats
  const stats = {};
  EMPLOYEES.forEach(e => {
    const list = assigned[e.id];
    stats[e.id] = {
      shifts: list.length,
      hours: list.reduce((s, a) => s + SHIFT_META[a.shift].hours, 0),
      belowMin: list.length < e.minShifts,
      byShift: list,
    };
  });
  const totalNeed = DAYS.length * SHIFT_ORDER.reduce((s, sh) => s + ROLES.reduce((t, r) => t + ((requirements[sh] || {})[r] || 0), 0), 0);
  const totalFilled = totalNeed - warnings.reduce((s, w) => s + w.missing, 0);

  return { grid, assigned, warnings, stats, coverage: Math.round((totalFilled / totalNeed) * 100), totalNeed, totalFilled };
}

// Month-to-date stats (mock historical numbers for the dashboard)
function monthStats() {
  const rnd = lcg(41);
  return EMPLOYEES.map(e => {
    const shifts = 14 + Math.floor(rnd() * 9);
    return { id: e.id, name: e.name, color: e.color, shifts, hours: shifts * 8, roles: e.roles };
  });
}

Object.assign(window, {
  WEEK_LABEL, DAYS, EMPLOYEES, ME_ID, DEFAULT_REQUIREMENTS,
  buildRequests, generateSchedule, monthStats, REST_HOURS,
});
