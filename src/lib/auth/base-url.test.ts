import { describe, expect, it } from 'vitest'
import { computeBaseUrl } from './base-url'

describe('computeBaseUrl', () => {
  it('prefers the env base URL when set, stripping a trailing slash', () => {
    expect(
      computeBaseUrl({ host: 'myapp.vercel.app', forwardedProto: 'https', envBase: 'https://mishmeret.app/' }),
    ).toBe('https://mishmeret.app')
  })

  it('uses the x-forwarded-proto header when present', () => {
    expect(computeBaseUrl({ host: 'myapp.vercel.app', forwardedProto: 'https' })).toBe(
      'https://myapp.vercel.app',
    )
    expect(computeBaseUrl({ host: '10.100.102.11:3000', forwardedProto: 'http' })).toBe(
      'http://10.100.102.11:3000',
    )
  })

  it('falls back to http for localhost and loopback hosts', () => {
    expect(computeBaseUrl({ host: 'localhost:3000' })).toBe('http://localhost:3000')
    expect(computeBaseUrl({ host: '127.0.0.1:3000' })).toBe('http://127.0.0.1:3000')
    expect(computeBaseUrl({ host: '[::1]:3000' })).toBe('http://[::1]:3000')
  })

  it('falls back to https for any other host without a proto header', () => {
    expect(computeBaseUrl({ host: 'mishmeret.app' })).toBe('https://mishmeret.app')
  })

  it('defaults to localhost:3000 when no host is available', () => {
    expect(computeBaseUrl({ host: null })).toBe('http://localhost:3000')
  })
})
