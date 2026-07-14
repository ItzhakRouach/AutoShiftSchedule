import { z } from 'zod'

const baseAuthSchema = z.object({
  email: z.string().email({ message: 'אימייל לא תקין' }),
  password: z.string().min(8, { message: 'הסיסמה חייבת לפחות 8 תווים' }),
})

export const signInSchema = baseAuthSchema
export const signUpSchema = baseAuthSchema

/** New-password form (reset flow): min length + explicit confirmation match. */
export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, { message: 'הסיסמה חייבת להכיל לפחות 8 תווים' }),
    passwordConfirm: z.string().min(1, { message: 'יש להזין את הסיסמה פעם נוספת' }),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'הסיסמאות אינן תואמות',
  })

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
