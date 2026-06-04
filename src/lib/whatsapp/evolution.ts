import 'server-only'

/**
 * Minimal Evolution API client for direct WhatsApp messages.
 *
 * Evolution API (https://github.com/EvolutionAPI/evolution-api) is the
 * self-hosted WhatsApp gateway documented in CLAUDE.md and docs/whatsapp.md.
 * A single dedicated phone number is linked to one Evolution instance via
 * QR scan; the URL/key/instance triple lives in env so it's app-wide rather
 * than per-workplace (matches the simplification in migration 20260602120000).
 *
 * Env vars required:
 *   EVOLUTION_API_URL      e.g. https://evo.example.com
 *   EVOLUTION_API_KEY      the instance's apikey header
 *   EVOLUTION_API_INSTANCE the instance name (path segment)
 *
 * NEVER throws — callers decide whether to surface failures as soft warnings.
 * Returns ok:false with `error:'Evolution API לא מוגדר'` when env is incomplete
 * so the caller can keep going (e.g. employee insert succeeds anyway).
 */

export interface EvolutionResult {
  ok: boolean
  /** Provider-side message id on success (varies by Evolution version). */
  idMessage?: string
  /** Human-readable Hebrew error message on failure. */
  error?: string
}

interface EvolutionEnv {
  url: string
  key: string
  instance: string
}

function readEnv(): EvolutionEnv | null {
  const url = process.env.EVOLUTION_API_URL?.replace(/\/+$/, '')
  const key = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_API_INSTANCE
  if (!url || !key || !instance) return null
  return { url, key, instance }
}

/** Whether the env is wired up — used by UI to decide if the opt-in toggle
 *  should default ON. Server-only (env never leaks to the client). */
export function isEvolutionConfigured(): boolean {
  return readEnv() !== null
}

/**
 * Send a plain-text WhatsApp message to a single phone number.
 *
 * @param phoneE164  E.164 without leading '+' (e.g. `972521234567`) — exactly
 *                   what `normalizeIsraeliPhone` returns. Evolution accepts
 *                   raw numbers and appends `@s.whatsapp.net` internally.
 * @param message    plain-text body; line breaks (`\n`) are fine.
 */
export async function sendTextMessage(
  phoneE164: string,
  message: string,
): Promise<EvolutionResult> {
  const env = readEnv()
  if (!env) return { ok: false, error: 'Evolution API לא מוגדר' }
  if (!phoneE164) return { ok: false, error: 'מספר טלפון חסר' }

  try {
    const resp = await fetch(
      `${env.url}/message/sendText/${encodeURIComponent(env.instance)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.key,
        },
        body: JSON.stringify({ number: phoneE164, text: message }),
        signal: AbortSignal.timeout(8000),
      },
    )

    if (!resp.ok) {
      const reason = resp.status === 401
        ? 'אסימון Evolution API לא תקין'
        : resp.status === 404
        ? 'מופע Evolution API לא נמצא'
        : resp.status === 429
        ? 'חרגת ממכסת ההודעות'
        : `שגיאה ${resp.status}`
      return { ok: false, error: reason }
    }

    const data = (await resp.json().catch(() => null)) as
      | { key?: { id?: string }; messageId?: string }
      | null
    const idMessage = data?.key?.id ?? data?.messageId
    return { ok: true, idMessage }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'שגיאת רשת'
    return { ok: false, error: msg.includes('timeout') ? 'Evolution API לא הגיב בזמן' : msg }
  }
}
