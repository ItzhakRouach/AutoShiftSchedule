export type RoleName = 'אחמ״ש' | 'מוקדן' | 'מאבטח'

export interface RoleMeta { color: string; soft: string; short: string }

export const ROLES: RoleName[] = ['אחמ״ש', 'מוקדן', 'מאבטח']

export const ROLE_META: Record<RoleName, RoleMeta> = {
  'אחמ״ש': { color: '#E0902A', soft: 'rgba(224,144,42,0.14)', short: 'אחמ״ש' },
  'מוקדן': { color: '#3D6BF5', soft: 'rgba(61,107,245,0.14)', short: 'מוקדן' },
  'מאבטח': { color: '#13A98E', soft: 'rgba(19,169,142,0.14)', short: 'מאבטח' },
}

export type ShiftId =
  | 'morning' | 'noon' | 'night'
  | 'm12_day' | 'm12_night' | 'm12_3to15' | 'm12_15to3'

export interface ShiftMeta {
  id: ShiftId
  name: string
  time: string
  start: number   // start hour (0-23)
  hours: number   // duration in hours
  color: string
  soft: string
  icon: string
  isFallback: boolean
}

export const SHIFT_ORDER: ShiftId[] = ['morning', 'noon', 'night']
export const FALLBACK_12H_ORDER: ShiftId[] = ['m12_day', 'm12_night', 'm12_3to15', 'm12_15to3']

// Default staffing per BASE shift × role (ported from DesignTemplate/data.jsx).
// Applied to every day of the week on workplace creation. Only counts > 0 create rows.
export const DEFAULT_REQUIREMENTS: Record<'morning' | 'noon' | 'night', Partial<Record<RoleName, number>>> = {
  morning: { 'אחמ״ש': 1, 'מוקדן': 1, 'מאבטח': 1 },
  noon:    { 'אחמ״ש': 1, 'מוקדן': 1, 'מאבטח': 1 },
  night:   { 'אחמ״ש': 1, 'מוקדן': 1, 'מאבטח': 1 },
}

export const SHIFT_META: Record<ShiftId, ShiftMeta> = {
  morning:   { id: 'morning', name: 'בוקר',   time: '07:00–15:00', start: 7,  hours: 8,  color: '#F2A93B', soft: 'rgba(242,169,59,0.13)', icon: 'sun',    isFallback: false },
  noon:      { id: 'noon',    name: 'צהריים', time: '15:00–23:00', start: 15, hours: 8,  color: '#EB6A4E', soft: 'rgba(235,106,78,0.13)', icon: 'sunset', isFallback: false },
  night:     { id: 'night',   name: 'לילה',   time: '23:00–07:00', start: 23, hours: 8,  color: '#5B61D6', soft: 'rgba(91,97,214,0.15)', icon: 'moon',   isFallback: false },
  m12_day:   { id: 'm12_day',   name: 'יום 12ש׳',   time: '07:00–19:00', start: 7,  hours: 12, color: '#F2A93B', soft: 'rgba(242,169,59,0.13)', icon: 'sun',  isFallback: true },
  m12_night: { id: 'm12_night', name: 'לילה 12ש׳',  time: '19:00–07:00', start: 19, hours: 12, color: '#5B61D6', soft: 'rgba(91,97,214,0.15)', icon: 'moon', isFallback: true },
  m12_3to15: { id: 'm12_3to15', name: '03–15',      time: '03:00–15:00', start: 3,  hours: 12, color: '#EB6A4E', soft: 'rgba(235,106,78,0.13)', icon: 'sunset', isFallback: true },
  m12_15to3: { id: 'm12_15to3', name: '15–03',      time: '15:00–03:00', start: 15, hours: 12, color: '#5B61D6', soft: 'rgba(91,97,214,0.15)', icon: 'moon', isFallback: true },
}
