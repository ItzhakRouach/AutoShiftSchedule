/**
 * Shared PNG rendering helper — used by both the authed API route and the
 * publish upload path, so the preview and the stored image are identical.
 * Renders the SAME structure as the manager week table (see image-rows.ts),
 * in the app's own font (Assistant, static instances — Satori needs raw TTFs).
 */
import 'server-only'
import { ImageResponse } from 'next/og'
import { promises as fs } from 'fs'
import path from 'path'
import type { ScheduleView } from './view-types'
import { buildImageDoc } from './image-rows'
import { ScheduleImageTable } from './image-template/ScheduleImageTable'

export interface RenderedScheduleImage {
  png: Uint8Array
  width: number
  height: number
}

async function loadFonts() {
  const fontsDir = path.join(process.cwd(), 'src', 'assets', 'fonts')
  const [regular, semibold, bold, extrabold] = await Promise.all([
    fs.readFile(path.join(fontsDir, 'Assistant-Regular.ttf')),
    fs.readFile(path.join(fontsDir, 'Assistant-SemiBold.ttf')),
    fs.readFile(path.join(fontsDir, 'Assistant-Bold.ttf')),
    fs.readFile(path.join(fontsDir, 'Assistant-ExtraBold.ttf')),
  ])
  return [
    { name: 'Heb', data: regular.buffer as ArrayBuffer, weight: 400 as const },
    { name: 'Heb', data: semibold.buffer as ArrayBuffer, weight: 600 as const },
    { name: 'Heb', data: bold.buffer as ArrayBuffer, weight: 700 as const },
    { name: 'Heb', data: extrabold.buffer as ArrayBuffer, weight: 800 as const },
  ]
}

/** Renders the schedule PNG (dimensions derive from the schedule's content). */
export async function renderSchedulePng(
  view: ScheduleView,
  workplaceName: string,
): Promise<RenderedScheduleImage> {
  const doc = buildImageDoc(view, workplaceName)
  const fonts = await loadFonts()

  const imgResponse = new ImageResponse(<ScheduleImageTable doc={doc} />, {
    width: doc.width,
    height: doc.height,
    fonts,
  })

  const arrayBuffer = await imgResponse.arrayBuffer()
  return { png: new Uint8Array(arrayBuffer), width: doc.width, height: doc.height }
}
