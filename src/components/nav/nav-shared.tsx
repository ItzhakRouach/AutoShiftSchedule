'use client'

// Shared pieces for TopNav (desktop tab row) + BottomNav (phone tab bar).
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
