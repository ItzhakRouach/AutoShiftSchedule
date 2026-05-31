import { z } from 'zod'

const baseAuthSchema = z.object({
  email: z.string().email({ message: 'אימייל לא תקין' }),
  password: z.string().min(8, { message: 'הסיסמה חייבת לפחות 8 תווים' }),
})

export const signInSchema = baseAuthSchema
export const signUpSchema = baseAuthSchema

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
