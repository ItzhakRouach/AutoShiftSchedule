/**
 * Isolates LTR content (hour ranges, numeric-only shift-variant names) inside
 * an RTL document. Without this, the Unicode bidi algorithm can flip a string
 * like '07:00–19:00' to read as '19:00–07:00', or swap '03–15' with '15–03'.
 */
export function LtrText({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span dir="ltr" style={{ unicodeBidi: 'isolate', ...style }}>
      {children}
    </span>
  )
}
