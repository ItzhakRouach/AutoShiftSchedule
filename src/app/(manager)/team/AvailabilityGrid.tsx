'use client'

import React from 'react'
import { Toggle } from '@/components/ui/Toggle'
import type { AvailabilityItem } from '@/lib/validation/employee'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

export interface ShiftTypeOption {
  id: string
  name: string
}

interface AvailabilityGridProps {
  shiftTypes: ShiftTypeOption[]
  // availability: null = unrestricted (toggle OFF); array = restricted (toggle ON)
  availability: AvailabilityItem[] | null
  onChange: (next: AvailabilityItem[] | null) => void
}

function isChecked(
  availability: AvailabilityItem[] | null,
  day: number,
  shiftId: string,
): boolean {
  if (!availability) return false
  return availability.some((a) => a.dayOfWeek === day && a.shiftTypeId === shiftId)
}

function toggleCell(
  current: AvailabilityItem[],
  day: number,
  shiftId: string,
): AvailabilityItem[] {
  const exists = current.some((a) => a.dayOfWeek === day && a.shiftTypeId === shiftId)
  if (exists) return current.filter((a) => !(a.dayOfWeek === day && a.shiftTypeId === shiftId))
  return [...current, { dayOfWeek: day, shiftTypeId: shiftId }]
}

const sectionStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--border)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--text)',
}

const descStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--text-2)',
  marginTop: 1,
}

const cellBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '5px 9px',
  borderRadius: 'var(--r-sm)',
  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
  color: active ? 'var(--accent)' : 'var(--text-3)',
  fontSize: 12,
  fontWeight: active ? 700 : 400,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
})

export function AvailabilityGrid({ shiftTypes, availability, onChange }: AvailabilityGridProps) {
  const customOn = availability !== null

  function handleToggleCustom(on: boolean) {
    onChange(on ? [] : null)
  }

  function handleCellToggle(day: number, shiftId: string) {
    if (!availability) return
    onChange(toggleCell(availability, day, shiftId))
  }

  return (
    <div style={sectionStyle}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: customOn ? 14 : 0 }}>
        <div>
          <div style={labelStyle}>זמינות מותאמת אישית</div>
          <div style={descStyle}>
            {customOn ? 'בחרו אילו משמרות העובד יכול לעבוד' : 'כבוי — זמין לכל המשמרות'}
          </div>
        </div>
        <Toggle checked={customOn} onChange={handleToggleCustom} />
      </div>

      {/* Grid */}
      {customOn && shiftTypes.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320 }}>
            <thead>
              <tr>
                <th style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600, padding: '0 4px 8px 0', textAlign: 'right' }}>
                  יום
                </th>
                {shiftTypes.map((st) => (
                  <th key={st.id} style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600, padding: '0 4px 8px', textAlign: 'center' }}>
                    {st.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_NAMES.map((dayName, dayIdx) => (
                <tr key={dayIdx}>
                  <td style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600, padding: '4px 8px 4px 0', whiteSpace: 'nowrap' }}>
                    {dayName}
                  </td>
                  {shiftTypes.map((st) => {
                    const active = isChecked(availability, dayIdx, st.id)
                    return (
                      <td key={st.id} style={{ padding: '4px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleCellToggle(dayIdx, st.id)}
                          style={cellBtnStyle(active)}
                          aria-pressed={active}
                          aria-label={`${dayName} ${st.name}`}
                        >
                          {active ? '✓' : '—'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {customOn && shiftTypes.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '8px 0 0' }}>
          אין סוגי משמרות מוגדרים במקום העבודה
        </p>
      )}
    </div>
  )
}
