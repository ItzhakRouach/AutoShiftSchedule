'use client'

import { useState, useTransition } from 'react'
import { Card } from '@/components/ui/Card'
import { Stepper } from '@/components/ui/Stepper'
import { Btn } from '@/components/ui/Btn'
import { LtrText } from '@/components/ui/LtrText'
import { shiftMetaFromRow, roleMetaFromRow } from '@/lib/domain/meta'
import { updateRequirements } from './requirements-actions'

interface ShiftTypeRow {
  id: string
  key: string
  name: string
  color: string
  start_hour?: number | null
  hours?: number | null
}

interface RoleRow {
  id: string
  name: string
  color?: string | null
  rank?: number | null
}

interface RequirementRow {
  shift_type_id: string
  role_id: string
  count: number
}

interface Props {
  shiftTypes: ShiftTypeRow[]
  roles: RoleRow[]
  requirements: RequirementRow[]
}

type Counts = Record<string, Record<string, number>> // shiftTypeId → roleId → count

function buildInitialCounts(
  shiftTypes: ShiftTypeRow[],
  roles: RoleRow[],
  requirements: RequirementRow[],
): Counts {
  const counts: Counts = {}
  for (const st of shiftTypes) {
    counts[st.id] = {}
    for (const r of roles) {
      const found = requirements.find(
        (req) => req.shift_type_id === st.id && req.role_id === r.id,
      )
      counts[st.id][r.id] = found?.count ?? 0
    }
  }
  return counts
}

export function RequirementsSection({ shiftTypes, roles, requirements }: Props) {
  const [counts, setCounts] = useState<Counts>(() =>
    buildInitialCounts(shiftTypes, roles, requirements),
  )
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  function setCount(shiftTypeId: string, roleId: string, value: number) {
    setCounts((prev) => ({
      ...prev,
      [shiftTypeId]: { ...prev[shiftTypeId], [roleId]: value },
    }))
    setStatus('idle')
  }

  function handleSave() {
    startTransition(async () => {
      const payload = shiftTypes.flatMap((st) =>
        roles.map((r) => ({
          shiftTypeId: st.id,
          roleId: r.id,
          count: counts[st.id]?.[r.id] ?? 0,
        })),
      )
      const res = await updateRequirements(payload)
      if (res.ok) {
        setStatus('ok')
      } else {
        setStatus('error')
        setErrorMsg(res.error ?? 'שגיאה')
      }
    })
  }

  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: 24,
        boxShadow: 'var(--shadow)',
        marginBottom: 20,
      }}
    >
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>
        דרישות איוש
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.5 }}>
        הגדר כמה עובדים מכל תפקיד נדרשים בכל משמרת. הערך חל על כל ימות השבוע.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {shiftTypes.map((st) => {
          const meta = shiftMetaFromRow(st)
          const total = roles.reduce((s, r) => s + (counts[st.id]?.[r.id] ?? 0), 0)
          return (
            <Card key={st.id} pad={0} style={{ overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '12px 14px',
                  background: meta.soft,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{meta.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}><LtrText>{meta.time}</LtrText></div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
                  {total} עובדים
                </div>
              </div>
              <div style={{ padding: '4px 14px 10px' }}>
                {roles.map((role, idx) => {
                  const roleMeta = roleMetaFromRow(role)
                  const isLast = idx === roles.length - 1
                  return (
                    <div
                      key={role.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 0',
                        borderBottom: isLast ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        {roleMeta && (
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: 99,
                              background: roleMeta.color,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                          {role.name}
                        </span>
                      </div>
                      <Stepper
                        value={counts[st.id]?.[role.id] ?? 0}
                        min={0}
                        max={6}
                        onChange={(v) => setCount(st.id, role.id, v)}
                      />
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>

      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Btn onClick={handleSave} disabled={isPending} variant="primary" size="sm">
          {isPending ? 'שומר…' : 'שמירה'}
        </Btn>
        {status === 'ok' && (
          <span style={{ fontSize: 13, color: '#13A98E', fontWeight: 600 }}>נשמר בהצלחה</span>
        )}
        {status === 'error' && (
          <span style={{ fontSize: 13, color: '#D8423B' }}>{errorMsg}</span>
        )}
      </div>
    </section>
  )
}
