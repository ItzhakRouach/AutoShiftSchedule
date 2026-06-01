// Public API for the pure scheduling engine.
export * from './types'
export { generateSchedule, validateAssignment } from './engine'
export { checkFeasibility, countRequiredSlots, maxStaffableSlots } from './feasibility'
export {
  buildTwelveHourSuggestions,
  TWELVE_HOUR_COVERS,
  TWELVE_HOUR_FILLS,
  TWELVE_HOUR_PREFERENCE,
  would12hViolateRest,
  twelveHourInterval,
} from './fallback'
export { runTwelveFill } from './twelve-fill'
export { canTwelve } from './twelve-rules'
export { maxMatch } from './matching'
export {
  fairnessScore,
  byType,
  typeSpread,
  unpopularLoad,
  WEEKEND_DAYS,
} from './fairness'
export { runDiversityPass, diversityCost } from './diversity'
export { satisfiedCount, requestCount, floorTarget, preservesRequestsFor } from './request-gate'
export { mulberry32, shuffle, draw, hashStr, lotteryRank } from './lottery'
export { restOk, gapHours, shiftStartAbs, shiftEndAbs } from './rest'
export { isAssignable } from './constraints'
export { isSacredBlocked, shabbatBlocks, holidayBlocks } from './shabbat-holiday'
