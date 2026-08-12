'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { signOut } from '@/app/(auth)/actions'
import { WorkplaceSwitcher } from './WorkplaceSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { NavDropdown } from './NavDropdown'
import { HamburgerIcon, TabIcon, isTabActive, type Tab } from './nav-shared'

const MANAGER_TABS: Tab[] = [
  { href: '/dashboard', label: 'דשבורד', icon: 'chart' },
  { href: '/schedule', label: 'סידור עבודה', icon: 'grid' },
  { href: '/team', label: 'עובדים', icon: 'users' },
  { href: '/settings', label: 'הגדרות', icon: 'settings' },
]

const EMPLOYEE_TABS: Tab[] = [
  { href: '/me', label: 'בית', icon: 'home' },
  { href: '/me/schedule', label: 'סידור', icon: 'grid' },
  { href: '/me/requests', label: 'בקשות', icon: 'calendar' },
]

function TopBar({ tabs, centerSlot }: { tabs: Tab[]; centerSlot?: React.ReactNode }) {
  const pathname = usePathname()
  // The menu closes via each item's onClick + the backdrop, so no route-change
  // effect is needed (and we avoid a setState-in-render/effect anti-pattern).
  const [open, setOpen] = useState(false)

  return (
    <header
      style={{
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--chrome)',
        backdropFilter: 'blur(18px) saturate(180%)',
        WebkitBackdropFilter: 'blur(18px) saturate(180%)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 16px',
          paddingTop: 'calc(10px + env(safe-area-inset-top))',
        }}
      >
        <button
          type="button"
          className="nav-hamburger"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="תפריט"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            background: open ? 'var(--accent-soft)' : 'var(--surface)',
            color: open ? 'var(--accent)' : 'var(--text)',
            cursor: 'pointer',
          }}
        >
          <HamburgerIcon open={open} />
        </button>

        {/* Desktop: persistent inline tab bar (hidden on mobile via CSS). */}
        <nav className="nav-tabs-desktop" aria-label="ניווט">
          {tabs.map((tab) => {
            const active = isTabActive(pathname, tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="nav-tab"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 'var(--r-md)',
                  fontSize: 14.5,
                  fontWeight: active ? 700 : 600,
                  textDecoration: 'none',
                  color: active ? 'var(--accent)' : 'var(--text-2)',
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  transition: 'background .12s ease, color .12s ease',
                }}
              >
                <TabIcon icon={tab.icon} size={18} stroke={active ? 2.2 : 1.8} />
                {tab.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          {centerSlot ?? (
            <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              מִשְׁמֶרֶת
            </span>
          )}
        </div>
        <ThemeToggle />
        {/* Desktop-only sign-out (the dropdown holds it on mobile). */}
        <form action={signOut} className="nav-desktop-only" style={{ margin: 0 }}>
          <button
            type="submit"
            aria-label="התנתקות"
            title="התנתקות"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text-2)', cursor: 'pointer',
            }}
          >
            <Icon name="logout" size={20} stroke={1.9} />
          </button>
        </form>
      </div>

      {open && <NavDropdown tabs={tabs} pathname={pathname} onClose={() => setOpen(false)} />}
    </header>
  )
}

export function ManagerTopNav({
  workplaces = [],
  activeWorkplaceId,
}: {
  workplaces?: { id: string; name: string }[]
  activeWorkplaceId?: string
}) {
  const centerSlot =
    workplaces.length > 0 && activeWorkplaceId ? (
      <WorkplaceSwitcher workplaces={workplaces} activeId={activeWorkplaceId} />
    ) : undefined
  return <TopBar tabs={MANAGER_TABS} centerSlot={centerSlot} />
}

export function EmployeeTopNav() {
  return <TopBar tabs={EMPLOYEE_TABS} />
}
