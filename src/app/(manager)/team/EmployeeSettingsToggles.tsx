'use client'

import React from 'react'
import { Toggle } from '@/components/ui/Toggle'
import { Icon } from '@/components/ui/Icon'

interface ToggleRowDef {
  key: string
  label: string
  desc: string
  icon: 'moon' | 'sun' | 'shield'
  value: boolean
  setter: (v: boolean) => void
}

interface EmployeeSettingsTogglesProps {
  /** True when the employee observes both Shabbat AND holidays (combined toggle). */
  observesShabbat: boolean
  setObservesShabbat: (v: boolean) => void
  mustAccept: boolean
  setMustAccept: (v: boolean) => void
}

export function EmployeeSettingsToggles({
  observesShabbat,
  setObservesShabbat,
  mustAccept,
  setMustAccept,
}: EmployeeSettingsTogglesProps) {
  const rows: ToggleRowDef[] = [
    {
      key: 'observesShabbatChag',
      label: 'שומר שבת וחג',
      desc: 'לא ישובץ ממע"ש עד מוצ"ש ובחגים',
      icon: 'moon',
      value: observesShabbat,
      setter: setObservesShabbat,
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
          {/* Emit BOTH hidden fields from the single shabbat+chag toggle */}
          {key === 'observesShabbatChag' ? (
            <>
              <input type="hidden" name="observesShabbat" value={String(value)} />
              <input type="hidden" name="observesHolidays" value={String(value)} />
            </>
          ) : (
            <input type="hidden" name={key} value={String(value)} />
          )}
        </div>
      ))}
    </>
  )
}
