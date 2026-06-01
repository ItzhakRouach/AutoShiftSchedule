'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from '@/components/ui/Icon'
import { NavLogout } from './NavLogout'

interface Tab {
  href: string
  label: string
  icon: IconName
}

const MANAGER_TABS: Tab[] = [
  { href: '/dashboard', label: 'דשבורד', icon: 'chart' },
  { href: '/schedule', label: 'שיבוץ', icon: 'grid' },
  { href: '/team', label: 'עובדים', icon: 'users' },
  { href: '/settings', label: 'הגדרות', icon: 'settings' },
]

const EMPLOYEE_TABS: Tab[] = [
  { href: '/me', label: 'בית', icon: 'home' },
  { href: '/me/requests', label: 'בקשות', icon: 'calendar' },
]

function NavBar({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname()

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        padding: '8px 10px calc(8px + env(safe-area-inset-bottom))',
        background: 'var(--chrome)',
        backdropFilter: 'blur(18px) saturate(180%)',
        WebkitBackdropFilter: 'blur(18px) saturate(180%)',
        borderTop: '1px solid var(--border)',
        position: 'sticky',
        bottom: 0,
        zIndex: 100,
      }}
    >
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href ||
          (tab.href !== '/me' && pathname.startsWith(tab.href + '/')) ||
          (tab.href === '/me' && pathname === '/me')
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '6px 2px',
              color: isActive ? 'var(--accent)' : 'var(--text-3)',
              textDecoration: 'none',
              transition: 'color .15s ease',
            }}
          >
            <Icon name={tab.icon} size={24} stroke={isActive ? 2.2 : 1.8} />
            <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 600, lineHeight: 1 }}>
              {tab.label}
            </span>
          </Link>
        )
      })}
      <NavLogout />
    </div>
  )
}

export function ManagerBottomNav() {
  return <NavBar tabs={MANAGER_TABS} />
}

export function EmployeeBottomNav() {
  return <NavBar tabs={EMPLOYEE_TABS} />
}
