// manager.jsx — manager-side screens

const MGR_TABS = [
  { id: 'mgr-dash', label: 'דשבורד', icon: 'chart' },
  { id: 'mgr-schedule', label: 'שיבוץ', icon: 'grid' },
  { id: 'mgr-team', label: 'עובדים', icon: 'users' },
  { id: 'mgr-settings', label: 'הגדרות', icon: 'settings' },
];

// ── Manager: Dashboard ───────────────────────────────────────
function MgrDash({ ctx }) {
  const [period, setPeriod] = React.useState('שבוע');
  const mult = period === 'שבוע' ? 1 : period === 'חודש' ? 4.2 : 51;
  const month = React.useMemo(() => monthStats(), []);

  const rows = EMPLOYEES.map(e => {
    const wk = ctx.schedule.stats[e.id];
    const m = month.find(x => x.id === e.id);
    const hours = period === 'שבוע' ? wk.hours : Math.round(m.hours * (mult / 4.2));
    const shifts = period === 'שבוע' ? wk.shifts : Math.round(m.shifts * (mult / 4.2));
    return { ...e, hours, shifts };
  }).sort((a, b) => b.hours - a.hours);
  const maxH = Math.max(...rows.map(r => r.hours), 1);

  const totalShifts = rows.reduce((s, r) => s + r.shifts, 0);
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);

  return (
    <div>
      <ScreenHead kicker="מוקד אבטחה מרכז" title="דשבורד" right={<IconBtn name="bell" />} />

      <div style={{ marginBottom: 16 }}>
        <Segmented options={['שבוע', 'חודש', 'שנה']} value={period} onChange={setPeriod} />
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <Card pad={14}><Stat icon="users" value={EMPLOYEES.length} label="עובדים פעילים" /></Card>
        <Card pad={14}><Stat icon="calendar" value={totalShifts} label={`משמרות ה${period}`} color="#13A98E" /></Card>
        <Card pad={14}><Stat icon="clock" value={totalHours.toLocaleString()} label={`שעות ה${period}`} color="#E0902A" /></Card>
        <Card pad={14}><Stat icon="shield" value={`${ctx.schedule.coverage}%`} label="כיסוי השיבוץ" color={ctx.schedule.coverage >= 95 ? '#13A98E' : '#EB6A4E'} /></Card>
      </div>

      {/* Hours per employee */}
      <SectionTitle action="לפי שעות">שעות עבודה לפי עובד</SectionTitle>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {rows.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <Avatar name={r.name} color={r.color} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', flexShrink: 0 }}>{r.hours} ש׳ · {r.shifts} מ׳</span>
              </div>
              <div style={{ height: 7, borderRadius: 99, background: 'var(--surface-sunk)', overflow: 'hidden' }}>
                <div style={{ width: `${(r.hours / maxH) * 100}%`, height: '100%', borderRadius: 99, background: r.color, transition: 'width .5s ease' }} />
              </div>
            </div>
          </div>
        ))}
      </Card>

      {/* Role distribution */}
      <div style={{ height: 16 }} />
      <SectionTitle>פילוח לפי תפקיד · ה{period}</SectionTitle>
      <Card style={{ display: 'flex', gap: 8 }}>
        {ROLES.map((role, i) => {
          const cnt = rows.reduce((s, r) => {
            const sl = ctx.schedule.assigned[r.id].filter(a => a.role === role).length;
            return s + Math.round(sl * (mult));
          }, 0);
          return (
            <React.Fragment key={role}>
              {i > 0 && <div style={{ width: 1, background: 'var(--border)' }} />}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: ROLE_META[role].color, letterSpacing: '-0.5px' }}>{cnt}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3, fontWeight: 600 }}>{role}</div>
              </div>
            </React.Fragment>
          );
        })}
      </Card>
    </div>
  );
}

