import { z } from 'zod'

export const signInSchema = z.object({
  email: z.string().email({ message: 'אימייל לא תקין' }),
  password: z.string().min(8, { message: 'הסיסמה חייבת לפחות 8 תווים' }),
})

export const signUpSchema = z.object({
  email: z.string().email({ message: 'אימייל לא תקין' }),
  password: z.string().min(8, { message: 'הסיסמה חייבת לפחות 8 תווים' }),
})

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
