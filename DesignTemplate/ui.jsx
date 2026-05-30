// ui.jsx — shared primitives + icon set (minimal stroke icons, currentColor)

function Icon({ name, size = 22, stroke = 1.75, style, color = 'currentColor' }) {
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home: <><path {...p} d="M4 11.5 12 4l8 7.5"/><path {...p} d="M6 10v9.5h12V10"/></>,
    calendar: <><rect {...p} x="3.5" y="5" width="17" height="15" rx="3"/><path {...p} d="M3.5 9.5h17M8 3v3.5M16 3v3.5"/></>,
    clipboard: <><rect {...p} x="5" y="5" width="14" height="16" rx="2.5"/><path {...p} d="M9 5V3.6A.6.6 0 0 1 9.6 3h4.8a.6.6 0 0 1 .6.6V5M9 11h6M9 15h4"/></>,
    user: <><circle {...p} cx="12" cy="8.5" r="3.8"/><path {...p} d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></>,
    users: <><circle {...p} cx="9" cy="8.5" r="3.3"/><path {...p} d="M3 19.5c.7-3.2 3.1-4.8 6-4.8s5.3 1.6 6 4.8"/><path {...p} d="M16.5 6.2a3.2 3.2 0 0 1 0 6.1M18 19.5c-.2-1.3-.6-2.4-1.3-3.3"/></>,
    grid: <><rect {...p} x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect {...p} x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect {...p} x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect {...p} x="13.5" y="13.5" width="7" height="7" rx="1.6"/></>,
    chart: <><path {...p} d="M4 20h16"/><rect {...p} x="5.5" y="11" width="3.4" height="6" rx="1"/><rect {...p} x="10.5" y="7" width="3.4" height="10" rx="1"/><rect {...p} x="15.5" y="13" width="3.4" height="4" rx="1"/></>,
    settings: <><circle {...p} cx="12" cy="12" r="3"/><path {...p} d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6"/></>,
    sun: <><circle {...p} cx="12" cy="12" r="4"/><path {...p} d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></>,
    sunset: <><path {...p} d="M12 4v6M9 7l3 3 3-3M3 17h2.5M18.5 17H21M6.5 17a5.5 5.5 0 0 1 11 0M3 21h18"/></>,
    moon: <><path {...p} d="M20 13.5A7.5 7.5 0 1 1 10.5 4a6 6 0 0 0 9.5 9.5Z"/></>,
    plane: <><path {...p} d="M21 15.5 3.5 11V8.8l2 .6L8 7.2l-1.5-4 2-1 3.2 3.7 5.3-1.4a1.8 1.8 0 0 1 1 3.4L13 11.8l1 5.7-1.8 1-2-4.3-4 2.4Z"/></>,
    check: <path {...p} d="M5 12.5 10 17.5 19.5 7"/>,
    checkCircle: <><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M8 12.2 11 15.2 16.2 9.4"/></>,
    plus: <path {...p} d="M12 5v14M5 12h14"/>,
    chevronLeft: <path {...p} d="M14.5 5 8 12l6.5 7"/>,
    chevronRight: <path {...p} d="M9.5 5 16 12l-6.5 7"/>,
    chevronDown: <path {...p} d="M5 9.5 12 16l7-6.5"/>,
    clock: <><circle {...p} cx="12" cy="12" r="8.5"/><path {...p} d="M12 7v5.2l3.4 2"/></>,
    bell: <><path {...p} d="M6.5 10a5.5 5.5 0 0 1 11 0c0 5 1.5 6.5 1.5 6.5H5s1.5-1.5 1.5-6.5Z"/><path {...p} d="M10 19.5a2 2 0 0 0 4 0"/></>,
    sparkles: <><path {...p} d="M12 3.5 13.7 9 19 10.7 13.7 12.4 12 18 10.3 12.4 5 10.7 10.3 9Z"/><path {...p} d="M18.5 4.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/></>,
    alert: <><path {...p} d="M12 4 21 19.5H3L12 4Z"/><path {...p} d="M12 10v4.2M12 17.2v.1"/></>,
    x: <path {...p} d="M6 6l12 12M18 6 6 18"/>,
    edit: <><path {...p} d="M5 19h3l9.5-9.5a2 2 0 0 0-3-3L5 16v3Z"/><path {...p} d="M14 6.5l3 3"/></>,
    swap: <><path {...p} d="M7 7h11l-3-3M17 17H6l3 3"/></>,
    logout: <><path {...p} d="M15 5h-5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5"/><path {...p} d="M18 12H9.5M15.5 9 18 12l-2.5 3"/></>,
    shield: <><path {...p} d="M12 3 19 6v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6Z"/><path {...p} d="M9 12l2 2 4-4"/></>,
    phone: <path {...p} d="M6.5 4h3l1.3 4-2 1.4a11 11 0 0 0 5 5l1.4-2 4 1.3v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4Z"/>,
    arrowLeft: <path {...p} d="M19 12H5M11 6l-6 6 6 6"/>,
    info: <><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M12 11v5M12 8v.1"/></>,
    minus: <path {...p} d="M5 12h14"/>,
    trend: <><path {...p} d="M4 16l5-5 3 3 7-7"/><path {...p} d="M16 7h3v3"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0, ...style }}>
      {paths[name] || null}
    </svg>
  );
}