// ── Manager: Scheduling (the magic) ──────────────────────────
function MgrSchedule({ ctx }) {
  const [phase, setPhase] = React.useState('idle'); // idle | running | done
  const [selDay, setSelDay] = React.useState(0);
  const [swap, setSwap] = React.useState(null); // {day, shift, role, empId}
  const submitted = EMPLOYEES.length; // all submitted in demo

  function runGenerate() {
    setPhase('running');
    setTimeout(() => { ctx.regenerate(); setPhase('done'); }, 2100);
  }

  if (phase === 'idle') {
    return (
      <div>
        <ScreenHead kicker={`שבוע ${WEEK_LABEL}`} title="שיבוץ אוטומטי" />
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="checkCircle" size={22} color="#13A98E" />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>כל הבקשות התקבלו</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>{submitted}/{EMPLOYEES.length}</span>
          </div>
          <div style={{ display: 'flex', marginTop: 14, marginInlineStart: -2 }}>
            {EMPLOYEES.map((e, i) => <div key={e.id} style={{ marginInlineStart: i ? -8 : 0, border: '2px solid var(--surface)', borderRadius: 99 }}><Avatar name={e.name} color={e.color} size={30} /></div>)}
          </div>
        </Card>

        <Card style={{ textAlign: 'center', padding: '28px 20px', marginBottom: 14, background: 'linear-gradient(160deg, var(--accent-soft), var(--surface))' }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 8px 22px var(--accent-soft)' }}>
            <Icon name="sparkles" size={30} stroke={1.8} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>בונים את הסידור עבורכם</div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5, maxWidth: 280, marginInline: 'auto' }}>
            המערכת תשבץ את העובדים לפי הבקשות, התפקידים הנדרשים וזמני המנוחה — תוך שניות.
          </div>
        </Card>

        <Btn variant="primary" size="lg" icon="sparkles" style={{ width: '100%' }} onClick={runGenerate}>צרו סידור אוטומטי</Btn>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, fontSize: 12.5, color: 'var(--text-3)' }}>
          <Icon name="shield" size={15} /> מתחשב במנוחה של {REST_HOURS} שעות בין משמרות
        </div>
      </div>
    );
  }

  if (phase === 'running') return <Generating />;

  // done — show schedule
  const sched = ctx.schedule;
  const dayWarn = sched.warnings.filter(w => w.day === selDay);

  return (
    <div>
      <ScreenHead kicker={`שבוע ${WEEK_LABEL}`} title="הסידור" right={
        <div style={{ textAlign: 'center', background: sched.coverage >= 95 ? 'rgba(19,169,142,0.12)' : 'rgba(235,106,78,0.12)', borderRadius: 'var(--r-md)', padding: '8px 13px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: sched.coverage >= 95 ? '#13A98E' : '#EB6A4E', lineHeight: 1 }}>{sched.coverage}%</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-2)', fontWeight: 600, marginTop: 2 }}>כיסוי</div>
        </div>
      } />

      {sched.warnings.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--r-md)', background: 'rgba(235,106,78,0.1)', marginBottom: 14 }}>
          <Icon name="alert" size={20} color="#EB6A4E" />
          <div style={{ fontSize: 13, color: 'var(--text)', flex: 1, lineHeight: 1.4 }}>
            נותרו <b>{sched.warnings.reduce((s, w) => s + w.missing, 0)}</b> משבצות לא מאוישות. ניתן להשלים ידנית או לאשר משמרות 12 שעות.
          </div>
        </div>
      )}

      {/* Day selector */}
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14, marginInline: -2 }}>
        {DAYS.map((d, i) => {
          const on = i === selDay;
          const warns = sched.warnings.some(w => w.day === i);
          return (
            <button key={i} onClick={() => setSelDay(i)} style={{
              flex: '0 0 auto', width: 50, padding: '9px 0', borderRadius: 'var(--r-md)', cursor: 'pointer',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
              background: on ? 'var(--accent)' : 'var(--surface)', position: 'relative',
              fontFamily: 'var(--font)', transition: 'all .12s ease',
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: on ? '#fff' : 'var(--text)' }}>{d.short}</div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: on ? 'rgba(255,255,255,0.8)' : 'var(--text-3)', marginTop: 1 }}>{d.date}</div>
              {warns && <span style={{ position: 'absolute', top: 6, insetInlineEnd: 7, width: 6, height: 6, borderRadius: 99, background: on ? '#fff' : '#EB6A4E' }} />}
            </button>
          );
        })}
      </div>

      {/* Shifts for selected day */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {SHIFT_ORDER.map(shift => {
          const m = SHIFT_META[shift];
          const req = ctx.requirements[shift];
          return (
            <Card key={shift} pad={0} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', background: m.soft }}>
                <ShiftDot shift={shift} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{m.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>{m.time}</div>
                </div>
              </div>
              <div style={{ padding: '6px 14px 12px' }}>
                {ROLES.map(role => {
                  const need = (req || {})[role] || 0;
                  if (!need) return null;
                  const filled = sched.grid[selDay][shift][role];
                  return (
                    <div key={role} style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                        <RoleChip role={role} size="sm" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: filled.length >= need ? '#13A98E' : '#EB6A4E' }}>{filled.length}/{need}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {filled.map(eid => {
                          const e = EMPLOYEES.find(x => x.id === eid);
                          return (
                            <button key={eid} onClick={() => setSwap({ day: selDay, shift, role, empId: eid })} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px 5px 7px', borderRadius: 99,
                              border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontFamily: 'var(--font)',
                            }}>
                              <Avatar name={e.name} color={e.color} size={24} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{e.name}</span>
                            </button>
                          );
                        })}
                        {Array.from({ length: Math.max(0, need - filled.length) }).map((_, k) => (
                          <button key={'e' + k} onClick={() => setSwap({ day: selDay, shift, role, empId: null })} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 99,
                            border: '1.5px dashed #EB6A4E', background: 'rgba(235,106,78,0.07)', color: '#EB6A4E', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
                          }}><Icon name="plus" size={15} stroke={2.2} /> לא מאויש</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {ROLES.every(role => !((req || {})[role])) && (
                  <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>אין דרישת איוש למשמרת זו</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ height: 14 }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="ghost" size="md" icon="sparkles" style={{ flex: 1 }} onClick={runGenerate}>צור מחדש</Btn>
        <Btn variant="primary" size="md" icon="check" style={{ flex: 1.4 }} onClick={() => { ctx.setPublished(true); ctx.flash('הסידור פורסם לכל העובדים'); }}>
          {ctx.published ? 'פורסם ✓' : 'פרסם סידור'}
        </Btn>
      </div>

      <Sheet open={!!swap} onClose={() => setSwap(null)} title="שיבוץ עובד">
        {swap && <SwapEditor ctx={ctx} swap={swap} onClose={() => setSwap(null)} />}
      </Sheet>
    </div>
  );
}

function Generating() {
  const steps = ['קורא בקשות עובדים', 'בודק תפקידים נדרשים', 'מאזן זמני מנוחה', 'משבץ משמרות'];
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 480);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '76%', textAlign: 'center' }}>
      <div className="genspin" style={{ width: 70, height: 70, borderRadius: 22, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px var(--accent-soft)' }}>
        <Icon name="sparkles" size={34} stroke={1.8} />
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', marginTop: 22 }}>בונה את הסידור…</div>
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 11, alignItems: 'stretch', width: 230 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: i <= step ? 1 : 0.35, transition: 'opacity .3s ease' }}>
            <span style={{ width: 22, height: 22, borderRadius: 99, flexShrink: 0, background: i < step ? '#13A98E' : (i === step ? 'var(--accent)' : 'var(--surface-sunk)'), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {i < step ? <Icon name="check" size={13} stroke={3} /> : <span style={{ width: 7, height: 7, borderRadius: 99, background: i === step ? '#fff' : 'var(--text-3)' }} />}
            </span>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', textAlign: 'start' }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SwapEditor({ ctx, swap, onClose }) {
  const { day, shift, role } = swap;
  const current = swap.empId;
  // available candidates: have role, not off, not already that day (except current), rest ok
  const taken = new Set();
  SHIFT_ORDER.forEach(s => ROLES.forEach(r => ctx.schedule.grid[day][s][r].forEach(id => taken.add(id))));
  const options = EMPLOYEES.filter(e => e.roles.includes(role)).map(e => {
    const req = ctx.requests[e.id][day];
    const busy = taken.has(e.id) && e.id !== current;
    const wanted = !req.off && req.shifts.includes(shift);
    return { e, off: req.off, busy, wanted };
  });
  function assign(eid) {
    ctx.assignSlot(day, shift, role, current, eid);
    onClose();
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, padding: '10px 12px', borderRadius: 'var(--r-md)', background: SHIFT_META[shift].soft }}>
        <ShiftDot shift={shift} size={32} />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{DAYS[day].name} · {SHIFT_META[shift].name} · </div>
        <RoleChip role={role} size="sm" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map(({ e, off, busy, wanted }) => {
          const disabled = off || busy;
          const isCur = e.id === current;
          return (
            <button key={e.id} disabled={disabled && !isCur} onClick={() => (isCur ? assign(null) : assign(e.id))} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', width: '100%', textAlign: 'start',
              borderRadius: 'var(--r-md)', fontFamily: 'var(--font)', transition: 'all .12s ease',
              border: `1.5px solid ${isCur ? 'var(--accent)' : 'var(--border)'}`,
              background: isCur ? 'var(--accent-soft)' : 'var(--surface)',
              cursor: (disabled && !isCur) ? 'default' : 'pointer', opacity: (disabled && !isCur) ? 0.45 : 1,
            }}>
              <Avatar name={e.name} color={e.color} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{e.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                  {off ? 'ביקש חופש' : busy ? 'משובץ במשמרת אחרת' : wanted ? '✓ ביקש משמרת זו' : 'זמין'}
                </div>
              </div>
              {isCur ? <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>משובץ</span>
                : wanted && !disabled ? <span style={{ width: 9, height: 9, borderRadius: 99, background: '#13A98E' }} /> : null}
            </button>
          );
        })}
      </div>
      {current && <><div style={{ height: 12 }} /><Btn variant="danger" size="md" icon="x" style={{ width: '100%' }} onClick={() => assign(null)}>הסר שיבוץ</Btn></>}
    </div>
  );
}

// ── Manager: Team ────────────────────────────────────────────
function MgrTeam({ ctx }) {
  const [open, setOpen] = React.useState(null);
  return (
    <div>
      <ScreenHead title="עובדים" right={<IconBtn name="plus" />} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {EMPLOYEES.map(e => {
          const st = ctx.schedule.stats[e.id];
          return (
            <Card key={e.id} interactive onClick={() => setOpen(e.id)} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <Avatar name={e.name} color={e.color} size={46} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{e.name}</div>
                <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                  {e.roles.map(r => <RoleChip key={r} role={r} size="sm" />)}
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: st.belowMin ? '#EB6A4E' : 'var(--text)' }}>{st.shifts}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 600 }}>מ׳ השבוע</div>
              </div>
              <Icon name="chevronLeft" size={18} color="var(--text-3)" />
            </Card>
          );
        })}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? EMPLOYEES.find(e => e.id === open).name : ''}>
        {open && <EmployeeEditor ctx={ctx} emp={EMPLOYEES.find(e => e.id === open)} />}
      </Sheet>
    </div>
  );
}

