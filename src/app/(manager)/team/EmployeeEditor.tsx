'use client'

import React, { useActionState, useState, useEffect } from 'react'
import { Btn } from '@/components/ui/Btn'
import { createEmployee, updateEmployee, deleteEmployee, type EmployeeActionState } from './actions'
import { EmployeeFields } from './EmployeeFields'
import { RoleSelector } from './RoleSelector'
import { EmployeeSettingsToggles } from './EmployeeSettingsToggles'

export interface RoleOption {
  id: string
  name: string
  color: string
}

export interface EmployeeData {
  id: string
  name: string
  phone: string | null
  color: string
  minShifts: number
  observesShabbat: boolean
  observesHolidays: boolean
  mustAccept: boolean
  roleIds: string[]
  status: string
}

interface EmployeeEditorProps {
  roles: RoleOption[]
  employee?: EmployeeData // undefined → create mode
  onSuccess: () => void
}

const initialState: EmployeeActionState = {}

export function EmployeeEditor({ roles, employee, onSuccess }: EmployeeEditorProps) {
  const isEdit = !!employee

  const [name, setName] = useState(employee?.name ?? '')
  const [phone, setPhone] = useState(employee?.phone ?? '')
  const [minShifts, setMinShifts] = useState(employee?.minShifts ?? 2)
  const [observesShabbat, setObservesShabbat] = useState(employee?.observesShabbat ?? false)
  const [observesHolidays, setObservesHolidays] = useState(employee?.observesHolidays ?? false)
  const [mustAccept, setMustAccept] = useState(employee?.mustAccept ?? false)
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(
    new Set(employee?.roleIds ?? []),
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const boundAction = isEdit ? updateEmployee.bind(null, employee!.id) : createEmployee
  const [state, formAction, isPending] = useActionState<EmployeeActionState, FormData>(
    boundAction,
    initialState,
  )

  useEffect(() => {
    if (state.ok) onSuccess()
  }, [state.ok, onSuccess])

  function toggleRole(roleId: string) {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) next.delete(roleId)
      else next.add(roleId)
      return next
    })
  }

  async function handleDelete() {
    if (!employee) return
    setDeleteError(null)
    const result = await deleteEmployee(employee.id)
    if (result.error) setDeleteError(result.error)
    else onSuccess()
  }

  const fieldErrorStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: '#D8423B',
    marginTop: 4,
    textAlign: 'center',
  }

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {state.error && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            background: 'rgba(220,70,70,0.1)',
            color: '#D8423B',
            fontSize: 14,
          }}
        >
          {state.error}
        </div>
      )}

      <EmployeeFields
        name={name}
        onNameChange={setName}
        phone={phone}
        onPhoneChange={setPhone}
        minShifts={minShifts}
        onMinShiftsChange={setMinShifts}
        nameError={state.fieldErrors?.name}
        phoneError={state.fieldErrors?.phone}
      />

      <RoleSelector
        roles={roles}
        selectedRoleIds={selectedRoleIds}
        onToggle={toggleRole}
        error={state.fieldErrors?.roleIds}
      />

      <EmployeeSettingsToggles
        observesShabbat={observesShabbat}
        setObservesShabbat={setObservesShabbat}
        observesHolidays={observesHolidays}
        setObservesHolidays={setObservesHolidays}
        mustAccept={mustAccept}
        setMustAccept={setMustAccept}
      />

      <Btn
        type="submit"
        variant="primary"
        size="lg"
        icon="check"
        style={{ width: '100%' }}
        disabled={isPending}
      >
        {isPending ? 'שומר…' : isEdit ? 'שמירת שינויים' : 'הוספת עובד'}
      </Btn>

      {isEdit && (
        <div>
          {!confirmDelete ? (
            <Btn
              type="button"
              variant="danger"
              size="md"
              icon="x"
              style={{ width: '100%' }}
              onClick={() => setConfirmDelete(true)}
            >
              מחיקת עובד
            </Btn>
          ) : (
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--r-md)',
                border: '1.5px solid rgba(220,70,70,0.4)',
                background: 'rgba(220,70,70,0.06)',
              }}
            >
              <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text)', textAlign: 'center' }}>
                האם למחוק את העובד לצמיתות?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn
                  type="button"
                  variant="ghost"
                  size="sm"
                  style={{ flex: 1 }}
                  onClick={() => setConfirmDelete(false)}
                >
                  ביטול
                </Btn>
                <Btn
                  type="button"
                  variant="danger"
                  size="sm"
                  style={{ flex: 1 }}
                  onClick={handleDelete}
                >
                  מחק
                </Btn>
              </div>
              {deleteError && <p style={fieldErrorStyle}>{deleteError}</p>}
            </div>
          )}
        </div>
      )}
    </form>
  )
}
