export interface RequirementsPayloadItem {
  shiftTypeId: string
  roleId: string
  count: number
}

export interface RequirementRow {
  workplace_id: string
  day_of_week: number
  shift_type_id: string
  role_id: string
  count: number
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

/**
 * Pure: build requirement rows for one payload item across the given working
 * days (defaults to all 7). Non-working days get no rows so the engine skips them.
 */
export function buildRows(
  workplaceId: string,
  item: RequirementsPayloadItem,
  days: number[] = ALL_DAYS,
): RequirementRow[] {
  return days.map((day) => ({
    workplace_id: workplaceId,
    day_of_week: day,
    shift_type_id: item.shiftTypeId,
    role_id: item.roleId,
    count: item.count,
  }))
}
