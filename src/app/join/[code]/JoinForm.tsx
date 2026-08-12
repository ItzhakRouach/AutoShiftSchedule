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

interface JoinFormProps {
  action: (prevState: JoinState, formData: FormData) => Promise<JoinState>
  /** Pre-filled from the pending employee the manager created for this invite. */
  initialName?: string
  initialPhone?: string
}

export function JoinForm({ action, initialName, initialPhone }: JoinFormProps) {
  const [state, formAction, isPending] = useActionState<JoinState, FormData>(action, {})
  const [observesShabbat, setObservesShabbat] = useState(false)
  const [observesHolidays, setObservesHolidays] = useState(false)
  const [employmentType, setEmploymentType] = useState<EmploymentValue>('full')

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormError error={state.error} />

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

      <div>
        <label htmlFor="email" style={labelStyle}>אימייל</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          style={inputStyle}
        />
        {state.fieldErrors?.email && (
          <span style={errorStyle}>{state.fieldErrors.email}</span>
        )}
      </div>

      <div>
        <label htmlFor="password" style={labelStyle}>סיסמה</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          style={inputStyle}
        />
        {state.fieldErrors?.password && (
          <span style={errorStyle}>{state.fieldErrors.password}</span>
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

      <JoinSubmitButton isPending={isPending} label="הצטרפות" />
    </form>
  )
}
