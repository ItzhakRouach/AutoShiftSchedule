// Public API for the pure scheduling engine.
export * from './types'
export { generateSchedule, validateAssignment } from './engine'
export { checkFeasibility, countRequiredSlots, maxStaffableSlots } from './feasibility'
export {
  buildTwelveHourSuggestions,
  TWELVE_HOUR_COVERS,
  would12hViolateRest,
  twelveHourInterval,
} from './fallback'
export { maxMatch } from './matching'
export { mulberry32, shuffle, draw, hashStr, lotteryRank } from './lottery'
export { restOk, gapHours, shiftStartAbs, shiftEndAbs } from './rest'
export { isAssignable } from './constraints'
export { isSacredBlocked, shabbatBlocks, holidayBlocks } from './shabbat-holiday'
