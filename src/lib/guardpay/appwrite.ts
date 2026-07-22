/**
 * Server-only client for the GuardPay `utilities` Appwrite Function.
 * משמרת holds ONLY an executions-scoped API key + the shared action secret —
 * it can run the function but cannot touch GuardPay data directly.
 * GUARDPAY_FAKE=1 (playwright webServer) short-circuits with fixtures.
 */
import 'server-only'
import type { GuardPayErrorCode } from './types'

export type GuardPayExec<T> = { ok: true; data: T } | { ok: false; code: GuardPayErrorCode }

type Action = 'FIND_ACCOUNT' | 'IMPORT_WEEK'

export async function executeGuardPayFunction<T>(
  action: Action,
  payload: Record<string, unknown>,
): Promise<GuardPayExec<T>> {
  if (process.env.GUARDPAY_FAKE === '1') return fakeExec<T>(action, payload)

  const endpoint = process.env.GUARDPAY_APPWRITE_ENDPOINT
  const project = process.env.GUARDPAY_APPWRITE_PROJECT_ID
  const fnId = process.env.GUARDPAY_FUNCTION_ID
  const key = process.env.GUARDPAY_APPWRITE_API_KEY
  const secret = process.env.GUARDPAY_IMPORT_SECRET
  if (!endpoint || !project || !fnId || !key || !secret) return { ok: false, code: 'EXEC_FAILED' }

  try {
    const res = await fetch(`${endpoint}/functions/${fnId}/executions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Appwrite-Project': project,
        'X-Appwrite-Key': key,
      },
      body: JSON.stringify({
        body: JSON.stringify({ action, payload: { ...payload, secret } }),
        async: false,
        method: 'POST',
        path: '/',
      }),
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, code: 'EXEC_FAILED' }
    const exec = (await res.json()) as { status?: string; responseBody?: string }
    if (exec.status !== 'completed') return { ok: false, code: 'EXEC_FAILED' }
    const body = JSON.parse(exec.responseBody ?? '') as { ok?: boolean; code?: GuardPayErrorCode }
    if (!body?.ok) return { ok: false, code: body?.code ?? 'EXEC_FAILED' }
    return { ok: true, data: body as T }
  } catch {
    return { ok: false, code: 'EXEC_FAILED' }
  }
}

/** e2e fixtures: FIND_ACCOUNT matches unless the email contains "missing";
 *  IMPORT_WEEK always succeeds and echoes the shift count. */
function fakeExec<T>(action: Action, payload: Record<string, unknown>): GuardPayExec<T> {
  if (action === 'FIND_ACCOUNT') {
    const email = String(payload.email ?? '')
    if (email.includes('missing')) return { ok: false, code: 'NOT_FOUND' }
    return { ok: true, data: { ok: true, userId: 'fake-user-1', name: 'ישראל ישראלי', email } as T }
  }
  const shifts = Array.isArray(payload.shifts) ? payload.shifts : []
  return { ok: true, data: { ok: true, deleted: 0, created: shifts.length, totalAmount: 0 } as T }
}
