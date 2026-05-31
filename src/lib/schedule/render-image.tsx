/**
 * Shared PNG rendering helper.
 * Used by both the authed API route and the publish cron job.
 * Keeps the rendering logic in one place (DRY).
 */
import 'server-only'
import { ImageResponse } from 'next/og'
import { promises as fs } from 'fs'
import path from 'path'
import { formatHebDate } from '@/lib/dates/week'
import { buildImageGrid, type RawAssignment } from '@/lib/schedule/image-data'
import { ScheduleImageTemplate } from '@/app/api/schedule-image/schedule-image-template'

export const IMAGE_WIDTH = 1200
export const IMAGE_HEIGHT = 800

export interface ScheduleImageData {
  workplaceName: string
  weekStartISO: string // YYYY-MM-DD
  assignments: RawAssignment[]
  /** required[day][shiftKey] = headcount */
  required: Record<number, Record<string, number>>
}

async function loadFonts() {
  const fontsDir = path.join(process.cwd(), 'src', 'assets', 'fonts')
  const [regular, bold] = await Promise.all([
    fs.readFile(path.join(fontsDir, 'Heebo-Regular.ttf')),
    fs.readFile(path.join(fontsDir, 'Heebo-Bold.ttf')),
  ])
  return [
    { name: 'Heb', data: regular.buffer as ArrayBuffer, weight: 400 as const },
    { name: 'Heb', data: bold.buffer as ArrayBuffer, weight: 700 as const },
  ]
}

function buildWeekMeta(weekStartISO: string) {
  const weekStart = new Date(weekStartISO + 'T00:00:00')
  const dayDates: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return formatHebDate(d.toISOString().slice(0, 10))
  })
  const lastDay = new Date(weekStart)
  lastDay.setDate(weekStart.getDate() + 6)
  const weekLabel = `${dayDates[0]} – ${dayDates[6]}.${lastDay.getFullYear()}`
  return { dayDates, weekLabel }
}

/**
 * Renders the schedule PNG and returns its raw bytes as a Uint8Array.
 * Suitable for both HTTP responses and Supabase Storage uploads.
 */
export async function renderSchedulePng(data: ScheduleImageData): Promise<Uint8Array> {
  const { dayDates, weekLabel } = buildWeekMeta(data.weekStartISO)
  const grid = buildImageGrid(data.assignments, data.required)
  const fonts = await loadFonts()

  const imgResponse = new ImageResponse(
    <ScheduleImageTemplate
      workplaceName={data.workplaceName}
      weekLabel={weekLabel}
      dayDates={dayDates}
      grid={grid}
    />,
    { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, fonts },
  )

  const arrayBuffer = await imgResponse.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}
