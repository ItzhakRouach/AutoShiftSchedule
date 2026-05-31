import React from 'react'

export type IconName =
  | 'users' | 'plus' | 'check' | 'x' | 'chevronLeft' | 'chevronRight'
  | 'phone' | 'shield' | 'sun' | 'moon' | 'minus' | 'arrowLeft'
  | 'edit' | 'logout' | 'info' | 'plane' | 'sunset' | 'checkCircle'
  | 'bell' | 'clock' | 'calendar' | 'chart' | 'grid' | 'settings'
  | 'home' | 'user' | 'swap' | 'alert' | 'trend' | 'sparkles'

interface IconProps {
  name: IconName
  size?: number
  stroke?: number
  color?: string
  style?: React.CSSProperties
}

export function Icon({ name, size = 22, stroke = 1.75, color = 'currentColor', style }: IconProps) {
  const p: React.SVGProps<SVGPathElement> & React.SVGProps<SVGCircleElement> = {
    fill: 'none', stroke: color, strokeWidth: stroke,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  const r = { fill: 'none' as const, stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  const paths: Record<IconName, React.ReactNode> = {
    users: <><circle {...p} cx="9" cy="8.5" r="3.3"/><path {...p} d="M3 19.5c.7-3.2 3.1-4.8 6-4.8s5.3 1.6 6 4.8"/><path {...p} d="M16.5 6.2a3.2 3.2 0 0 1 0 6.1M18 19.5c-.2-1.3-.6-2.4-1.3-3.3"/></>,
    plus: <path {...p} d="M12 5v14M5 12h14"/>,
    check: <path {...p} d="M5 12.5 10 17.5 19.5 7"/>,
    x: <path {...p} d="M6 6l12 12M18 6 6 18"/>,
    chevronLeft: <path {...p} d="M14.5 5 8 12l6.5 7"/>,
    chevronRight: <path {...p} d="M9.5 5 16 12l-6.5 7"/>,
    phone: <path {...p} d="M6.5 4h3l1.3 4-2 1.4a11 11 0 0 0 5 5l1.4-2 4 1.3v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4Z"/>,
    shield: <><path {...p} d="M12 3 19 6v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6Z"/><path {...p} d="M9 12l2 2 4-4"/></>,
    sun: <><circle {...p} cx="12" cy="12" r="4"/><path {...p} d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></>,
    moon: <path {...p} d="M20 13.5A7.5 7.5 0 1 1 10.5 4a6 6 0 0 0 9.5 9.5Z"/>,
    minus: <path {...p} d="M5 12h14"/>,
    arrowLeft: <path {...p} d="M19 12H5M11 6l-6 6 6 6"/>,
    edit: <><path {...p} d="M5 19h3l9.5-9.5a2 2 0 0 0-3-3L5 16v3Z"/><path {...p} d="M14 6.5l3 3"/></>,
    logout: <><path {...p} d="M15 5h-5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5"/><path {...p} d="M18 12H9.5M15.5 9 18 12l-2.5 3"/></>,
    info: <><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M12 11v5M12 8v.1"/></>,
    plane: <path {...p} d="M21 15.5 3.5 11V8.8l2 .6L8 7.2l-1.5-4 2-1 3.2 3.7 5.3-1.4a1.8 1.8 0 0 1 1 3.4L13 11.8l1 5.7-1.8 1-2-4.3-4 2.4Z"/>,
    sunset: <path {...p} d="M12 4v6M9 7l3 3 3-3M3 17h2.5M18.5 17H21M6.5 17a5.5 5.5 0 0 1 11 0M3 21h18"/>,
    checkCircle: <><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M8 12.2 11 15.2 16.2 9.4"/></>,
    bell: <><path {...p} d="M6.5 10a5.5 5.5 0 0 1 11 0c0 5 1.5 6.5 1.5 6.5H5s1.5-1.5 1.5-6.5Z"/><path {...p} d="M10 19.5a2 2 0 0 0 4 0"/></>,
    clock: <><circle {...p} cx="12" cy="12" r="8.5"/><path {...p} d="M12 7v5.2l3.4 2"/></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"/><path {...p} d="M3.5 9.5h17M8 3v3.5M16 3v3.5"/></>,
    chart: <><path {...p} d="M4 20h16"/><rect x="5.5" y="11" width="3.4" height="6" rx="1" {...r}/><rect x="10.5" y="7" width="3.4" height="10" rx="1" {...r}/><rect x="15.5" y="13" width="3.4" height="4" rx="1" {...r}/></>,
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.6" {...r}/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" {...r}/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" {...r}/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" {...r}/></>,
    settings: <><circle {...p} cx="12" cy="12" r="3"/><path {...p} d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6"/></>,
    home: <><path {...p} d="M4 11.5 12 4l8 7.5"/><path {...p} d="M6 10v9.5h12V10"/></>,
    user: <><circle {...p} cx="12" cy="8.5" r="3.8"/><path {...p} d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></>,
    swap: <path {...p} d="M7 7h11l-3-3M17 17H6l3 3"/>,
    alert: <><path {...p} d="M12 4 21 19.5H3L12 4Z"/><path {...p} d="M12 10v4.2M12 17.2v.1"/></>,
    trend: <><path {...p} d="M4 16l5-5 3 3 7-7"/><path {...p} d="M16 7h3v3"/></>,
    sparkles: <><path {...p} d="M12 3.5 13.7 9 19 10.7 13.7 12.4 12 18 10.3 12.4 5 10.7 10.3 9Z"/><path {...p} d="M18.5 4.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/></>,
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0, ...style }}>
      {paths[name] ?? null}
    </svg>
  )
}
