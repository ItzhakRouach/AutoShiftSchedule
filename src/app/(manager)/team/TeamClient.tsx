'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { RoleChip } from '@/components/ui/RoleChip'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { EmployeeEditor, type EmployeeData, type RoleOption } from './EmployeeEditor'
import type { ShiftTypeOption } from './AvailabilityGrid'

interface TeamClientProps {
  employees: EmployeeData[]
  roles: RoleOption[]
  shiftTypes: ShiftTypeOption[]
}

export function TeamClient({ employees, roles, shiftTypes }: TeamClientProps) {
  const router = useRouter()
  const [sheetMode, setSheetMode] = useState<'add' | 'edit' | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null)

  const openAdd = () => {
    setSelectedEmployee(null)
    setSheetMode('add')
  }

  const openEdit = (emp: EmployeeData) => {
    setSelectedEmployee(emp)
    setSheetMode('edit')
  }

  const closeSheet = () => {
    setSheetMode(null)
    setSelectedEmployee(null)
  }

  const handleSuccess = useCallback(() => {
    closeSheet()
    router.refresh()
  }, [router])

  const sheetTitle =
    sheetMode === 'add'
      ? 'עובד חדש'
      : selectedEmployee?.name ?? 'עריכת עובד'

  return (
    <>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.4px',
          }}
        >
          עובדים
        </h1>
        <button
          onClick={openAdd}
          aria-label="הוסף עובד"
          style={{
            width: 42,
            height: 42,
            borderRadius: 99,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px var(--accent-soft)',
          }}
        >
          <Icon name="plus" size={22} stroke={2.2} color="#fff" />
        </button>
      </div>

      {/* Employee list */}
      {employees.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            color: 'var(--text-3)',
            fontSize: 15,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <div style={{ fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>
            אין עובדים עדיין
          </div>
          <div>לחצו על + כדי להוסיף את העובד הראשון</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {employees.map((emp) => {
            const empRoles = roles.filter((r) => emp.roleIds.includes(r.id))
            return (
              <Card
                key={emp.id}
                interactive
                onClick={() => openEdit(emp)}
                style={{ display: 'flex', alignItems: 'center', gap: 13 }}
              >
                <Avatar name={emp.name} color={emp.color} size={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {emp.name}
                    </span>
                    {emp.status === 'pending' && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#E0902A',
                          background: 'rgba(224,144,42,0.14)',
                          padding: '2px 8px',
                          borderRadius: 'var(--r-pill)',
                          flexShrink: 0,
                        }}
                      >
                        ממתין
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {empRoles.map((r) => (
                      <RoleChip key={r.id} roleName={r.name} color={r.color} size="sm" />
                    ))}
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
          })}
        </div>
      )}

      {/* Sheet */}
      <Sheet open={sheetMode !== null} onClose={closeSheet} title={sheetTitle}>
        {sheetMode !== null && (
          <EmployeeEditor
            roles={roles}
            shiftTypes={shiftTypes}
            employee={sheetMode === 'edit' ? (selectedEmployee ?? undefined) : undefined}
            onSuccess={handleSuccess}
          />
        )}
      </Sheet>
    </>
  )
}
