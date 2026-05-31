import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendScheduleImage } from './greenapi'

const BASE_PARAMS = {
  instanceId: 'inst123',
  token: 'tok456',
  group: '1234567890',
  imageUrl: 'https://example.com/schedule.png',
  caption: 'סידור שבוע',
}

describe('sendScheduleImage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns ok:true on HTTP 200', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"idMessage":"abc"}', { status: 200 }))
    const result = await sendScheduleImage(BASE_PARAMS)
    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('posts to the correct GreenAPI endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }))
    await sendScheduleImage(BASE_PARAMS)
    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toContain('/waInstanceinst123/sendFileByUrl/tok456')
    const body = JSON.parse(init.body as string)
    expect(body.chatId).toBe('1234567890@g.us')
    expect(body.urlFile).toBe(BASE_PARAMS.imageUrl)
  })

  it('normalizes group that already has @g.us', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }))
    await sendScheduleImage({ ...BASE_PARAMS, group: '9876543210@g.us' })
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.chatId).toBe('9876543210@g.us')
  })

  it('returns ok:false on HTTP 4xx error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('{"error":"bad request"}', { status: 400 }),
    )
    const result = await sendScheduleImage(BASE_PARAMS)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('GreenAPI HTTP 400')
  })

  it('returns ok:false on network error (fetch throws)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'))
    const result = await sendScheduleImage(BASE_PARAMS)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('GreenAPI network error')
  })

  it('returns ok:false when required params are missing', async () => {
    const result = await sendScheduleImage({ ...BASE_PARAMS, instanceId: '' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('חסרים פרמטרים')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns ok:false when token is missing', async () => {
    const result = await sendScheduleImage({ ...BASE_PARAMS, token: '' })
    expect(result.ok).toBe(false)
  })

  it('returns ok:false on abort (timeout simulation)', async () => {
    const abortErr = new Error('The operation was aborted')
    abortErr.name = 'AbortError'
    vi.mocked(fetch).mockRejectedValue(abortErr)
    const result = await sendScheduleImage(BASE_PARAMS)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('timeout')
  })
})
