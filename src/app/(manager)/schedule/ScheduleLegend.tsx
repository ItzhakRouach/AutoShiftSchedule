/** What the marks in the schedule grid mean — always visible above the table. */
export function ScheduleLegend() {
  const item: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6 }
  const box = (extra: React.CSSProperties): React.CSSProperties => ({ width: 14, height: 14, borderRadius: 4, boxSizing: 'border-box', flexShrink: 0, ...extra })
  return (
    <div data-testid="schedule-legend" style={{ direction: 'rtl', display: 'flex', flexWrap: 'wrap', gap: '6px 16px', margin: '0 0 10px', fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
      <span style={item}><strong style={{ color: 'var(--success)' }}>✓</strong>ביקש את המשמרת</span>
      <span style={item}><span style={box({ background: 'var(--warning-soft)', border: '1.5px solid var(--warning)' })} />משמרת 12 שעות</span>
      <span style={item}><span style={box({ background: 'var(--warning-soft)', border: '1.5px dashed var(--warning)' })} />מכוסה על ידי משמרת 12 שעות</span>
      <span style={item}><span style={box({ background: 'var(--danger-soft)', border: '1.5px solid var(--danger)' })} />לא מאויש</span>
      <span style={item}><span style={box({ boxShadow: 'inset 0 0 0 2px var(--danger)' })} />מנוחה קצרה מדי או חריגה ממקסימום</span>
    </div>
  )
}
