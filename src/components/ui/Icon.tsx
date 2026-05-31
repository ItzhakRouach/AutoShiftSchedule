import React from 'react'

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

interface IconProps {
  name: IconName
  size?: number
  stroke?: number
  color?: string
  style?: React.CSSProperties
}

export function Icon({ name, size = 22, stroke = 1.75, color = 'currentColor', style }: IconProps) {
  const p: React.SVGProps<SVGPathElement> & React.SVGProps<SVGCircleElement> = {
    fill: 'none',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  const paths: Record<IconName, React.ReactNode> = {
    users: (
      <>
        <circle {...p} cx="9" cy="8.5" r="3.3" />
        <path {...p} d="M3 19.5c.7-3.2 3.1-4.8 6-4.8s5.3 1.6 6 4.8" />
        <path {...p} d="M16.5 6.2a3.2 3.2 0 0 1 0 6.1M18 19.5c-.2-1.3-.6-2.4-1.3-3.3" />
      </>
    ),
    plus: <path {...p} d="M12 5v14M5 12h14" />,
    check: <path {...p} d="M5 12.5 10 17.5 19.5 7" />,
    x: <path {...p} d="M6 6l12 12M18 6 6 18" />,
    chevronLeft: <path {...p} d="M14.5 5 8 12l6.5 7" />,
    phone: (
      <path
        {...p}
        d="M6.5 4h3l1.3 4-2 1.4a11 11 0 0 0 5 5l1.4-2 4 1.3v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4Z"
      />
    ),
    shield: (
      <>
        <path {...p} d="M12 3 19 6v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6Z" />
        <path {...p} d="M9 12l2 2 4-4" />
      </>
    ),
    sun: (
      <>
        <circle {...p} cx="12" cy="12" r="4" />
        <path {...p} d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </>
    ),
    moon: <path {...p} d="M20 13.5A7.5 7.5 0 1 1 10.5 4a6 6 0 0 0 9.5 9.5Z" />,
    minus: <path {...p} d="M5 12h14" />,
    arrowLeft: <path {...p} d="M19 12H5M11 6l-6 6 6 6" />,
    edit: (
      <>
        <path {...p} d="M5 19h3l9.5-9.5a2 2 0 0 0-3-3L5 16v3Z" />
        <path {...p} d="M14 6.5l3 3" />
      </>
    ),
    logout: (
      <>
        <path {...p} d="M15 5h-5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5" />
        <path {...p} d="M18 12H9.5M15.5 9 18 12l-2.5 3" />
      </>
    ),
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {paths[name] ?? null}
    </svg>
  )
}
