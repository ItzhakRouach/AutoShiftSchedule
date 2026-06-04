// Unit tests for the pure unpublish helper. Uses hand-rolled fake Supabase +
// admin clients (mirrors src/lib/schedule/prior-deficit.test.ts). The helper
// is the only place that contains DB + storage logic; the server action that
// wraps it is plumbing-only (auth/workplace/revalidate) and is exercised via
// the Playwright smoke in Task 5.
import { describe, it, expect, vi } from 'vitest'
import { unpublishPeriod } from './unpublish'

const WP = 'wp-1'
const PERIOD = 'pd-1'

interface UpdateCall {
  table: string
  setStatus: string
  whereId?: string
  whereWp?: string
  whereStatus?: string
}

interface RemoveCall {
  bucket: string
  paths: string[]
}

function fakeSupabase(updateRowsReturned: number, dbError = false) {
  const calls: UpdateCall[] = []
  const client = {
    from(table: string) {
      const call: UpdateCall = { table, setStatus: '' }
      calls.push(call)
      return {
        update(patch: { status: string }) {
          call.setStatus = patch.status
          return {
            eq(col: string, val: string) {
              if (col === 'id') call.whereId = val
              if (col === 'workplace_id') call.whereWp = val
              if (col === 'status') call.whereStatus = val
              return this
            },
            select() {
              if (dbError) return Promise.resolve({ data: null, error: new Error('boom') })
              const data = Array.from({ length: updateRowsReturned }, (_, i) => ({ id: `row-${i}` }))
              return Promise.resolve({ data, error: null })
            },
          }
        },
      }
    },
  }
  return { client: client as unknown as Parameters<typeof unpublishPeriod>[0], calls }
}

function fakeAdmin(removeShouldThrow = false) {
  const removeCalls: RemoveCall[] = []
  const client = {
    storage: {
      from(bucket: string) {
        return {
          remove(paths: string[]) {
            removeCalls.push({ bucket, paths })
            if (removeShouldThrow) return Promise.reject(new Error('storage down'))
            return Promise.resolve({ data: [], error: null })
          },
        }
      },
    },
  }
  return { client: client as unknown as Parameters<typeof unpublishPeriod>[1], removeCalls }
}

describe('unpublishPeriod', () => {
  it('flips status to locked and deletes the image on the happy path', async () => {
    const { client: sb, calls } = fakeSupabase(1)
    const { client: admin, removeCalls } = fakeAdmin()

    const res = await unpublishPeriod(sb, admin, WP, PERIOD)

    expect(res).toEqual({ didUnpublish: true })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      table: 'schedule_periods',
      setStatus: 'locked',
      whereId: PERIOD,
      whereWp: WP,
      whereStatus: 'published',
    })
    expect(removeCalls).toEqual([
      { bucket: 'schedule-images', paths: [`${WP}/${PERIOD}.png`] },
    ])
  })

  it('is a no-op when no row matched (already locked / wrong workplace)', async () => {
    const { client: sb } = fakeSupabase(0)
    const { client: admin, removeCalls } = fakeAdmin()

    const res = await unpublishPeriod(sb, admin, WP, PERIOD)

    expect(res).toEqual({ didUnpublish: false })
    // No storage call: nothing was unpublished, so nothing to delete.
    expect(removeCalls).toEqual([])
  })

  it('is a no-op when the DB returns an error (defence-in-depth)', async () => {
    const { client: sb } = fakeSupabase(0, true)
    const { client: admin, removeCalls } = fakeAdmin()

    const res = await unpublishPeriod(sb, admin, WP, PERIOD)

    expect(res).toEqual({ didUnpublish: false })
    expect(removeCalls).toEqual([])
  })

  it('still reports didUnpublish: true when storage deletion throws', async () => {
    const { client: sb } = fakeSupabase(1)
    const { client: admin, removeCalls } = fakeAdmin(true)

    const res = await unpublishPeriod(sb, admin, WP, PERIOD)

    expect(res).toEqual({ didUnpublish: true })
    expect(removeCalls).toHaveLength(1) // attempted once
  })

  it('builds the storage path as `${workplaceId}/${periodId}.png`', async () => {
    const { client: sb } = fakeSupabase(1)
    const { client: admin, removeCalls } = fakeAdmin()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await unpublishPeriod(sb, admin, 'wp-A', 'pd-B')

    expect(removeCalls[0].paths).toEqual(['wp-A/pd-B.png'])
    spy.mockRestore()
  })
})
