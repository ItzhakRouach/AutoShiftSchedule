// app.jsx — shell: role select, state, mobile frame, bottom nav, tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "indigo",
  "corners": "soft",
  "font": "assistant"
}/*EDITMODE-END*/;

const STAGE_BG = { light: '#E7E9ED', dark: '#0A0C10', warm: '#E9E1D4' };

// recompute derived schedule data after a manual edit
function recomputeSchedule(grid, requirements) {
  const assigned = {}; EMPLOYEES.forEach(e => (assigned[e.id] = []));
  DAYS.forEach((d, di) => SHIFT_ORDER.forEach(sh => ROLES.forEach(r => {
    grid[di][sh][r].forEach(id => assigned[id].push({ day: di, shift: sh, role: r }));
  })));
  const warnings = [];
  let need = 0, filled = 0;
  DAYS.forEach((d, di) => SHIFT_ORDER.forEach(sh => ROLES.forEach(r => {
    const n = (requirements[sh] || {})[r] || 0;
    const h = grid[di][sh][r].length;
    need += n; filled += Math.min(h, n);
    if (h < n) warnings.push({ day: di, shift: sh, role: r, missing: n - h });
  })));
  const stats = {};
  EMPLOYEES.forEach(e => {
    const list = assigned[e.id];
    stats[e.id] = { shifts: list.length, hours: list.reduce((s, a) => s + SHIFT_META[a.shift].hours, 0), belowMin: list.length < e.minShifts, byShift: list };
  });
  return { grid, assigned, warnings, stats, coverage: Math.round((filled / need) * 100), totalNeed: need, totalFilled: filled };
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [role, setRole] = React.useState(null);          // null | 'employee' | 'manager'
  const [tab, setTab] = React.useState('emp-home');
  const [requests, setRequests] = React.useState(() => buildRequests());
  const [requirements, setRequirements] = React.useState(() => JSON.parse(JSON.stringify(DEFAULT_REQUIREMENTS)));
  const [schedule, setSchedule] = React.useState(() => generateSchedule(buildRequests(), DEFAULT_REQUIREMENTS));
  const [published, setPublished] = React.useState(true);
  const [toast, setToast] = React.useState(null);
  const [, force] = React.useReducer(x => x + 1, 0);

  const themeVars = buildThemeVars(t);
  const statusDark = (THEMES[t.theme] || THEMES.light).statusDark;

  function flash(msg) { setToast(msg); setTimeout(() => setToast(null), 2200); }

  const ctx = {
    requests, setRequests, requirements, schedule, published, setPublished, setTab,
    regenerate: () => setSchedule(generateSchedule(requests, requirements)),
    setReq: (shift, role2, v) => setRequirements(r => ({ ...r, [shift]: { ...r[shift], [role2]: v } })),
    assignSlot: (day, shift, role2, fromId, toId) => {
      setSchedule(prev => {
        const grid = JSON.parse(JSON.stringify(prev.grid));
        const bucket = grid[day][shift][role2];
        let arr = fromId ? bucket.filter(id => id !== fromId) : bucket.slice();
        if (toId && !arr.includes(toId)) arr.push(toId);
        grid[day][shift][role2] = arr;
        return recomputeSchedule(grid, requirements);
      });
    },
    updateEmployee: (id, roles, min) => {
      const e = EMPLOYEES.find(x => x.id === id);
      e.roles = roles; e.minShifts = min; force();
    },
    logout: () => { setRole(null); },
    flash,
  };

  const tabs = role === 'manager' ? MGR_TABS : EMP_TABS;
  const stageBg = STAGE_BG[t.theme] || STAGE_BG.light;

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: stageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0', boxSizing: 'border-box', transition: 'background .3s ease' }}>
      <div dir="rtl" style={{
        ...themeVars,
        width: 392, height: 'min(852px, calc(100vh - 48px))',
        background: 'var(--bg)', borderRadius: 46, overflow: 'hidden', position: 'relative',
        boxShadow: '0 50px 100px rgba(0,0,0,0.30), 0 0 0 1px rgba(0,0,0,0.06), 0 0 0 11px rgba(20,22,28,0.92)',
        display: 'flex', flexDirection: 'column', color: 'var(--text)',
        fontFamily: 'var(--font)', WebkitFontSmoothing: 'antialiased',
      }}>
        <StatusBar dark={statusDark} />
        {role === null ? (
          <RoleSelect onPick={(r) => { setRole(r); setTab(r === 'manager' ? 'mgr-dash' : 'emp-home'); }} t={t} />
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ padding: '8px 18px 22px' }}>
                {role === 'manager' ? renderManager(tab, ctx) : renderEmployee(tab, ctx)}
              </div>
            </div>
            <BottomNav tabs={tabs} active={tab} onChange={setTab} />
          </>
        )}
        {toast && (
          <div style={{ position: 'absolute', bottom: 92, insetInline: 22, zIndex: 400, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 'var(--r-md)', background: '#13A98E', color: '#fff', boxShadow: 'var(--shadow-lift)', fontWeight: 700, fontSize: 14.5, animation: 'toastIn .3s ease' }}>
            <Icon name="checkCircle" size={21} stroke={2} /> {toast}
          </div>
        )}
      </div>

      <TweaksPanel>
        <TweakSection label="ערכת נושא" />
        <TweakRadio label="מצב" value={t.theme} options={[{ value: 'light', label: 'בהיר' }, { value: 'dark', label: 'כהה' }, { value: 'warm', label: 'חמים' }]} onChange={(v) => setTweak('theme', v)} />
        <TweakColor label="צבע ראשי" value={ACCENTS[t.accent]} options={Object.values(ACCENTS)} onChange={(v) => { const k = Object.keys(ACCENTS).find(key => ACCENTS[key] === v) || 'indigo'; setTweak('accent', k); }} />
        <TweakRadio label="פינות" value={t.corners} options={[{ value: 'soft', label: 'מעוגלות' }, { value: 'sharp', label: 'חדות' }]} onChange={(v) => setTweak('corners', v)} />
        <TweakSection label="טיפוגרפיה" />
        <TweakRadio label="גופן" value={t.font} options={[{ value: 'assistant', label: 'Assistant' }, { value: 'rubik', label: 'Rubik' }, { value: 'heebo', label: 'Heebo' }]} onChange={(v) => setTweak('font', v)} />
      </TweaksPanel>
    </div>
  );
}

