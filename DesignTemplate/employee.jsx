// employee.jsx — employee-side screens

const EMP_TABS = [
  { id: 'emp-home', label: 'בית', icon: 'home' },
  { id: 'emp-requests', label: 'בקשות', icon: 'calendar' },
  { id: 'emp-schedule', label: 'הסידור שלי', icon: 'clipboard' },
  { id: 'emp-profile', label: 'פרופיל', icon: 'user' },
];

function ScreenHead({ kicker, title, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '6px 2px 18px' }}>
      <div>
        {kicker && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 3 }}>{kicker}</div>}
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.8px' }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}

function IconBtn({ name, onClick, badge }) {
  return (
    <button onClick={onClick} style={{
      width: 44, height: 44, borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
      background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow)',
    }}>
      <Icon name={name} size={21} />
      {badge && <span style={{ position: 'absolute', top: 9, insetInlineStart: 11, width: 8, height: 8, borderRadius: 99, background: '#EB5757', border: '2px solid var(--surface)' }} />}
    </button>
  );
}

// ── Employee: Home ───────────────────────────────────────────
function EmpHome({ ctx }) {
  const me = EMPLOYEES.find(e => e.id === ME_ID);
  const myReq = ctx.requests[ME_ID];
  const filled = myReq.filter(d => d.off || d.shifts.length).length;
  const mySched = ctx.schedule.assigned[ME_ID];
  const myHours = mySched.reduce((s, a) => s + SHIFT_META[a.shift].hours, 0);
  const next = ctx.published ? mySched.slice().sort((a, b) => a.day - b.day || SHIFT_META[a.shift].start - SHIFT_META[b.shift].start)[0] : null;

  return (
    <div>
      <ScreenHead kicker="ערב טוב 👋" title={me.name.split(' ')[0]} right={
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn name="bell" badge />
          <Avatar name={me.name} color={me.color} size={44} />
        </div>
      } />

      {/* Requests status */}
      <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '16px 16px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>הזנת בקשות · שבוע {WEEK_LABEL}</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.4px' }}>
                {filled === 7 ? 'כל הימים מולאו' : `מולאו ${filled} מתוך 7 ימים`}
              </div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#D98324', background: 'rgba(217,131,36,0.13)', padding: '5px 10px', borderRadius: 99 }}>
              <Icon name="clock" size={14} stroke={2.2} /> עד חמישי
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-sunk)', marginTop: 14, overflow: 'hidden' }}>
            <div style={{ width: `${(filled / 7) * 100}%`, height: '100%', borderRadius: 99, background: 'var(--accent)', transition: 'width .4s ease' }} />
          </div>
        </div>
        <button onClick={() => ctx.setTab('emp-requests')} style={{
          width: '100%', padding: '14px', border: 'none', borderTop: '1px solid var(--border)',
          background: 'var(--surface-2)', color: 'var(--accent)', fontFamily: 'var(--font)',
          fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {filled === 7 ? 'עריכת הבקשות' : 'המשך הזנת בקשות'} <Icon name="arrowLeft" size={18} stroke={2} />
        </button>
      </Card>

      {/* Next shift */}
      <SectionTitle>המשמרת הקרובה</SectionTitle>
      {next ? (
        <Card style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <ShiftDot shift={next.shift} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
              {DAYS[next.day].name} · משמרת {SHIFT_META[next.shift].name}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{SHIFT_META[next.shift].time}</span>
              <span style={{ width: 3, height: 3, borderRadius: 9, background: 'var(--text-3)' }} />
              <RoleChip role={next.role} size="sm" />
            </div>
          </div>
        </Card>
      ) : (
        <Card style={{ marginBottom: 16, textAlign: 'center', color: 'var(--text-2)', fontSize: 14, padding: '22px 16px' }}>
          הסידור לשבוע הקרוב טרם פורסם
        </Card>
      )}

      {/* Stats */}
      <SectionTitle>סיכום השבוע</SectionTitle>
      <Card style={{ display: 'flex', gap: 8 }}>
        <Stat icon="clock" value={ctx.published ? myHours : '—'} label="שעות השבוע" />
        <div style={{ width: 1, background: 'var(--border)' }} />
        <Stat icon="calendar" value={ctx.published ? mySched.length : '—'} label="משמרות השבוע" color="#13A98E" />
        <div style={{ width: 1, background: 'var(--border)' }} />
        <Stat icon="trend" value="168" label="שעות החודש" color="#E0902A" />
      </Card>
    </div>
  );
}

