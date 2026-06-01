'use client'

import { signOut } from '@/app/(auth)/actions'
import { Icon } from '@/components/ui/Icon'

export function NavLogout() {
  return (
    <form
      action={signOut}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        margin: 0,
        padding: 0,
      }}
    >
      <button
        type="submit"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '6px 2px',
          color: 'var(--text-3)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          width: '100%',
        }}
      >
        <Icon name="logout" size={24} stroke={1.8} />
        <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1 }}>התנתקות</span>
      </button>
    </form>
  )
}
