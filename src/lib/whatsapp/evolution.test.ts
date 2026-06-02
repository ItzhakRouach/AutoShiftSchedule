import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendText, sendImage, isEvolutionConfigured } from './evolution'

function configureEnv() {
  vi.stubEnv('EVOLUTION_API_URL', 'https://evo.example.com/')
  vi.stubEnv('EVOLUTION_API_KEY', 'secret-key')
  vi.stubEnv('EVOLUTION_INSTANCE', 'mishmeret')
}

describe('evolution client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('isEvolutionConfigured', () => {
    it('is false when env is missing', () => {
      vi.stubEnv('EVOLUTION_API_URL', '')
      vi.stubEnv('EVOLUTION_API_KEY', '')
      vi.stubEnv('EVOLUTION_INSTANCE', '')
      expect(isEvolutionConfigured()).toBe(false)
    })
    it('is true when env is present', () => {
      configureEnv()
      expect(isEvolutionConfigured()).toBe(true)
    })
  })

  describe('sendText', () => {
    it('posts to /message/sendText/{instance} with apikey header and number/text body', async () => {
      configureEnv()
      vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 201 }))
      const result = await sendText({ to: '972521234567', text: 'שלום' })
      expect(result.ok).toBe(true)
      const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://evo.example.com/message/sendText/mishmeret')
      expect((init.headers as Record<string, string>).apikey).toBe('secret-key')
      const body = JSON.parse(init.body as string)
      expect(body.number).toBe('972521234567')
      expect(body.text).toBe('שלום')
    })

    it('returns ok:false when not configured', async () => {
      const result = await sendText({ to: '972521234567', text: 'hi' })
      expect(result.ok).toBe(false)
      expect(result.error).toContain('לא מוגדר')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('returns ok:false on HTTP error', async () => {
      configureEnv()
      vi.mocked(fetch).mockResolvedValue(new Response('bad', { status: 400 }))
      const result = await sendText({ to: '972521234567', text: 'hi' })
      expect(result.ok).toBe(false)
      expect(result.error).toContain('Evolution HTTP 400')
    })

    it('returns ok:false on network error', async () => {
      configureEnv()
      vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'))
      const result = await sendText({ to: '972521234567', text: 'hi' })
      expect(result.ok).toBe(false)
      expect(result.error).toContain('network error')
    })

    it('returns ok:false on abort/timeout', async () => {
      configureEnv()
      const abortErr = new Error('aborted')
      abortErr.name = 'AbortError'
      vi.mocked(fetch).mockRejectedValue(abortErr)
      const result = await sendText({ to: '972521234567', text: 'hi' })
      expect(result.ok).toBe(false)
      expect(result.error).toContain('timeout')
    })

    it('returns ok:false when params are missing', async () => {
      configureEnv()
      const result = await sendText({ to: '', text: 'hi' })
      expect(result.ok).toBe(false)
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('sendImage', () => {
    it('posts to /message/sendMedia/{instance} with media fields', async () => {
      configureEnv()
      vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 201 }))
      const result = await sendImage({
        to: '12036@g.us',
        imageUrl: 'https://cdn.example.com/s.png',
        caption: 'סידור',
      })
      expect(result.ok).toBe(true)
      const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://evo.example.com/message/sendMedia/mishmeret')
      const body = JSON.parse(init.body as string)
      expect(body.number).toBe('12036@g.us')
      expect(body.mediatype).toBe('image')
      expect(body.media).toBe('https://cdn.example.com/s.png')
      expect(body.caption).toBe('סידור')
      expect(body.fileName).toBe('schedule.png')
    })

    it('returns ok:false when not configured', async () => {
      const result = await sendImage({ to: '12036@g.us', imageUrl: 'https://x/s.png' })
      expect(result.ok).toBe(false)
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})
