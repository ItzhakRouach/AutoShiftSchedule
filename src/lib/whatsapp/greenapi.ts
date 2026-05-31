/**
 * GreenAPI WhatsApp gateway client.
 * Unofficial free-tier service — requires linking a WhatsApp number.
 * Docs: https://green-api.com/en/docs/api/sending/SendFileByUrl/
 */
import 'server-only'

const GREENAPI_BASE = 'https://api.green-api.com'
const TIMEOUT_MS = 15_000

/** Normalize a group ID: strip trailing @g.us if present, then re-append. */
function normalizeGroup(group: string): string {
  const bare = group.replace(/@g\.us$/, '')
  return `${bare}@g.us`
}

export interface SendScheduleImageParams {
  instanceId: string
  token: string
  group: string
  imageUrl: string
  caption?: string
}

export interface SendResult {
  ok: boolean
  error?: string
}

/**
 * Sends a schedule image to a WhatsApp group via GreenAPI's sendFileByUrl endpoint.
 * Never throws — all errors are returned as `{ ok: false, error }`.
 */
export async function sendScheduleImage(params: SendScheduleImageParams): Promise<SendResult> {
  const { instanceId, token, group, imageUrl, caption } = params

  if (!instanceId || !token || !group || !imageUrl) {
    return { ok: false, error: 'חסרים פרמטרים לשליחה (instanceId / token / group / imageUrl)' }
  }

  const url = `${GREENAPI_BASE}/waInstance${instanceId}/sendFileByUrl/${token}`
  const body = JSON.stringify({
    chatId: normalizeGroup(group),
    urlFile: imageUrl,
    fileName: 'schedule.png',
    caption: caption ?? '',
  })

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { ok: false, error: `GreenAPI HTTP ${response.status}: ${text.slice(0, 120)}` }
    }

    return { ok: true }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'GreenAPI timeout — הבקשה לא הושלמה בזמן' }
    }
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `GreenAPI network error: ${msg}` }
  }
}
