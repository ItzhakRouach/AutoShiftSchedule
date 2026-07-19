'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { RoleChip } from '@/components/ui/RoleChip'
import { Icon } from '@/components/ui/Icon'
import { PendingInviteButton } from './PendingInviteButton'
import type { EmployeeData, RoleOption } from './EmployeeEditor'

interface EmployeeCardProps {
  employee: EmployeeData
  roles: RoleOption[]
  onOpen: (emp: EmployeeData) => void
}

const pendingBadgeStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#E0902A', background: 'rgba(224,144,42,0.14)',
  padding: '2px 8px', borderRadius: 'var(--r-pill)', flexShrink: 0, cursor: 'help',
}

// Red (not amber): a role-less employee is silently excluded from the auto-scheduler
// and from cell-click suggestions — it needs the manager's action, not just a heads-up.
const noRoleBadgeStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: 11.5, fontWeight: 700, color: '#D8423B', background: 'rgba(216,66,59,0.12)',
  padding: '2px 9px', borderRadius: 'var(--r-pill)', cursor: 'help',
}

export function EmployeeCard({ employee: emp, roles, onOpen }: EmployeeCardProps) {
  const empRoles = roles.filter((r) => emp.roleIds.includes(r.id))
  const noRole = empRoles.length === 0

  return (
    <Card interactive onClick={() => onOpen(emp)} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <Avatar name={emp.name} color={emp.color} size={46} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {emp.name}
          </span>
          {emp.status === 'pending' && (
            <>
              <span title="העובד נוצר במערכת אך טרם הצטרף לאפליקציה." style={pendingBadgeStyle}>
                טרם הצטרף
              </span>
              <PendingInviteButton employeeId={emp.id} hasPhone={!!emp.phone} />
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {noRole ? (
            <span
              title="לעובד לא הוגדר תפקיד — הוא לא ישובץ בסידור האוטומטי ולא יוצע בלחיצה על תא. הגדירו לו תפקיד."
              style={noRoleBadgeStyle}
            >
              <Icon name="alert" size={12} color="#D8423B" stroke={2.2} /> ללא תפקיד
            </span>
          ) : (
            empRoles.map((r) => <RoleChip key={r.id} roleName={r.name} color={r.color} size="sm" />)
          )}
        </div>
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--text-2)', fontSize: 11, fontWeight: 600 }}>מינ׳ {emp.minShifts}</span>
        {emp.employmentType !== 'full' && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--r-pill)', background: 'var(--surface-sunk)', color: 'var(--text-3)' }}>
            {emp.employmentType === 'student' ? 'סטודנט' : 'חלקית'}
          </span>
        )}
      </div>
      <Icon name="chevronLeft" size={18} color="var(--text-3)" />
    </Card>
  )
}
