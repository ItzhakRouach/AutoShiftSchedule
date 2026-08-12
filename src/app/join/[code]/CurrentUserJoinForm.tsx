'use client'

import React, { useActionState, useState } from 'react'
import type { JoinState } from './actions'
import { PhoneInput } from '@/components/ui/PhoneInput'
import {
  EmploymentPicker,
  FormError,
  JoinSubmitButton,
  ObservancePicker,
  errorStyle,
  inputStyle,
  labelStyle,
  type EmploymentValue,
} from './join-form-fields'

interface CurrentUserJoinFormProps {
  action: (prevState: JoinState, formData: FormData) => Promise<JoinState>
  workplaceName: string
  initialName?: string
  initialPhone?: string
}

export function CurrentUserJoinForm({ action, workplaceName, initialName, initialPhone }: CurrentUserJoinFormProps) {
  const [state, formAction, isPending] = useActionState<JoinState, FormData>(action, {})
  const [observesShabbat, setObservesShabbat] = useState(false)
  const [observesHolidays, setObservesHolidays] = useState(false)
  const [employmentType, setEmploymentType] = useState<EmploymentValue>('full')

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormError error={state.error} />

      {/* Info banner: joining with existing account */}
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 'var(--r-md)',
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        אתה מחובר לחשבון קיים. תוכל להצטרף ל{workplaceName} ישירות.
      </div>

      <div>
        <label htmlFor="name" style={labelStyle}>שם מלא</label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          defaultValue={initialName}
          required
          style={{ ...inputStyle, direction: 'rtl' }}
          dir="rtl"
        />
        {state.fieldErrors?.name && (
          <span style={errorStyle}>{state.fieldErrors.name}</span>
        )}
      </div>

      <PhoneInput
        initialValue={initialPhone}
        label="טלפון נייד"
        required
        error={state.fieldErrors?.phone}
      />

      <EmploymentPicker
        value={employmentType}
        onChange={setEmploymentType}
        error={state.fieldErrors?.employmentType}
      />

      <ObservancePicker
        shabbat={observesShabbat}
        holidays={observesHolidays}
        onShabbat={setObservesShabbat}
        onHolidays={setObservesHolidays}
      />

      <JoinSubmitButton isPending={isPending} label="הצטרפות עם החשבון שלי" />
    </form>
  )
}
