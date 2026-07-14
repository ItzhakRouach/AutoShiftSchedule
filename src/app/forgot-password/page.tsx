import { ForgotPasswordForm } from './ForgotPasswordForm'

interface ForgotPasswordPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  // /auth/callback bounces here with ?error=1 when the reset link failed
  // (expired, reused, or opened in a different browser than requested it).
  const { error } = await searchParams
  return <ForgotPasswordForm linkFailed={error === '1'} />
}
