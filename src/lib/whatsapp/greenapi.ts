import 'server-only'

/**
 * Minimal GreenAPI client for direct WhatsApp messages.
 *
 * Free tier on green-api.com is sufficient for current scale (~3000 msgs/mo).
 * The workplace links its WhatsApp number to a GreenAPI instance via QR scan;
 * the instance + token live in `workplace_settings.greenapi_*`.
 *
 * NEVER throws — callers decide whether to surface failures as soft warnings
 * (we explicitly do NOT want a WhatsApp hiccup to roll back an employee insert).
 */

export interface GreenApiResult {
  ok: boolean
  /** GreenAPI's returned message id on success. */
  idMessage?: string
  /** Human-readable Hebrew error message on failure. */
  error?: string
}

const ENDPOINT = (instance: string, token: string) =>
  `https://api.green-api.com/waInstance${encodeURIComponent(instance)}/sendMessage/${encodeURIComponent(token)}`

/**
 * Send a plain-text WhatsApp message to a single phone number.
 *
 * @param instance    workplace_settings.greenapi_instance
 * @param token       workplace_settings.greenapi_token
 * @param phoneE164   E.164 without leading '+' (e.g. `972521234567`) —
 *                    exactly what `normalizeIsraeliPhone` returns.
 * @param message     plain-text body; line breaks (`\n`) are fine.
 */
export async function sendTextMessage(
  instance: string,
  token: string,
  phoneE164: string,
  message: string,
): Promise<GreenApiResult> {
  if (!instance || !token) return { ok: false, error: 'GreenAPI לא מוגדר' }
  if (!phoneE164) return { ok: false, error: 'מספר טלפון חסר' }

  try {
    const resp = await fetch(ENDPOINT(instance, token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: `${phoneE164}@c.us`,
        message,
      }),
      // Don't hang the server action: cap the call.
      signal: AbortSignal.timeout(8000),
    })

    if (!resp.ok) {
      // 466 = instance not active (most common). 401 = bad token. 429 = rate limit.
      const reason = resp.status === 466
        ? 'מופע GreenAPI אינו פעיל'
        : resp.status === 401
        ? 'אסימון GreenAPI לא תקין'
        : resp.status === 429
        ? 'חרגת ממכסת ההודעות'
        : `שגיאה ${resp.status}`
      return { ok: false, error: reason }
    }

    const data = (await resp.json().catch(() => null)) as { idMessage?: string } | null
    return { ok: true, idMessage: data?.idMessage }
  } catch (e) {
    // Network error / timeout / abort — never let it bubble.
    const msg = e instanceof Error ? e.message : 'שגיאת רשת'
    return { ok: false, error: msg.includes('timeout') ? 'GreenAPI לא הגיב בזמן' : msg }
  }
}
