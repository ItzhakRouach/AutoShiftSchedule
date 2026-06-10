'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { signOut } from '@/app/(auth)/actions'
import { WorkplaceSwitcher } from './WorkplaceSwitcher'
import { ThemeToggle } from './ThemeToggle'

interface Tab {
  href: string
  label: string
  icon: IconName
}

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

function isTabActive(pathname: string, href: string): boolean {
  if (href === '/me') return pathname === '/me'
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Tab icon that turns into a spinner while ITS link's navigation is pending —
 * instant per-tab feedback even before the next route's loading.tsx mounts.
 * Must be rendered as a child of the <Link> it reports on.
 */
function TabIcon({ icon, size, stroke }: { icon: IconName; size: number; stroke: number }) {
  const { pending } = useLinkStatus()
  if (pending) return <Spinner size={size - 2} thickness={2} delayed />
  return <Icon name={icon} size={size} stroke={stroke} />
}

function HamburgerIcon({ open }: { open: boolean }) {
  if (open) return <Icon name="x" size={24} stroke={2} />
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" />
    </svg>
  )
}

const rowBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 'var(--r-md)',
  fontSize: 15,
  textDecoration: 'none',
  transition: 'background .12s ease, color .12s ease',
}

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

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 0 }}
          />
          <nav
            className="nav-dropdown"
            style={{
              position: 'absolute',
              insetInlineStart: 12,
              top: 'calc(100% + 6px)',
              zIndex: 2,
              width: 'min(280px, calc(100vw - 24px))',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-lift)',
            }}
          >
            {tabs.map((tab) => {
              const active = isTabActive(pathname, tab.href)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="nav-item"
                  onClick={() => setOpen(false)}
                  style={{
                    ...rowBase,
                    color: active ? 'var(--accent)' : 'var(--text)',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    fontWeight: active ? 700 : 600,
                  }}
                >
                  <TabIcon icon={tab.icon} size={22} stroke={active ? 2.2 : 1.8} />
                  {tab.label}
                </Link>
              )
            })}

            <div style={{ height: 1, background: 'var(--border)', margin: '6px 8px' }} />

            <form action={signOut} style={{ margin: 0 }}>
              <button
                type="submit"
                className="nav-logout"
                style={{
                  ...rowBase,
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-2)',
                  fontWeight: 600,
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
