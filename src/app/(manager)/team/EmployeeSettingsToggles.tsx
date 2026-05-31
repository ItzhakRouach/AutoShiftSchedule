'use client'

import React from 'react'
import { Toggle } from '@/components/ui/Toggle'
import { Icon } from '@/components/ui/Icon'

interface ToggleRowDef {
  key: 'observesShabbat' | 'observesHolidays' | 'mustAccept'
  label: string
  desc: string
  icon: 'moon' | 'sun' | 'shield'
  value: boolean
  setter: (v: boolean) => void
}

interface EmployeeSettingsTogglesProps {
  observesShabbat: boolean
  setObservesShabbat: (v: boolean) => void
  observesHolidays: boolean
  setObservesHolidays: (v: boolean) => void
  mustAccept: boolean
  setMustAccept: (v: boolean) => void
}

export function EmployeeSettingsToggles({
  observesShabbat,
  setObservesShabbat,
  observesHolidays,
  setObservesHolidays,
  mustAccept,
  setMustAccept,
}: EmployeeSettingsTogglesProps) {
  const rows: ToggleRowDef[] = [
    {
      key: 'observesShabbat',
      label: 'שומר שבת',
      desc: 'לא ישובץ ממע"ש עד מוצ"ש',
      icon: 'moon',
      value: observesShabbat,
      setter: setObservesShabbat,
    },
    {
      key: 'observesHolidays',
      label: 'שומר חג',
      desc: 'לא ישובץ בחגים',
      icon: 'sun',
      value: observesHolidays,
      setter: setObservesHolidays,
    },
    {
      key: 'mustAccept',
      label: 'חובה לקבל בקשות',
      desc: 'המערכת חייבת לשבץ לפי בקשותיו',
      icon: 'shield',
      value: mustAccept,
      setter: setMustAccept,
    },
  ]

  return (
    <>
      {rows.map(({ key, label, desc, icon, value, setter }) => (
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
    </>
  )
}