// ── Employee: Requests ───────────────────────────────────────
function EmpRequests({ ctx }) {
  const [editDay, setEditDay] = React.useState(null);
  const myReq = ctx.requests[ME_ID];
  const filled = myReq.filter(d => d.off || d.shifts.length).length;
  const [toast, setToast] = React.useState(false);

  function update(dayIdx, next) {
    const copy = ctx.requests[ME_ID].map((d, i) => (i === dayIdx ? next : d));
    ctx.setRequests({ ...ctx.requests, [ME_ID]: copy });
  }

  return (
    <div>
      <ScreenHead kicker={`שבוע ${WEEK_LABEL}`} title="הבקשות שלי" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', marginBottom: 16 }}>
        <Icon name="info" size={20} color="var(--accent)" />
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, flex: 1 }}>
          לחצו על יום כדי לבחור משמרות מועדפות או לסמן יום חופש. ניתן לבחור יותר ממשמרת אחת.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {DAYS.map((d, i) => {
          const r = myReq[i];
          return (
            <Card key={i} pad={0} interactive onClick={() => setEditDay(i)} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px' }}>
                <div style={{ width: 46, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{d.date}</div>
                </div>
                <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />
                <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {r.off ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: '#C0598F', background: 'rgba(192,89,143,0.12)', padding: '6px 12px', borderRadius: 99 }}>
                      <Icon name="plane" size={16} stroke={2} /> יום חופש
                    </span>
                  ) : r.shifts.length ? (
                    SHIFT_ORDER.filter(s => r.shifts.includes(s)).map(s => (
                      <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: SHIFT_META[s].color, background: SHIFT_META[s].soft, padding: '6px 11px', borderRadius: 99 }}>
                        <Icon name={SHIFT_META[s].icon} size={15} stroke={2} /> {SHIFT_META[s].name}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 600 }}>טרם נבחר — הקישו להוספה</span>
                  )}
                </div>
                <Icon name="chevronLeft" size={18} color="var(--text-3)" />
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ height: 12 }} />
      <Btn variant="primary" size="lg" icon="check" style={{ width: '100%' }} onClick={() => { setToast(true); setTimeout(() => setToast(false), 2200); }}>
        שליחת הבקשות ({filled}/7)
      </Btn>

      {/* Day editor sheet */}
      <Sheet open={editDay !== null} onClose={() => setEditDay(null)} title={editDay !== null ? `${DAYS[editDay].name} · ${DAYS[editDay].date}` : ''}>
        {editDay !== null && (
          <DayEditor req={myReq[editDay]} onChange={(next) => update(editDay, next)} onDone={() => setEditDay(null)} />
        )}
      </Sheet>

      {toast && (
        <div style={{ position: 'absolute', bottom: 96, insetInline: 24, zIndex: 300, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 'var(--r-md)', background: '#13A98E', color: '#fff', boxShadow: 'var(--shadow-lift)', fontWeight: 700, fontSize: 15 }}>
          <Icon name="checkCircle" size={22} stroke={2} /> הבקשות נשלחו למנהל בהצלחה
        </div>
      )}
    </div>
  );
}

