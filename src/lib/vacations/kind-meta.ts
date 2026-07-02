export type AbsenceKind = 'vacation' | 'miluim' | 'sick'

export interface AbsenceKindMeta {
  label: string
  color: string
  soft: string
}

/**
 * Single source of truth for how each absence kind renders (label + theme
 * colors), shared by the manager sheet (WorkerVacationSheet), the worker's
 * own rows (VacationRowCard), and the dashboard's pending chip
 * (PendingVacations). חופשה keeps its existing accent, מילואים keeps
 * warning, מחלה uses the danger family.
 */
export const ABSENCE_KIND_META: Record<AbsenceKind, AbsenceKindMeta> = {
  vacation: { label: 'חופשה', color: 'var(--vacation)', soft: 'var(--vacation-soft)' },
  miluim: { label: 'מילואים', color: 'var(--warning)', soft: 'var(--warning-soft)' },
  sick: { label: 'מחלה', color: 'var(--danger)', soft: 'var(--danger-soft)' },
}

export const ABSENCE_KIND_OPTIONS: { value: AbsenceKind; label: string }[] = [
  { value: 'vacation', label: ABSENCE_KIND_META.vacation.label },
  { value: 'miluim', label: ABSENCE_KIND_META.miluim.label },
  { value: 'sick', label: ABSENCE_KIND_META.sick.label },
]