function EmployeeEditor({ ctx, emp }) {
  const [roles, setRoles] = React.useState(emp.roles);
  const [min, setMin] = React.useState(emp.minShifts);
  const st = ctx.schedule.stats[emp.id];
  function toggleRole(r) { setRoles(rs => rs.includes(r) ? rs.filter(x => x !== r) : [...rs, r]); }
  return (
    <div>
      <Card style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Stat value={st.shifts} label="משמרות השבוע" />
        <div style={{ width: 1, background: 'var(--border)' }} />
        <Stat value={st.hours} label="שעות השבוע" color="#13A98E" />
        <div style={{ width: 1, background: 'var(--border)' }} />
        <Stat value={emp.since} label="עובד מאז" color="#E0902A" />
      </Card>

      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 9 }}>תפקידים שהעובד יכול למלא</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {ROLES.map(r => {
          const on = roles.includes(r);
          return (
            <div key={r} onClick={() => toggleRole(r)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer',
              border: `1.5px solid ${on ? ROLE_META[r].color : 'var(--border)'}`, background: on ? ROLE_META[r].soft : 'var(--surface)', transition: 'all .12s ease',
            }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: ROLE_META[r].color }} />
              <span style={{ flex: 1, fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}>{r}</span>
              <Toggle checked={on} onChange={() => toggleRole(r)} />
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}>מינימום משמרות בשבוע</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>המערכת תבטיח לפחות {min} משמרות</div>
        </div>
        <Stepper value={min} onChange={setMin} min={0} max={7} />
      </div>

      <Btn variant="primary" size="lg" icon="check" style={{ width: '100%' }} onClick={() => { ctx.updateEmployee(emp.id, roles, min); ctx.flash('פרטי העובד עודכנו'); }}>שמירת שינויים</Btn>
    </div>
  );
}

