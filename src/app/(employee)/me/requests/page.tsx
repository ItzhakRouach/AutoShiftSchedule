import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEmployeeRequestsContext } from '@/lib/requests/context'
import { formatHebDate } from '@/lib/dates/week'
import { RequestsHeader } from './RequestsHeader'
import { DayList } from './DayList'
import { VacationSection } from './VacationSection'
import { SubmitBar } from './SubmitBar'

export default async function RequestsPage() {
  const supabase = await createClient()
  const ctx = await getEmployeeRequestsContext(supabase)

  if (!ctx) redirect('/login')

  const { employee, weekStart, period, shiftTypes, requestsByDay, vacations, submittedAt, deadlineLabel } = ctx
  const isReadOnly = !period || period.status !== 'collecting'

  const weekStartDate = new Date(weekStart + 'T00:00:00')
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate)
    d.setDate(weekStartDate.getDate() + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return {
      dayOfWeek: i,
      dateLabel: formatHebDate(iso),
      request: requestsByDay[i] ?? null,
    }
  })

  const filled = days.filter(
    (d) => d.request?.is_off || (d.request?.preferred_shift_ids?.length ?? 0) > 0,
  ).length

  return (
    <main className="page-wrap narrow" style={{ direction: 'rtl' }}>
      <RequestsHeader
        weekLabel={formatHebDate(weekStart)}
        filled={filled}
        total={7}
        isReadOnly={isReadOnly}
        deadlineLabel={deadlineLabel}
      />

      <DayList
        days={days}
        shiftTypes={shiftTypes}
        periodId={period?.id ?? ''}
        employeeId={employee.id}
        isReadOnly={isReadOnly}
      />

      <VacationSection
        employeeId={employee.id}
        vacations={vacations}
        isReadOnly={isReadOnly}
      />

      {!isReadOnly && period && (
        <div style={{ marginTop: 20 }}>
          <SubmitBar periodId={period.id} initialSubmittedAt={submittedAt} deadlineLabel={deadlineLabel} />
        </div>
      )}
    </main>
  )
}
