import { Spinner } from './Spinner'

/**
 * Centered route-transition spinner. Rendered by per-segment `loading.tsx`
 * files so navigating between tabs shows instant feedback while the next
 * server component streams in.
 */
export function RouteLoading() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--accent)',
      }}
    >
      <Spinner size={34} thickness={3} aria-label="טוען עמוד" />
    </div>
  )
}
