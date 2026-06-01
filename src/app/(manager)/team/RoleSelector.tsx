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
  // Role-rank hierarchy: a higher-ranked role auto-qualifies the employee for all
  // lower-ranked roles. Compute the max rank among EXPLICITLY selected roles; any
  // role at or below it that isn't explicitly selected is "auto-covered".
  let maxSelectedRank = 0
  for (const r of roles) {
    if (selectedRoleIds.has(r.id)) maxSelectedRank = Math.max(maxSelectedRank, r.rank)
  }
  const hasSenior = maxSelectedRank > 1

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 9 }}>
        תפקידים שהעובד יכול למלא
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {roles.map((role) => {
          const explicit = selectedRoleIds.has(role.id)
          const autoCovered = !explicit && role.rank < maxSelectedRank
          const on = explicit || autoCovered
          return (
            <div
              key={role.id}
              onClick={() => { if (!autoCovered) onToggle(role.id) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 'var(--r-md)',
                cursor: autoCovered ? 'default' : 'pointer',
                opacity: autoCovered ? 0.75 : 1,
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
                {autoCovered && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginInlineStart: 8 }}>
                    נכלל אוטומטית
                  </span>
                )}
              </span>
              <Toggle checked={on} disabled={autoCovered} onChange={() => onToggle(role.id)} />
            </div>
          )
        })}
      </div>
      {hasSenior && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
          תפקיד בכיר מכסה גם תפקידים נמוכים יותר.
        </p>
      )}
      {error && <p style={fieldErrorStyle}>{error}</p>}
      {/* Hidden inputs carry only the EXPLICITLY selected role IDs into FormData.
          The adapter's rank-expansion is the source of truth for eligibility. */}
      {[...selectedRoleIds].map((rid) => (
        <input key={rid} type="hidden" name="roleIds" value={rid} />
      ))}
    </div>
  )
}