// Card surface
function Card({ children, style, pad = 16, onClick, interactive }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)', borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
      padding: pad, boxSizing: 'border-box',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform .15s ease, box-shadow .15s ease',
      ...style,
    }}
    onMouseDown={interactive ? (e) => (e.currentTarget.style.transform = 'scale(0.985)') : undefined}
    onMouseUp={interactive ? (e) => (e.currentTarget.style.transform = 'scale(1)') : undefined}
    onMouseLeave={interactive ? (e) => (e.currentTarget.style.transform = 'scale(1)') : undefined}
    >{children}</div>
  );
}

// Pill button
function Btn({ children, onClick, variant = 'primary', size = 'md', icon, style, disabled }) {
  const sizes = {
    sm: { padding: '8px 14px', fontSize: 14, gap: 6, h: 36 },
    md: { padding: '12px 18px', fontSize: 15.5, gap: 8, h: 48 },
    lg: { padding: '15px 22px', fontSize: 17, gap: 9, h: 56 },
  }[size];
  const variants = {
    primary: { background: 'var(--accent)', color: '#fff', border: '1px solid transparent', boxShadow: '0 4px 14px var(--accent-soft)' },
    soft:    { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid transparent' },
    ghost:   { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' },
    outline: { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border-strong)' },
    danger:  { background: 'rgba(220,70,70,0.12)', color: '#D8423B', border: '1px solid transparent' },
  }[variant];
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      gap: sizes.gap, padding: sizes.padding, minHeight: sizes.h,
      fontFamily: 'var(--font)', fontSize: sizes.fontSize, fontWeight: 600,
      borderRadius: 'var(--r-pill)', cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.45 : 1, width: style && style.width === '100%' ? '100%' : undefined,
      transition: 'transform .12s ease, filter .15s ease', WebkitTapHighlightColor: 'transparent',
      ...variants, ...style,
    }}
    onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = 'scale(0.97)')}
    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 17 : 19} stroke={2} />}
      {children}
    </button>
  );
}

// Role chip
function RoleChip({ role, size = 'md', selected, onClick, faded }) {
  const m = ROLE_META[role];
  const s = size === 'sm' ? { fs: 12, pad: '3px 9px' } : { fs: 13, pad: '5px 11px' };
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: s.pad, fontSize: s.fs, fontWeight: 600, borderRadius: 'var(--r-pill)',
      background: selected === false ? 'transparent' : m.soft,
      color: faded ? 'var(--text-3)' : m.color,
      border: `1px solid ${selected === false ? 'var(--border)' : 'transparent'}`,
      cursor: onClick ? 'pointer' : 'default', whiteSpace: 'nowrap',
      opacity: faded ? 0.5 : 1, transition: 'all .12s ease',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: faded ? 'var(--text-3)' : m.color }} />
      {m.short}
    </span>
  );
}

// Avatar
function Avatar({ name, color, size = 40, ring }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: 99, flexShrink: 0,
      background: color, color: '#fff', fontWeight: 700, fontSize: size * 0.38,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: ring ? `0 0 0 3px var(--surface), 0 0 0 ${size > 50 ? 5 : 4}px ${color}` : 'none',
      letterSpacing: '-0.5px',
    }}>{initials}</div>
  );
}

