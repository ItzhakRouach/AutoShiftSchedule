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

/** Pure function: build 7-day rows from one payload item. Used in actions + unit tests. */
export function buildRows(
  workplaceId: string,
  item: RequirementsPayloadItem,
): RequirementRow[] {
  return Array.from({ length: 7 }, (_, day) => ({
    workplace_id: workplaceId,
    day_of_week: day,
    shift_type_id: item.shiftTypeId,
    role_id: item.roleId,
    count: item.count,
  }))
}
