import { ImageResponse } from 'next/og'

// Branded link-preview card (shown when an invite/schedule link is shared on
// WhatsApp etc). Replaces the generic/default preview with the app's own brand.
export const runtime = 'nodejs'
export const alt = 'מִשְׁמֶרֶת — שיבוץ משמרות אוטומטי'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BRAND = '#3457F0'

/** Load the Assistant Hebrew font for the OG text. Returns null on any failure
 *  so the image still renders (Latin/graphics intact) rather than 500-ing. */
async function loadHebrewFont(weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Assistant:wght@${weight}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    ).then((r) => r.text())
    const url = css.match(/src:\s*url\((.+?)\)\s*format/)?.[1]
    if (!url) return null
    return await fetch(url).then((r) => r.arrayBuffer())
  } catch {
    return null
  }
}

export default async function OpengraphImage() {
  const [bold, regular] = await Promise.all([loadHebrewFont(800), loadHebrewFont(500)])
  const fonts = [
    bold && { name: 'Assistant', data: bold, weight: 800 as const, style: 'normal' as const },
    regular && { name: 'Assistant', data: regular, weight: 500 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 800 | 500; style: 'normal' }[]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 36,
          background: `linear-gradient(135deg, ${BRAND} 0%, #2742c8 100%)`,
          fontFamily: 'Assistant',
          direction: 'rtl',
        }}
      >
        {/* Brand mark: white rounded square + shield (mirrors public/brand.svg) */}
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: 44,
            background: 'rgba(255,255,255,0.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3 19 6v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6Z"
              stroke="#fff"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {/* Niqqud is dropped here on purpose: Satori renders Hebrew combining
            marks as detached glyphs, so the pointed form looks broken. Plain
            "משמרת" is the same brand word and renders cleanly in correct RTL. */}
        <div style={{ fontSize: 100, fontWeight: 800, color: '#fff', letterSpacing: '-2px', direction: 'rtl' }}>
          משמרת
        </div>
        <div style={{ fontSize: 40, fontWeight: 500, color: 'rgba(255,255,255,0.9)', direction: 'rtl' }}>
          שיבוץ משמרות אוטומטי לצוותים
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  )
}
