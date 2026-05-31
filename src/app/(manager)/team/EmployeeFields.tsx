'use client'

import React from 'react'
import { Icon } from '@/components/ui/Icon'
import { Stepper } from '@/components/ui/Stepper'

interface EmployeeFieldsProps {
  name: string
  onNameChange: (v: string) => void
  phone: string
  onPhoneChange: (v: string) => void
  minShifts: number
  onMinShiftsChange: (v: number) => void
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

export function EmployeeFields({
  name,
  onNameChange,
  phone,
  onPhoneChange,
  minShifts,
  onMinShiftsChange,
  nameError,
  phoneError,
}: EmployeeFieldsProps) {
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
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="050-0000000"
            style={{ ...inputStyle, paddingInlineStart: 40 }}
            autoComplete="off"
          />
        </div>
        {phoneError && <p style={fieldErrorStyle}>{phoneError}</p>}
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
        <Stepper value={minShifts} onChange={onMinShiftsChange} min={0} max={7} />
        <input type="hidden" name="minShifts" value={minShifts} />
      </div>
    </>
  )
}
