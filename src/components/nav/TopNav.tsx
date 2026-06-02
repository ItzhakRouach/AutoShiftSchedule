'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'
import { signOut } from '@/app/(auth)/actions'

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

function isTabActive(pathname: string, href: string): boolean {
  if (href === '/me') return pathname === '/me'
  return pathname === href || pathname.startsWith(href + '/')
}

function HamburgerIcon({ open }: { open: boolean }) {
  if (open) return <Icon name="x" size={24} stroke={2} />
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" />
    </svg>
  )
}

function TopBar({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Collapse the menu whenever the route changes (adjust state during render —
  // the React-sanctioned pattern, avoids an effect + cascading renders).
  const [navPath, setNavPath] = useState(pathname)
  if (navPath !== pathname) {
    setNavPath(pathname)
    setOpen(false)
  }

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
          justifyContent: 'space-between',
          padding: '10px 16px calc(10px)',
          paddingTop: 'calc(10px + env(safe-area-inset-top))',
        }}
      >
        <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          מִשְׁמֶרֶת
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="תפריט"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            background: open ? 'var(--accent-soft)' : 'var(--surface)',
            color: open ? 'var(--accent)' : 'var(--text)',
            cursor: 'pointer',
          }}
        >
          <HamburgerIcon open={open} />
        </button>
      </div>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              top: 0,
              background: 'rgba(0,0,0,0.18)',
              zIndex: -1,
            }}
          />
          <nav
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '8px 12px 14px',
              borderTop: '1px solid var(--border)',
            }}
          >
            {tabs.map((tab) => {
              const active = isTabActive(pathname, tab.href)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 'var(--r-md)',
                    textDecoration: 'none',
                    color: active ? 'var(--accent)' : 'var(--text)',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    fontWeight: active ? 700 : 600,
                    fontSize: 15,
                  }}
                >
                  <Icon name={tab.icon} size={22} stroke={active ? 2.2 : 1.8} />
                  {tab.label}
                </Link>
              )
            })}

            <form action={signOut} style={{ margin: 0 }}>
              <button
                type="submit"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 'var(--r-md)',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-2)',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'right',
                }}
              >
                <Icon name="logout" size={22} stroke={1.8} />
                התנתקות
              </button>
            </form>
          </nav>
        </>
      )}
    </header>
  )
}

export function ManagerTopNav() {
  return <TopBar tabs={MANAGER_TABS} />
}

export function EmployeeTopNav() {
  return <TopBar tabs={EMPLOYEE_TABS} />
}
