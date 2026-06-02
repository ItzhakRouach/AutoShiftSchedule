'use client'

import { useState, useTransition } from 'react'
import { Btn } from '@/components/ui/Btn'
import { addRole, updateRole, deactivateRole } from './roles-actions'

interface Role { id: string; name: string; color: string; rank: number }

const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
  padding: 24, boxShadow: 'var(--shadow)', marginBottom: 20,
}
const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 'var(--r-md)',
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)',
  fontSize: 14, fontFamily: 'var(--font)',
}

function RoleRow({ role }: { role: Role }) {
  const [name, setName] = useState(role.name)
  const [color, setColor] = useState(role.color)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const dirty = name !== role.name || color !== role.color

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }} />
      <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} dir="rtl" />
      {dirty && (
        <Btn size="sm" variant="primary" disabled={pending} onClick={() => start(async () => {
          setErr(null)
          const r = await updateRole(role.id, { name, color })
          if (r.error) setErr(r.error)
        })}>שמור</Btn>
      )}
      <button
        type="button"
        title="הסר תפקיד"
        onClick={() => start(async () => { const r = await deactivateRole(role.id); if (r.error) setErr(r.error) })}
        disabled={pending}
        style={{ border: '1px solid var(--danger)', color: 'var(--danger)', background: 'none', borderRadius: 'var(--r-md)', padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, flexShrink: 0 }}
      >הסר</button>
      {err && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>}
    </div>
  )
}

export function RolesSection({ roles }: { roles: Role[] }) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#3457F0')
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const ordered = [...roles].sort((a, b) => b.rank - a.rank)

  return (
    <section style={sectionStyle}>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>תפקידים</h2>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px', lineHeight: 1.5 }}>
        הגדירו את התפקידים במקום העבודה. תפקיד בכיר יותר (גבוה ברשימה) מכסה אוטומטית את התפקידים שמתחתיו.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {ordered.map((r) => <RoleRow key={r.id} role={r} />)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }} />
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="שם תפקיד חדש" style={inputStyle} dir="rtl" />
        <Btn size="sm" variant="primary" disabled={pending || newName.trim().length === 0} onClick={() => start(async () => {
          setErr(null)
          const r = await addRole(newName, newColor)
          if (r.error) setErr(r.error)
          else setNewName('')
        })}>הוסף</Btn>
      </div>
      {err && <p style={{ fontSize: 13, color: 'var(--danger)', margin: '8px 0 0' }}>{err}</p>}
    </section>
  )
}
