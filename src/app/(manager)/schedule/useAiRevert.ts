'use client'

import { useMemo, useSyncExternalStore } from 'react'
import type { DbSwap } from '@/lib/ai/swap-rows'

const keyOf = (periodId: string) => `ai-revert:${periodId}`
const listeners = new Set<() => void>()
// In-memory fallback for when sessionStorage throws (private mode, blocked).
const memory = new Map<string, string>()

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

function write(key: string, value: string | null) {
  if (value) memory.set(key, value)
  else memory.delete(key)
  try {
    if (value) sessionStorage.setItem(key, value)
    else sessionStorage.removeItem(key)
  } catch {
    // storage unavailable — the in-memory copy still works for this tab
  }
  listeners.forEach((fn) => fn())
}

/**
 * The last applied AI improvement's undo data, per period. Kept in
 * sessionStorage so "בטל שינויי AI" survives a reload of the page; storage is
 * a convenience only — the server re-checks the week before reverting anything.
 */
export function useAiRevert(periodId: string) {
  const key = keyOf(periodId)
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null)
  const revert = useMemo<DbSwap[] | null>(() => {
    if (!raw) return null
    try {
      return JSON.parse(raw) as DbSwap[]
    } catch {
      return null
    }
  }, [raw])
  const setRevert = (next: DbSwap[] | null) => write(key, next ? JSON.stringify(next) : null)
  return [revert, setRevert] as const
}
