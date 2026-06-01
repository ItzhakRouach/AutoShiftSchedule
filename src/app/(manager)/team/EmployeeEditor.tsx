'use client'

import React, { useActionState, useState, useEffect } from 'react'
import { Btn } from '@/components/ui/Btn'
import { createEmployee, updateEmployee, deleteEmployee, type EmployeeActionState } from './actions'
import { EmployeeFields } from './EmployeeFields'
import { RoleSelector } from './RoleSelector'
import { EmployeeSettingsToggles } from './EmployeeSettingsToggles'
import { EmploymentTypeSelector } from './EmploymentTypeSelector'
import { AvailabilityGrid, type ShiftTypeOption } from './AvailabilityGrid'
import type { EmploymentType } from '@/lib/validation/employee'
import type { AvailabilityItem } from '@/lib/validation/employee'

export interface RoleOption {
  id: string
  name: string
  color: string
  rank: number
}

export interface EmployeeData {
  id: string
  name: string
  phone: string | null
  color: string
  minShifts: number
  maxShifts: number | null
  employmentType: EmploymentType
  observesShabbat: boolean
  observesHolidays: boolean
  mustAccept: boolean
  roleIds: string[]
  status: string
  availability: AvailabilityItem[] | null
}

interface EmployeeEditorProps {
  roles: RoleOption[]
  shiftTypes: ShiftTypeOption[]
  employee?: EmployeeData
  onSuccess: () => void
}

const initialState: EmployeeActionState = {}

/** Suggest min/max defaults when employment type changes */
function defaultsForType(type: EmploymentType): { min: number; max: number | null } {
  if (type === 'full') return { min: 5, max: null }
  if (type === 'student') return { min: 0, max: 3 }
  return { min: 0, max: null }
}

const errBoxStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 'var(--r-md)',
  background: 'rgba(220,70,70,0.1)',
  color: '#D8423B',
  fontSize: 14,
}

export function EmployeeEditor({ roles, shiftTypes, employee, onSuccess }: EmployeeEditorProps) {
  const isEdit = !!employee

  const [name, setName] = useState(employee?.name ?? '')
  const [phone, setPhone] = useState(employee?.phone ?? '')
  const [minShifts, setMinShifts] = useState(employee?.minShifts ?? 2)
  const [maxShifts, setMaxShifts] = useState<number | null>(employee?.maxShifts ?? null)
  const [employmentType, setEmploymentType] = useState<EmploymentType>(employee?.employmentType ?? 'full')
  // Single toggle: Shabbat observance implies holiday observance (shabbat || holidays → both true)
  const [observesShabbat, setObservesShabbat] = useState(
    (employee?.observesShabbat ?? false) || (employee?.observesHolidays ?? false),
  )
  const [mustAccept, setMustAccept] = useState(employee?.mustAccept ?? false)
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set(employee?.roleIds ?? []))
  const [availability, setAvailability] = useState<AvailabilityItem[] | null>(employee?.availability ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const boundAction = isEdit ? updateEmployee.bind(null, employee!.id) : createEmployee
  const [state, formAction, isPending] = useActionState<EmployeeActionState, FormData>(boundAction, initialState)

  useEffect(() => { if (state.ok) onSuccess() }, [state.ok, onSuccess])

  function toggleRole(roleId: string) {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) next.delete(roleId)
      else next.add(roleId)
      return next
    })
  }

  function handleEmploymentTypeChange(type: EmploymentType) {
    setEmploymentType(type)
    const d = defaultsForType(type)
    setMinShifts(d.min)
    setMaxShifts(d.max)
  }

  async function handleDelete() {
    if (!employee) return
    setDeleteError(null)
    const result = await deleteEmployee(employee.id)
    if (result.error) setDeleteError(result.error)
    else onSuccess()
  }

  const customAvailability = availability !== null

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {state.error && <div style={errBoxStyle}>{state.error}</div>}

      <EmploymentTypeSelector value={employmentType} onChange={handleEmploymentTypeChange} />

      <EmployeeFields
        name={name} onNameChange={setName}
        phone={phone} onPhoneChange={setPhone}
        minShifts={minShifts} onMinShiftsChange={setMinShifts}
        maxShifts={maxShifts} onMaxShiftsChange={setMaxShifts}
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
        observesShabbat={observesShabbat} setObservesShabbat={setObservesShabbat}
        mustAccept={mustAccept} setMustAccept={setMustAccept}
      />

      <AvailabilityGrid
        shiftTypes={shiftTypes}
        availability={availability}
        onChange={setAvailability}
      />

      {/* Hidden fields for form submission */}
      <input type="hidden" name="customAvailability" value={String(customAvailability)} />
      <input type="hidden" name="availability" value={JSON.stringify(availability ?? [])} />

      <Btn type="submit" variant="primary" size="lg" icon="check" style={{ width: '100%' }} disabled={isPending}>
        {isPending ? 'שומר…' : isEdit ? 'שמירת שינויים' : 'הוספת עובד'}
      </Btn>

      {isEdit && (
        <div>
          {!confirmDelete ? (
            <Btn type="button" variant="danger" size="md" icon="x" style={{ width: '100%' }} onClick={() => setConfirmDelete(true)}>
              מחיקת עובד
            </Btn>
          ) : (
            <div style={{ padding: '14px', borderRadius: 'var(--r-md)', border: '1.5px solid rgba(220,70,70,0.4)', background: 'rgba(220,70,70,0.06)' }}>
              <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text)', textAlign: 'center' }}>
                האם למחוק את העובד לצמיתות?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn type="button" variant="ghost" size="sm" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>ביטול</Btn>
                <Btn type="button" variant="danger" size="sm" style={{ flex: 1 }} onClick={handleDelete}>מחק</Btn>
              </div>
              {deleteError && <p style={{ fontSize: 12.5, color: '#D8423B', marginTop: 4, textAlign: 'center' }}>{deleteError}</p>}
            </div>
          )}
        </div>
      )}
    </form>
  )
}
