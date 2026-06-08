import { ImageResponse } from 'next/og'

// Branded browser-tab favicon: the מִשְׁמֶרֶת shield on the brand-blue rounded
// square (mirrors public/brand.svg). Replaces the default starter favicon.
export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#3457F0',
          borderRadius: 14,
        }}
      >
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3 19 6v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6Z"
            stroke="#fff"
            strokeWidth={1.7}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  )
}
