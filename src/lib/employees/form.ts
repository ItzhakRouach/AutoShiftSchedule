import { employeeSchema } from '@/lib/validation/employee'

export function parseFormData(formData: FormData) {
  const name = (formData.get('name') as string | null) ?? ''
  const phone = (formData.get('phone') as string | null) ?? ''
  const minShifts = parseInt((formData.get('minShifts') as string | null) ?? '0', 10)
  const observesShabbat = formData.get('observesShabbat') === 'true'
  const observesHolidays = formData.get('observesHolidays') === 'true'
  const mustAccept = formData.get('mustAccept') === 'true'

  // roleIds can come as multiple entries OR a single comma-joined value
  const roleIdsRaw = formData.getAll('roleIds')
  const roleIds =
    roleIdsRaw.length === 1 && (roleIdsRaw[0] as string).includes(',')
      ? (roleIdsRaw[0] as string).split(',').map((s) => s.trim()).filter(Boolean)
      : (roleIdsRaw as string[]).filter(Boolean)

  return { name, phone, minShifts, observesShabbat, observesHolidays, mustAccept, roleIds }
}

export function buildFieldErrors(
  err: ReturnType<typeof employeeSchema.safeParse>,
): Record<string, string> {
  if (err.success) return {}
  const out: Record<string, string> = {}
  for (const issue of err.error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
