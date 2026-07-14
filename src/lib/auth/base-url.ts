import { headers } from 'next/headers'

interface BaseUrlInput {
  host: string | null
  forwardedProto?: string | null
  envBase?: string | null
}

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

/**
 * Pure base-URL resolution: NEXT_PUBLIC_BASE_URL wins, then the proxy's
 * x-forwarded-proto header, then http for loopback hosts / https otherwise.
 */
export function computeBaseUrl({ host, forwardedProto, envBase }: BaseUrlInput): string {
  if (envBase) return envBase.replace(/\/$/, '')
  const h = host ?? 'localhost:3000'
  const proto = forwardedProto ?? (LOOPBACK.test(h) ? 'http' : 'https')
  return `${proto}://${h}`
}

/** Request-scoped base URL for building absolute links (emails, wa.me). */
export async function getBaseUrl(): Promise<string> {
  const h = await headers()
  return computeBaseUrl({
    host: h.get('host'),
    forwardedProto: h.get('x-forwarded-proto'),
    envBase: process.env.NEXT_PUBLIC_BASE_URL,
  })
}
