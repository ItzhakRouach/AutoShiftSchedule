import { createClient } from '@/lib/supabase/server'
import { renderSchedulePng, IMAGE_WIDTH, IMAGE_HEIGHT } from '@/lib/schedule/render-image'
import type { RawAssignment } from '@/lib/schedule/image-data'

export const runtime = 'nodejs'

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

  type STKey = { key: string }
  type EmpName = { name: string }
  const assignments: RawAssignment[] = (assignsRaw ?? []).map((a) => ({
    day_of_week: a.day_of_week,
    shift_type_key: (a.shift_types as unknown as STKey | null)?.key ?? '',
    employee_name: (a.employees as unknown as EmpName | null)?.name ?? '',
  }))

  const required: Record<number, Record<string, number>> = {}
  for (const r of reqRaw ?? []) {
    const sk = (r.shift_types as unknown as STKey | null)?.key
    if (!sk) continue
    const day = r.day_of_week as number
    ;(required[day] ??= {})[sk] = ((required[day]?.[sk]) ?? 0) + (r.count as number)
  }

  const png = await renderSchedulePng({
    workplaceName: workplace?.name ?? 'סידור שבועי',
    weekStartISO: period.week_start_date,
    assignments,
    required,
  })

  return new Response(png.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
      'X-Image-Width': String(IMAGE_WIDTH),
      'X-Image-Height': String(IMAGE_HEIGHT),
    },
  })
}