function DayEditor({ req, onChange, onDone }) {
  const off = req.off;
  function toggleShift(s) {
    if (off) return;
    const has = req.shifts.includes(s);
    onChange({ off: false, shifts: has ? req.shifts.filter(x => x !== s) : [...req.shifts, s] });
  }
  return (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>משמרות מועדפות</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {SHIFT_ORDER.map(s => {
          const m = SHIFT_META[s];
          const on = !off && req.shifts.includes(s);
          return (
            <button key={s} onClick={() => toggleShift(s)} style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px', textAlign: 'start',
              borderRadius: 'var(--r-md)', cursor: off ? 'default' : 'pointer', width: '100%',
              border: `1.5px solid ${on ? m.color : 'var(--border)'}`,
              background: on ? m.soft : 'var(--surface)', opacity: off ? 0.4 : 1,
              transition: 'all .12s ease', fontFamily: 'var(--font)',
            }}>
              <ShiftDot shift={s} size={42} active />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{m.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{m.time}</div>
              </div>
              <span style={{
                width: 24, height: 24, borderRadius: 99, flexShrink: 0,
                border: `2px solid ${on ? m.color : 'var(--border-strong)'}`,
                background: on ? m.color : 'transparent', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{on && <Icon name="check" size={15} stroke={3} />}</span>
            </button>
          );
        })}
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

      <button onClick={() => onChange({ off: !off, shifts: [] })} style={{
        display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px', width: '100%', textAlign: 'start',
        borderRadius: 'var(--r-md)', cursor: 'pointer', fontFamily: 'var(--font)',
        border: `1.5px solid ${off ? '#C0598F' : 'var(--border)'}`,
        background: off ? 'rgba(192,89,143,0.1)' : 'var(--surface)', transition: 'all .12s ease',
      }}>
        <div style={{ width: 42, height: 42, borderRadius: 'var(--r-sm)', background: 'rgba(192,89,143,0.13)', color: '#C0598F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plane" size={22} stroke={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>יום חופש / לא זמין</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>לא אשובץ ביום זה</div>
        </div>
        <span style={{ width: 24, height: 24, borderRadius: 99, flexShrink: 0, border: `2px solid ${off ? '#C0598F' : 'var(--border-strong)'}`, background: off ? '#C0598F' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{off && <Icon name="check" size={15} stroke={3} />}</span>
      </button>

      <div style={{ height: 18 }} />
      <Btn variant="primary" size="lg" style={{ width: '100%' }} onClick={onDone}>שמירה</Btn>
    </div>
  );
}

// ── Employee: My Schedule ────────────────────────────────────
function EmpSchedule({ ctx }) {
  const mySched = ctx.schedule.assigned[ME_ID].slice().sort((a, b) => a.day - b.day || SHIFT_META[a.shift].start - SHIFT_META[b.shift].start);
  const byDay = {};
  mySched.forEach(a => { (byDay[a.day] = byDay[a.day] || []).push(a); });
  const totalHours = mySched.reduce((s, a) => s + SHIFT_META[a.shift].hours, 0);

  if (!ctx.published) {
    return (
      <div>
        <ScreenHead kicker={`שבוע ${WEEK_LABEL}`} title="הסידור שלי" />
        <Card style={{ textAlign: 'center', padding: '40px 22px', marginTop: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 99, background: 'var(--surface-sunk)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Icon name="clock" size={30} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>הסידור טרם פורסם</div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>המנהל עדיין עובד על סידור העבודה לשבוע הקרוב.<br />תקבלו התראה ברגע שהוא יפורסם.</div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <ScreenHead kicker={`שבוע ${WEEK_LABEL}`} title="הסידור שלי" right={
        <div style={{ textAlign: 'center', background: 'var(--accent-soft)', borderRadius: 'var(--r-md)', padding: '8px 14px' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{totalHours}</div>
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>שעות</div>
        </div>
      } />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {DAYS.map((d, i) => {
          const items = byDay[i] || [];
          return (
            <Card key={i} style={{ display: 'flex', gap: 13, alignItems: items.length ? 'flex-start' : 'center', opacity: items.length ? 1 : 0.6 }}>
              <div style={{ width: 42, textAlign: 'center', flexShrink: 0, paddingTop: items.length ? 4 : 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{d.short}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{d.date}</div>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />
              <div style={{ flex: 1 }}>
                {items.length ? items.map((a, k) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: k ? '10px 0 0' : 0 }}>
                    <ShiftDot shift={a.shift} size={38} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{SHIFT_META[a.shift].name} · {SHIFT_META[a.shift].time}</div>
                      <div style={{ marginTop: 3 }}><RoleChip role={a.role} size="sm" /></div>
                    </div>
                  </div>
                )) : <div style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 600 }}>יום חופשי</div>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Employee: Profile ────────────────────────────────────────
function EmpProfile({ ctx }) {
  const me = EMPLOYEES.find(e => e.id === ME_ID);
  const ms = ctx.schedule.stats[ME_ID];
  return (
    <div>
      <ScreenHead title="פרופיל" />
      <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 14, padding: '24px 16px' }}>
        <Avatar name={me.name} color={me.color} size={76} />
        <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--text)', marginTop: 12 }}>{me.name}</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 2 }}>עובד מאז {me.since} · {me.phone}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {me.roles.map(r => <RoleChip key={r} role={r} />)}
        </div>
      </Card>

      <Card style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Stat value={me.minShifts} label="מינ׳ משמרות בשבוע" />
        <div style={{ width: 1, background: 'var(--border)' }} />
        <Stat value="168" label="שעות החודש" color="#13A98E" />
        <div style={{ width: 1, background: 'var(--border)' }} />
        <Stat value="21" label="משמרות החודש" color="#E0902A" />
      </Card>

      <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        {[
          { ic: 'plane', t: 'ימי חופשה וזמינות', d: 'נותרו 9 ימים' },
          { ic: 'bell', t: 'התראות', d: 'פעיל' },
          { ic: 'settings', t: 'העדפות', d: '' },
        ].map((row, i, arr) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'var(--surface-sunk)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={row.ic} size={19} /></div>
            <div style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color: 'var(--text)' }}>{row.t}</div>
            {row.d && <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{row.d}</span>}
            <Icon name="chevronLeft" size={17} color="var(--text-3)" />
          </div>
        ))}
      </Card>

      <Btn variant="ghost" size="md" icon="logout" style={{ width: '100%' }} onClick={ctx.logout}>החלפת משתמש / יציאה</Btn>
    </div>
  );
}

function renderEmployee(tab, ctx) {
  switch (tab) {
    case 'emp-home': return <EmpHome ctx={ctx} />;
    case 'emp-requests': return <EmpRequests ctx={ctx} />;
    case 'emp-schedule': return <EmpSchedule ctx={ctx} />;
    case 'emp-profile': return <EmpProfile ctx={ctx} />;
    default: return null;
  }
}

Object.assign(window, { EMP_TABS, renderEmployee, ScreenHead, IconBtn });