// ── Manager: Settings (requirements) ─────────────────────────
function MgrSettings({ ctx }) {
  return (
    <div>
      <ScreenHead title="הגדרות שיבוץ" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', marginBottom: 16 }}>
        <Icon name="info" size={20} color="var(--accent)" />
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, flex: 1 }}>הגדירו כמה עובדים מכל תפקיד נדרשים בכל משמרת. המערכת תשבץ בהתאם.</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {SHIFT_ORDER.map(shift => {
          const m = SHIFT_META[shift];
          const req = ctx.requirements[shift];
          const total = ROLES.reduce((s, r) => s + (req[r] || 0), 0);
          return (
            <Card key={shift} pad={0} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', background: m.soft }}>
                <ShiftDot shift={shift} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{m.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>{m.time}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{total} עובדים</div>
              </div>
              <div style={{ padding: '4px 14px 10px' }}>
                {ROLES.map(role => (
                  <div key={role} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: role !== ROLES[ROLES.length - 1] ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 99, background: ROLE_META[role].color }} />
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{role}</span>
                    </div>
                    <Stepper value={req[role] || 0} min={0} max={6} onChange={(v) => ctx.setReq(shift, role, v)} />
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ height: 16 }} />
      <SectionTitle>כללי שיבוץ</SectionTitle>
      <Card pad={0} style={{ overflow: 'hidden' }}>
        {[
          { ic: 'clock', t: 'מנוחה מינימלית בין משמרות', d: '8 שעות' },
          { ic: 'shield', t: 'אישור משמרות 12 שעות בעת מחסור', d: 'מופעל' },
          { ic: 'calendar', t: 'מבנה משמרות', d: '3 משמרות · 8ש׳' },
        ].map((row, i, arr) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'var(--surface-sunk)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={row.ic} size={19} /></div>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{row.t}</div>
            <span style={{ fontSize: 13.5, color: 'var(--text-2)', fontWeight: 600 }}>{row.d}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function renderManager(tab, ctx) {
  switch (tab) {
    case 'mgr-dash': return <MgrDash ctx={ctx} />;
    case 'mgr-schedule': return <MgrSchedule ctx={ctx} />;
    case 'mgr-team': return <MgrTeam ctx={ctx} />;
    case 'mgr-settings': return <MgrSettings ctx={ctx} />;
    default: return null;
  }
}

Object.assign(window, { MGR_TABS, renderManager });
