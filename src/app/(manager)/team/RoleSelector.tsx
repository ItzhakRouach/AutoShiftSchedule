'use client'

import React from 'react'
import { Toggle } from '@/components/ui/Toggle'
import type { RoleOption } from './EmployeeEditor'

interface RoleSelectorProps {
  roles: RoleOption[]
  selectedRoleIds: Set<string>
  onToggle: (roleId: string) => void
  error?: string
}

const fieldErrorStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: '#D8423B',
  marginTop: 4,
}

export function RoleSelector({ roles, selectedRoleIds, onToggle, error }: RoleSelectorProps) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 9 }}>
        תפקידים שהעובד יכול למלא
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {roles.map((role) => {
          const on = selectedRoleIds.has(role.id)
          return (
            <div
              key={role.id}
              onClick={() => onToggle(role.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 'var(--r-md)',
                cursor: 'pointer',
                border: `1.5px solid ${on ? role.color : 'var(--border)'}`,
                background: on ? `${role.color}22` : 'var(--surface)',
                transition: 'all .12s ease',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 99,
                  background: role.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}>
                {role.name}
              </span>
              <Toggle checked={on} onChange={() => onToggle(role.id)} />
            </div>
          )
        })}
      </div>
      {error && <p style={fieldErrorStyle}>{error}</p>}
      {/* Hidden inputs carry selected role IDs into FormData */}
      {[...selectedRoleIds].map((rid) => (
        <input key={rid} type="hidden" name="roleIds" value={rid} />
      ))}
    </div>
  )
}
