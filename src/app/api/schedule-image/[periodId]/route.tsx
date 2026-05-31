import { ImageResponse } from 'next/og'
import { promises as fs } from 'fs'
import path from 'path'
import { createClient } from '@/lib/supabase/server'
import { formatHebDate } from '@/lib/dates/week'
import { buildImageGrid } from '@/lib/schedule/image-data'
import { ScheduleImageTemplate } from '../schedule-image-template'

export const runtime = 'nodejs'

const WIDTH = 1200
const HEIGHT = 800

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const { periodId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Load period (RLS ensures ownership)
  const { data: period } = await supabase
    .from('schedule_periods')
    .select('id, week_start_date, status, workplace_id')
    .eq('id', periodId)
    .maybeSingle()

  if (!period) return new Response('Not found', { status: 404 })

  // Load workplace name
  const { data: workplace } = await supabase
    .from('workplaces')
    .select('name')
    .eq('id', period.workplace_id)
    .maybeSingle()

  // Load assignments with employee names + shift type keys
  const { data: assignsRaw } = await supabase
    .from('assignments')
    .select('day_of_week, employee_id, shift_type_id, employees(name), shift_types(key)')
    .eq('period_id', periodId)

  // Load requirements aggregated by day+shiftKey for unfilled detection
  const { data: reqRaw } = await supabase
    .from('shift_requirements')
    .select('day_of_week, count, shift_types(key)')
    .eq('workplace_id', period.workplace_id)

  // Build day dates array (7 days from week_start)
  const weekStart = new Date(period.week_start_date + 'T00:00:00')
  const dayDates: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return formatHebDate(d.toISOString().slice(0, 10))
  })

  // Week label e.g. "31.5 – 6.6"
  const lastDay = new Date(weekStart)
  lastDay.setDate(weekStart.getDate() + 6)
  const weekLabel = `${dayDates[0]} – ${dayDates[6]}.${lastDay.getFullYear()}`

  // Shape assignments
  type STKey = { key: string }
  type EmpName = { name: string }
  const assignments = (assignsRaw ?? []).map((a) => ({
    day_of_week: a.day_of_week,
    shift_type_key: (a.shift_types as unknown as STKey | null)?.key ?? '',
    employee_name: (a.employees as unknown as EmpName | null)?.name ?? '',
  }))

  // Required counts: day → shiftKey → total count
  const required: Record<number, Record<string, number>> = {}
  for (const r of reqRaw ?? []) {
    const sk = (r.shift_types as unknown as STKey | null)?.key
    if (!sk) continue
    const day = r.day_of_week as number
    ;(required[day] ??= {})[sk] = ((required[day]?.[sk]) ?? 0) + (r.count as number)
  }

  const grid = buildImageGrid(assignments, required)

  const fonts = await loadFonts()

  return new ImageResponse(
    <ScheduleImageTemplate
      workplaceName={workplace?.name ?? 'סידור שבועי'}
      weekLabel={weekLabel}
      dayDates={dayDates}
      grid={grid}
    />,
    { width: WIDTH, height: HEIGHT, fonts },
  )
}
