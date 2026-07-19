'use client'

import React from 'react'
import { Stepper } from '@/components/ui/Stepper'
import { PhoneInput } from '@/components/ui/PhoneInput'

interface EmployeeFieldsProps {
  name: string
  onNameChange: (v: string) => void
  /** Stored phone (local `0…` or E.164 `972…`) seeding the PhoneInput. */
  initialPhone: string
  minShifts: number
  onMinShiftsChange: (v: number) => void
  maxShifts: number | null
  onMaxShiftsChange: (v: number | null) => void
  nameError?: string
  phoneError?: string
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

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 14px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--border)',
}

export function EmployeeFields({
  name, onNameChange, initialPhone,
  minShifts, onMinShiftsChange,
  maxShifts, onMaxShiftsChange,
  nameError, phoneError,
}: EmployeeFieldsProps) {
  const maxDisplay = maxShifts ?? 0

  function handleMaxChange(v: number) {
    // stepper at 0 means "no limit" when maxShifts was null; otherwise track number
    // clicking − from 1 sets null (ללא הגבלה)
    if (maxShifts === null) {
      onMaxShiftsChange(1)
    } else if (v === 0 && maxShifts === 1) {
      onMaxShiftsChange(null)
    } else {
      onMaxShiftsChange(v)
    }
  }

  return (
    <>
      {/* Name */}
      <div>
        <label htmlFor="emp-name" style={labelStyle}>שם מלא</label>
        <input
          id="emp-name"
          name="name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="ישראל ישראלי"
          style={inputStyle}
          autoComplete="off"
        />
        {nameError && <p style={fieldErrorStyle}>{nameError}</p>}
      </div>

      {/* Phone */}
      <PhoneInput id="emp-phone" initialValue={initialPhone} label="טלפון" required error={phoneError} />

      {/* Min shifts */}
      <div style={rowStyle}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}>מינימום משמרות בשבוע</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>המערכת תבטיח לפחות {minShifts} משמרות</div>
        </div>
        <Stepper value={minShifts} onChange={onMinShiftsChange} min={0} max={7} />
        <input type="hidden" name="minShifts" value={minShifts} />
      </div>

      {/* Max shifts */}
      <div style={rowStyle}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}>מקסימום משמרות בשבוע</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>
            {maxShifts === null ? 'ללא הגבלה' : `עד ${maxShifts} משמרות`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Stepper value={maxDisplay} onChange={handleMaxChange} min={0} max={7} />
          {maxShifts === null && (
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>ללא הגבלה</span>
          )}
        </div>
        <input type="hidden" name="maxShifts" value={maxShifts === null ? 'null' : maxShifts} />
      </div>
    </>
  )
}
