'use client'

// Mobile hamburger dropdown: tab list + sign-out. Rendered by TopNav's TopBar.
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { signOut } from '@/app/(auth)/actions'
import { isTabActive, rowBase, TabIcon, type Tab } from './nav-shared'

export function NavDropdown({
  tabs,
  pathname,
  onClose,
}: {
  tabs: Tab[]
  pathname: string
  onClose: () => void
}) {
  return (
    <>
      <div
        onClick={onClose}
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
              onClick={onClose}
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
  )
}
