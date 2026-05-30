import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'מִשְׁמֶרֶת — שיבוץ משמרות',
    short_name: 'מִשְׁמֶרֶת',
    description: 'שיבוץ משמרות אוטומטי לפי בקשות, תפקידים וזמני מנוחה',
    lang: 'he',
    dir: 'rtl',
    start_url: '/',
    display: 'standalone',
    background_color: '#EEF0F4',
    theme_color: '#3457F0',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
