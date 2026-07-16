import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getScheduleImageView } from '@/lib/schedule/image-view'
import { renderSchedulePng } from '@/lib/schedule/render-image'

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

  // F-17: non-managers can only fetch images for PUBLISHED periods. Drafts and
  // locked-but-not-published states reveal in-progress arrangements that
  // shouldn't be visible to employees, even though RLS lets them SELECT the
  // period row itself (employees can see their own workplace's periods to
  // know "what week is this"). Owner check matches `owns_workplace` semantics.
  if (period.status !== 'published') {
    const { data: wpRow } = await supabase
      .from('workplaces')
      .select('owner_id')
      .eq('id', period.workplace_id)
      .maybeSingle()
    if (wpRow?.owner_id !== user.id) return new Response('Not found', { status: 404 })
  }

  // Access proven above — load the render data with the admin client so the
  // image never varies with the viewer's RLS scope (employees can't read
  // shift_requirements, which drives the role rows). Same loader as the
  // publish upload path, so preview and stored PNG are pixel-identical.
  const { view, workplaceName } = await getScheduleImageView(createAdminClient(), period)
  const { png, width, height } = await renderSchedulePng(view, workplaceName)

  return new Response(png.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
      'X-Image-Width': String(width),
      'X-Image-Height': String(height),
    },
  })
}
