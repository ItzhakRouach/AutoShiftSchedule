/**
 * Evolution API WhatsApp client (self-hosted, open-source).
 * One app-level instance — connection is configured via env:
 *   EVOLUTION_API_URL   base URL of the Evolution server (no trailing slash needed)
 *   EVOLUTION_API_KEY   global apikey header value
 *   EVOLUTION_INSTANCE  name of the connected instance (linked WhatsApp number)
 *
 * Messages are sent from the system's number. `to` is either a group JID
 * (e.g. 12036…@g.us) or a phone with country code (e.g. 972521234567).
 *
 * Docs: https://doc.evolution-api.com/v2/api-reference (sendText / sendMedia).
 * Never throws — all errors are returned as `{ ok: false, error }`.
 */
import 'server-only'

const TIMEOUT_MS = 15_000

interface EvolutionEnv {
  url: string
  key: string
  instance: string
}

function readEnv(): EvolutionEnv | null {
  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE
  if (!url || !key || !instance) return null
  return { url: url.replace(/\/+$/, ''), key, instance }
}

/** True when all three Evolution env vars are present. */
export function isEvolutionConfigured(): boolean {
  return readEnv() !== null
}

export interface SendResult {
  ok: boolean
  error?: string
}

async function postMessage(
  endpoint: 'sendText' | 'sendMedia',
  body: Record<string, unknown>,
): Promise<SendResult> {
  const env = readEnv()
  if (!env) return { ok: false, error: 'Evolution API לא מוגדר (חסר URL / KEY / INSTANCE)' }

  const target = `${env.url}/message/${endpoint}/${env.instance}`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: env.key },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { ok: false, error: `Evolution HTTP ${response.status}: ${text.slice(0, 120)}` }
    }

    return { ok: true }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Evolution timeout — הבקשה לא הושלמה בזמן' }
    }
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Evolution network error: ${msg}` }
  }
}

/** Send a plain text message to a phone (972…) or group JID (…@g.us). */
export async function sendText(params: { to: string; text: string }): Promise<SendResult> {
  if (!params.to || !params.text) {
    return { ok: false, error: 'חסרים פרמטרים לשליחת טקסט (to / text)' }
  }
  return postMessage('sendText', { number: params.to, text: params.text })
}

/** Send an image (by public URL) to a phone (972…) or group JID (…@g.us). */
export async function sendImage(params: {
  to: string
  imageUrl: string
  caption?: string
}): Promise<SendResult> {
  if (!params.to || !params.imageUrl) {
    return { ok: false, error: 'חסרים פרמטרים לשליחת תמונה (to / imageUrl)' }
  }
  return postMessage('sendMedia', {
    number: params.to,
    mediatype: 'image',
    mimetype: 'image/png',
    media: params.imageUrl,
    caption: params.caption ?? '',
    fileName: 'schedule.png',
  })
}
