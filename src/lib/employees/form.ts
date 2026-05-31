import { employeeSchema, EMPLOYMENT_TYPES, type AvailabilityItem } from '@/lib/validation/employee'

export function parseFormData(formData: FormData) {
  const name = (formData.get('name') as string | null) ?? ''
  const phone = (formData.get('phone') as string | null) ?? ''
  const minShifts = parseInt((formData.get('minShifts') as string | null) ?? '0', 10)
  const observesShabbat = formData.get('observesShabbat') === 'true'
  const observesHolidays = formData.get('observesHolidays') === 'true'
  const mustAccept = formData.get('mustAccept') === 'true'

  // employmentType
  const rawType = (formData.get('employmentType') as string | null) ?? 'full'
  const employmentType = (EMPLOYMENT_TYPES as readonly string[]).includes(rawType)
    ? (rawType as typeof EMPLOYMENT_TYPES[number])
    : 'full'

  // maxShifts: empty string or 'null' = null (unrestricted)
  const rawMax = (formData.get('maxShifts') as string | null) ?? ''
  const maxShifts = rawMax === '' || rawMax === 'null' ? null : parseInt(rawMax, 10)

  // roleIds can come as multiple entries OR a single comma-joined value
  const roleIdsRaw = formData.getAll('roleIds')
  const roleIds =
    roleIdsRaw.length === 1 && (roleIdsRaw[0] as string).includes(',')
      ? (roleIdsRaw[0] as string).split(',').map((s) => s.trim()).filter(Boolean)
      : (roleIdsRaw as string[]).filter(Boolean)

  // availability: JSON-encoded array or null
  const customAvailability = formData.get('customAvailability') === 'true'
  let availability: AvailabilityItem[] | null = null
  if (customAvailability) {
    try {
      const raw = formData.get('availability') as string | null
      availability = raw ? (JSON.parse(raw) as AvailabilityItem[]) : []
    } catch {
      availability = []
    }
  }

  return {
    name, phone, minShifts, maxShifts, employmentType,
    observesShabbat, observesHolidays, mustAccept, roleIds, availability,
    customAvailability,
  }
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
