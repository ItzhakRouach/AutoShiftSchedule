'use client'

import { useSyncExternalStore } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'

type Theme = 'light' | 'dark' | 'warm'
const ORDER: Theme[] = ['light', 'dark', 'warm']
const ICON: Record<Theme, IconName> = { light: 'sun', dark: 'moon', warm: 'sunset' }
const LABEL: Record<Theme, string> = { light: 'בהיר', dark: 'כהה', warm: 'חמים' }

function current(): Theme {
  if (typeof document === 'undefined') return 'light'
  return (document.documentElement.getAttribute('data-theme') as Theme) || 'light'
}

// Tiny external store so the toggle re-renders on theme change without
// setState-in-effect — and stays SSR-safe (server snapshot = 'light').
const listeners = new Set<() => void>()
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Cycles light → dark → warm, persisting to localStorage (the no-FOUC script
 *  in the root layout applies it on the next load). */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => 'light' as Theme)

  function cycle() {
    const next = ORDER[(ORDER.indexOf(current()) + 1) % ORDER.length]
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('theme', next)
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l())
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`ערכת נושא: ${LABEL[theme]} (החלף)`}
      title={`ערכת נושא: ${LABEL[theme]}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text-2)',
        cursor: 'pointer',
      }}
    >
      <Icon name={ICON[theme]} size={20} stroke={1.9} />
    </button>
  )
}
