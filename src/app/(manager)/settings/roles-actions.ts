'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'

export type RoleActionState = { ok?: boolean; error?: string }

const HEX = /^#[0-9a-fA-F]{6}$/

async function ctx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const workplace = await getActiveWorkplace(supabase)
  return { supabase, workplace }
}

function done(): RoleActionState {
  revalidatePath('/settings')
  revalidatePath('/schedule')
  return { ok: true }
}

const nameSchema = z.string().trim().min(1, 'שם חסר').max(40, 'שם ארוך מדי')
const colorSchema = z.string().regex(HEX, 'צבע לא תקין')

/** Add a new active role; rank defaults to senior-most (max+1). */
export async function addRole(name: string, color: string): Promise<RoleActionState> {
  const { supabase, workplace } = await ctx()
  if (!workplace) return { error: 'לא נמצא מקום עבודה.' }
  const n = nameSchema.safeParse(name)
  const c = colorSchema.safeParse(color)
  if (!n.success) return { error: n.error.issues[0].message }
  if (!c.success) return { error: c.error.issues[0].message }

  const { data: existing } = await supabase
    .from('roles')
    .select('rank')
    .eq('workplace_id', workplace.id)
    .eq('is_active', true)
  const maxRank = Math.max(0, ...(existing ?? []).map((r) => r.rank ?? 1))

  const { error } = await supabase
    .from('roles')
    .insert({ workplace_id: workplace.id, name: n.data, color: c.data, rank: maxRank + 1, is_active: true })
  if (error) return { error: 'שגיאה בהוספת תפקיד' }
  return done()
}

/** Rename / recolor / re-rank an existing role. */
export async function updateRole(
  id: string,
  fields: { name?: string; color?: string; rank?: number },
): Promise<RoleActionState> {
  const { supabase, workplace } = await ctx()
  if (!workplace) return { error: 'לא נמצא מקום עבודה.' }

  const patch: Record<string, unknown> = {}
  if (fields.name !== undefined) {
    const n = nameSchema.safeParse(fields.name)
    if (!n.success) return { error: n.error.issues[0].message }
    patch.name = n.data
  }
  if (fields.color !== undefined) {
    const c = colorSchema.safeParse(fields.color)
    if (!c.success) return { error: c.error.issues[0].message }
    patch.color = c.data
  }
  if (fields.rank !== undefined) {
    if (!Number.isInteger(fields.rank) || fields.rank < 1 || fields.rank > 20) return { error: 'דרגה לא תקינה' }
    patch.rank = fields.rank
  }
  if (Object.keys(patch).length === 0) return { ok: true }

  const { error } = await supabase
    .from('roles')
    .update(patch)
    .eq('id', id)
    .eq('workplace_id', workplace.id)
  if (error) return { error: 'שגיאה בעדכון תפקיד' }
  return done()
}

/** Soft-delete a role: hide it + drop its staffing requirements. Blocks the last role. */
export async function deactivateRole(id: string): Promise<RoleActionState> {
  const { supabase, workplace } = await ctx()
  if (!workplace) return { error: 'לא נמצא מקום עבודה.' }

  const { data: active } = await supabase
    .from('roles')
    .select('id')
    .eq('workplace_id', workplace.id)
    .eq('is_active', true)
  if ((active ?? []).length <= 1) return { error: 'חייב להישאר לפחות תפקיד אחד' }

  const { error } = await supabase
    .from('roles')
    .update({ is_active: false })
    .eq('id', id)
    .eq('workplace_id', workplace.id)
  if (error) return { error: 'שגיאה בהסרת תפקיד' }

  await supabase.from('shift_requirements').delete().eq('workplace_id', workplace.id).eq('role_id', id)
  return done()
}
