'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { EmployeeEditor, type EmployeeData, type RoleOption } from './EmployeeEditor'
import type { ShiftTypeOption } from './AvailabilityGrid'
import { EmployeeCard } from './EmployeeCard'

interface TeamClientProps {
  employees: EmployeeData[]
  roles: RoleOption[]
  shiftTypes: ShiftTypeOption[]
}

export function TeamClient({ employees, roles, shiftTypes }: TeamClientProps) {
  const router = useRouter()
  const [sheetMode, setSheetMode] = useState<'add' | 'edit' | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? employees.filter(
        (e) => e.name.toLowerCase().includes(q) || (e.phone ?? '').toLowerCase().includes(q),
      )
    : employees

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
        <div>
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
          {employees.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              סה״כ{' '}
              <span data-testid="employee-count" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 22, height: 22, padding: '0 7px', borderRadius: 'var(--r-pill)', background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 800, fontSize: 13 }}>
                {employees.length}
              </span>{' '}
              עובדים
            </div>
          )}
        </div>
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

      {/* Search */}
      {employees.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <span style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }}>
            <Icon name="users" size={18} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש עובד לפי שם או טלפון…"
            aria-label="חיפוש עובד"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '11px 42px 11px 42px',
              borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: 14,
              fontFamily: 'var(--font)', direction: 'rtl',
            }}
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="נקה חיפוש"
              style={{
                position: 'absolute', insetInlineEnd: 10, top: '50%', transform: 'translateY(-50%)',
                width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', border: 'none', background: 'var(--surface-2)',
                color: 'var(--text-2)', cursor: 'pointer',
              }}
            >
              <Icon name="x" size={15} stroke={2} />
            </button>
          )}
        </div>
      )}

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
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--text-3)', fontSize: 14 }}>
          לא נמצאו עובדים התואמים לחיפוש
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {filtered.map((emp) => (
            <EmployeeCard key={emp.id} employee={emp} roles={roles} onOpen={openEdit} />
          ))}
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
