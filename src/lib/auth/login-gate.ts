import type { UserRole } from './role'

export type LoginScreen = 'manager' | 'employee'

export type LoginGate =
  | { ok: true; dest: string }
  | { ok: false; correctScreen: LoginScreen }

/** Where each role lands after a successful login. Shared by loginGate and the
 *  screen-agnostic password-reset redirect so the two never drift. */
export const DEST_FOR_ROLE: Record<UserRole, string> = {
  manager: '/dashboard',
  employee: '/me',
  none: '/onboarding',
}

// Which login screen a role belongs to. A `none` account (authenticated but not
// yet onboarded) is a manager-to-be, so it belongs to the manager screen.
const SCREEN_FOR_ROLE: Record<UserRole, LoginScreen> = {
  manager: 'manager',
  none: 'manager',
  employee: 'employee',
}

/**
 * Decides whether a login attempt on a given screen is allowed for the resolved
 * account role. Match → allowed, with the role's home destination. Mismatch →
 * blocked, naming the screen the account should use instead.
 */
export function loginGate(intended: LoginScreen, role: UserRole): LoginGate {
  const belongs = SCREEN_FOR_ROLE[role]
  if (intended === belongs) return { ok: true, dest: DEST_FOR_ROLE[role] }
  return { ok: false, correctScreen: belongs }
}
