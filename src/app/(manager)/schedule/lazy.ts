'use client'

// The schedule page's overlays, split out of the page's initial JavaScript.
// Each renders nothing until opened, so there is nothing to server-render; the
// chunks download in the background right after the page mounts, which keeps
// the first open instant while the grid itself becomes interactive sooner.
import dynamic from 'next/dynamic'

export const SwapEditor = dynamic(() => import('./SwapEditor').then((m) => m.SwapEditor), { ssr: false })
export const TwelvePairEditor = dynamic(() => import('./TwelvePairEditor').then((m) => m.TwelvePairEditor), { ssr: false })
export const DayNoteEditor = dynamic(() => import('./DayNoteEditor').then((m) => m.DayNoteEditor), { ssr: false })
export const DistributionDrawer = dynamic(() => import('./DistributionDrawer').then((m) => m.DistributionDrawer), { ssr: false })
export const MoreActionsSheet = dynamic(() => import('./MoreActionsSheet').then((m) => m.MoreActionsSheet), { ssr: false })
export const CoverageIssues = dynamic(() => import('./CoverageIssues').then((m) => m.CoverageIssues), { ssr: false })
export const RegenerateConfirm = dynamic(() => import('./RegenerateConfirm').then((m) => m.RegenerateConfirm), { ssr: false })
