'use client'

// Phone/tablet tab bar: the primary navigation below 1024px (the desktop tab
// row in TopNav takes over above that — see `.bottom-nav` in globals.css).
import Link from 'next/link'
import { isTabActive, TabIcon, type Tab } from './nav-shared'

export function BottomNav({ tabs, pathname }: { tabs: Tab[]; pathname: string }) {
  return (
    <nav
      className="bottom-nav"
      aria-label="ניווט"
      style={{
        position: 'fixed', insetInline: 0, bottom: 0, zIndex: 100,
        gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--chrome)',
        backdropFilter: 'blur(18px) saturate(180%)',
        WebkitBackdropFilter: 'blur(18px) saturate(180%)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {tabs.map((tab) => {
        const active = isTabActive(pathname, tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              minHeight: 60, textDecoration: 'none',
              fontSize: 'var(--text-xs)', fontWeight: active ? 800 : 600,
              color: active ? 'var(--accent)' : 'var(--text-2)',
            }}
          >
            <TabIcon icon={tab.icon} size={22} stroke={active ? 2.2 : 1.8} />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
