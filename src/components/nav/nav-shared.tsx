'use client'

// Shared pieces for TopNav (bar) + NavDropdown (mobile menu).
import { useLinkStatus } from 'next/link'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'

export interface Tab {
  href: string
  label: string
  icon: IconName
}

export function isTabActive(pathname: string, href: string): boolean {
  if (href === '/me') return pathname === '/me'
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Tab icon that turns into a spinner while ITS link's navigation is pending —
 * instant per-tab feedback even before the next route's loading.tsx mounts.
 * Must be rendered as a child of the <Link> it reports on.
 */
export function TabIcon({ icon, size, stroke }: { icon: IconName; size: number; stroke: number }) {
  const { pending } = useLinkStatus()
  if (pending) return <Spinner size={size - 2} thickness={2} delayed />
  return <Icon name={icon} size={size} stroke={stroke} />
}

export function HamburgerIcon({ open }: { open: boolean }) {
  if (open) return <Icon name="x" size={24} stroke={2} />
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" />
    </svg>
  )
}

export const rowBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 'var(--r-md)',
  fontSize: 15,
  textDecoration: 'none',
  transition: 'background .12s ease, color .12s ease',
}