// Small shift glyph (colored)
function ShiftDot({ shift, size = 30, active = true }) {
  const m = SHIFT_META[shift];
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--r-sm)', flexShrink: 0,
      background: active ? m.soft : 'var(--surface-sunk)',
      color: active ? m.color : 'var(--text-3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={m.icon} size={size * 0.58} stroke={2} />
    </div>
  );
}

// Section header
function SectionTitle({ children, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 2px 10px' }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>{children}</h3>
      {action && <button onClick={onAction} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--font)', cursor: 'pointer', padding: 0 }}>{action}</button>}
    </div>
  );
}

// Stat block
function Stat({ value, label, sub, color, icon }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {icon && <div style={{ marginBottom: 7, color: color || 'var(--accent)' }}><Icon name={icon} size={19} stroke={2} /></div>}
      <div style={{ fontSize: 25, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.8px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: color || 'var(--text-3)', marginTop: 2, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

// Bottom sheet
function Sheet({ open, onClose, children, title }) {
  const [render, setRender] = React.useState(open);
  React.useEffect(() => { if (open) setRender(true); }, [open]);
  if (!render) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'var(--scrim)',
        opacity: open ? 1 : 0, transition: 'opacity .25s ease',
        backdropFilter: 'blur(1.5px)', WebkitBackdropFilter: 'blur(1.5px)',
      }} onTransitionEnd={() => { if (!open) setRender(false); }} />
      <div style={{
        position: 'relative', background: 'var(--surface)',
        borderTopLeftRadius: 26, borderTopRightRadius: 26,
        boxShadow: '0 -10px 40px rgba(0,0,0,0.18)', padding: '10px 18px 26px',
        transform: open ? 'translateY(0)' : 'translateY(102%)',
        transition: 'transform .3s cubic-bezier(.22,1,.36,1)', maxHeight: '78%', overflowY: 'auto',
      }}>
        <div style={{ width: 38, height: 5, borderRadius: 99, background: 'var(--border-strong)', margin: '0 auto 14px' }} />
        {title && <h2 style={{ margin: '0 0 14px', fontSize: 19, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

// Toggle switch
function Toggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} style={{
      width: 46, height: 28, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 3,
      background: checked ? 'var(--accent)' : 'var(--border-strong)', transition: 'background .2s ease',
      display: 'flex', justifyContent: checked ? 'flex-start' : 'flex-end',
    }}>
      <span style={{ width: 22, height: 22, borderRadius: 99, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'all .2s ease' }} />
    </button>
  );
}

// Segmented control
function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--surface-sunk)', borderRadius: 'var(--r-pill)' }}>
      {options.map(o => {
        const val = typeof o === 'string' ? o : o.value;
        const lbl = typeof o === 'string' ? o : o.label;
        const on = val === value;
        return (
          <button key={val} onClick={() => onChange(val)} style={{
            flex: 1, padding: '7px 4px', fontFamily: 'var(--font)', fontSize: 13.5, fontWeight: 600,
            border: 'none', borderRadius: 'var(--r-pill)', cursor: 'pointer',
            background: on ? 'var(--surface)' : 'transparent',
            color: on ? 'var(--text)' : 'var(--text-2)',
            boxShadow: on ? 'var(--shadow)' : 'none', transition: 'all .15s ease',
          }}>{lbl}</button>
        );
      })}
    </div>
  );
}

// Stepper
function Stepper({ value, onChange, min = 0, max = 9 }) {
  const btn = (dir, ic) => (
    <button onClick={() => onChange(Math.max(min, Math.min(max, value + dir)))} style={{
      width: 32, height: 32, borderRadius: 99, border: '1px solid var(--border)', background: 'var(--surface)',
      color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}><Icon name={ic} size={16} stroke={2.2} /></button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {btn(-1, 'minus')}
      <span style={{ minWidth: 18, textAlign: 'center', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{value}</span>
      {btn(1, 'plus')}
    </div>
  );
}

Object.assign(window, {
  Icon, Card, Btn, RoleChip, Avatar, ShiftDot, SectionTitle, Stat, Sheet, Toggle, Segmented, Stepper,
});