// Minimal mobile status bar (neutral, web-app feel)
function StatusBar({ dark }) {
  const c = dark ? '#fff' : '#15161B';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 26px 6px', flexShrink: 0, color: c }}>
      <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.3px' }}>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="18" height="12" viewBox="0 0 18 12"><g fill={c}><rect x="0" y="7" width="3" height="5" rx="0.6"/><rect x="4.5" y="4.5" width="3" height="7.5" rx="0.6"/><rect x="9" y="2" width="3" height="10" rx="0.6"/><rect x="13.5" y="0" width="3" height="12" rx="0.6" opacity="0.4"/></g></svg>
        <svg width="22" height="12" viewBox="0 0 22 12"><rect x="0.5" y="0.5" width="18" height="11" rx="3" fill="none" stroke={c} strokeOpacity="0.4"/><rect x="2" y="2" width="13" height="8" rx="1.6" fill={c}/><rect x="19.5" y="4" width="2" height="4" rx="1" fill={c} opacity="0.5"/></svg>
      </div>
    </div>
  );
}

// Role selection (login)
function RoleSelect({ onPick, t }) {
  const accent = ACCENTS[t.accent];
  const card = (role, title, sub, icon, color) => (
    <button onClick={() => onPick(role)} style={{
      display: 'flex', alignItems: 'center', gap: 15, padding: '18px 18px', width: '100%', textAlign: 'start',
      borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: 'var(--surface)',
      boxShadow: 'var(--shadow)', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'transform .14s ease',
    }}
    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}>
      <div style={{ width: 54, height: 54, borderRadius: 'var(--r-md)', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={28} stroke={1.9} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 2 }}>{sub}</div>
      </div>
      <Icon name="chevronLeft" size={20} color="var(--text-3)" />
    </button>
  );
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 22px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: 34 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: `0 12px 30px ${hexToSoft(accent, 0.4)}` }}>
          <Icon name="shield" size={34} stroke={1.7} />
        </div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px' }}>מִשְׁמֶרֶת</h1>
        <p style={{ margin: '8px auto 0', fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.5, maxWidth: 250 }}>שיבוץ משמרות אוטומטי לפי בקשות העובדים, תפקידים וזמני מנוחה.</p>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 11, paddingInlineStart: 4 }}>בחרו כיצד להיכנס</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {card('manager', 'כניסת מנהל', 'דשבורד, שיבוץ אוטומטי וניהול עובדים', 'chart', accent)}
        {card('employee', 'כניסת עובד', 'הזנת בקשות וצפייה בסידור', 'user', '#13A98E')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 26, fontSize: 12, color: 'var(--text-3)' }}>
        <Icon name="info" size={14} /> דמו אינטראקטיבי · נתונים לדוגמה
      </div>
    </div>
  );
}

// Bottom navigation
function BottomNav({ tabs, active, onChange }) {
  return (
    <div style={{
      flexShrink: 0, display: 'flex', padding: '8px 10px calc(8px + env(safe-area-inset-bottom))',
      background: 'var(--chrome)', backdropFilter: 'blur(18px) saturate(180%)', WebkitBackdropFilter: 'blur(18px) saturate(180%)',
      borderTop: '1px solid var(--border)', position: 'relative', zIndex: 100,
    }}>
      {tabs.map(tb => {
        const on = tb.id === active;
        return (
          <button key={tb.id} onClick={() => onChange(tb.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 2px',
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
            color: on ? 'var(--accent)' : 'var(--text-3)', transition: 'color .15s ease',
          }}>
            <Icon name={tb.icon} size={24} stroke={on ? 2.2 : 1.8} />
            <span style={{ fontSize: 11, fontWeight: on ? 700 : 600 }}>{tb.label}</span>
          </button>
        );
      })}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
