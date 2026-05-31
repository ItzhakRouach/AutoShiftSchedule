'use client'

import React, { useActionState, useState, useEffect } from 'react'
import { Btn } from '@/components/ui/Btn'
import { Toggle } from '@/components/ui/Toggle'
import { Stepper } from '@/components/ui/Stepper'
import { Icon } from '@/components/ui/Icon'
import { createEmployee, updateEmployee, deleteEmployee, type EmployeeActionState } from './actions'

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

  // Controlled form state
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

  // Bind the update action with the employee id when in edit mode
  const boundUpdateAction = isEdit
    ? updateEmployee.bind(null, employee!.id)
    : createEmployee

  const [state, formAction, isPending] = useActionState<EmployeeActionState, FormData>(
    boundUpdateAction,
    initialState,
  )

  // Close sheet on success
  useEffect(() => {
    if (state.ok) {
      onSuccess()
    }
  }, [state.ok, onSuccess])

  function toggleRole(roleId: string) {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) {
        next.delete(roleId)
      } else {
        next.add(roleId)
      }
      return next
    })
  }

  async function handleDelete() {
    if (!employee) return
    setDeleteError(null)
    const result = await deleteEmployee(employee.id)
    if (result.error) {
      setDeleteError(result.error)
    } else {
      onSuccess()
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    fontSize: 15,
    fontFamily: 'var(--font)',
    color: 'var(--text)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    boxSizing: 'border-box',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-2)',
    marginBottom: 6,
    display: 'block',
  }

  const fieldErrorStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: '#D8423B',
    marginTop: 4,
  }

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Global error */}
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

      {/* Name */}
      <div>
        <label htmlFor="emp-name" style={labelStyle}>שם מלא</label>
        <input
          id="emp-name"
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ישראל ישראלי"
          style={inputStyle}
          autoComplete="off"
        />
        {state.fieldErrors?.name && (
          <p style={fieldErrorStyle}>{state.fieldErrors.name}</p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="emp-phone" style={labelStyle}>טלפון (אופציונלי)</label>
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              insetInlineStart: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-3)',
            }}
          >
            <Icon name="phone" size={17} />
          </span>
          <input
            id="emp-phone"
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="050-0000000"
            style={{ ...inputStyle, paddingInlineStart: 40 }}
            autoComplete="off"
          />
        </div>
        {state.fieldErrors?.phone && (
          <p style={fieldErrorStyle}>{state.fieldErrors.phone}</p>
        )}
      </div>

      {/* Role selection */}
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
                onClick={() => toggleRole(role.id)}
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
                <span
                  style={{ flex: 1, fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}
                >
                  {role.name}
                </span>
                <Toggle checked={on} onChange={() => toggleRole(role.id)} />
              </div>
            )
          })}
        </div>
        {state.fieldErrors?.roleIds && (
          <p style={fieldErrorStyle}>{state.fieldErrors.roleIds}</p>
        )}
        {/* Hidden inputs for selected role IDs */}
        {[...selectedRoleIds].map((rid) => (
          <input key={rid} type="hidden" name="roleIds" value={rid} />
        ))}
      </div>

      {/* Min shifts stepper */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
        }}
      >
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}>
            מינימום משמרות בשבוע
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>
            המערכת תבטיח לפחות {minShifts} משמרות
          </div>
        </div>
        <Stepper value={minShifts} onChange={setMinShifts} min={0} max={7} />
        <input type="hidden" name="minShifts" value={minShifts} />
      </div>

      {/* Toggles */}
      {[
        {
          key: 'observesShabbat',
          label: 'שומר שבת',
          desc: 'לא ישובץ ממע"ש עד מוצ"ש',
          icon: 'moon' as const,
          value: observesShabbat,
          setter: setObservesShabbat,
        },
        {
          key: 'observesHolidays',
          label: 'שומר חג',
          desc: 'לא ישובץ בחגים',
          icon: 'sun' as const,
          value: observesHolidays,
          setter: setObservesHolidays,
        },
        {
          key: 'mustAccept',
          label: 'חובה לקבל בקשות',
          desc: 'המערכת חייבת לשבץ לפי בקשותיו',
          icon: 'shield' as const,
          value: mustAccept,
          setter: setMustAccept,
        },
      ].map(({ key, label, desc, icon, value, setter }) => (
        <div
          key={key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 13,
            padding: '12px 14px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--r-sm)',
              background: 'var(--surface-sunk)',
              color: 'var(--text-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name={icon} size={19} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 1 }}>{desc}</div>
          </div>
          <Toggle checked={value} onChange={setter} />
          <input type="hidden" name={key} value={String(value)} />
        </div>
      ))}

      {/* Submit */}
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

      {/* Delete in edit mode */}
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
              <p
                style={{
                  margin: '0 0 12px',
                  fontSize: 14,
                  color: 'var(--text)',
                  textAlign: 'center',
                }}
              >
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
              {deleteError && <p style={{ ...fieldErrorStyle, textAlign: 'center', marginTop: 8 }}>{deleteError}</p>}
            </div>
          )}
        </div>
      )}
    </form>
  )
}
