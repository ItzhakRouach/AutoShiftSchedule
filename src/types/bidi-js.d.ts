// Minimal type declaration for `bidi-js` — used by src/lib/schedule/bidi.ts
// to reorder Hebrew strings for the schedule-image PNG. The library has no
// shipped @types package; only the two methods we call are typed here.

declare module 'bidi-js' {
  interface BidiLevels {
    readonly levels: ReadonlyArray<number>
  }
  interface Bidi {
    getEmbeddingLevels(text: string, baseDirection?: 'ltr' | 'rtl' | 'auto'): BidiLevels
    getReorderedString(text: string, levels: BidiLevels): string
  }
  function bidiFactory(): Bidi
  export default bidiFactory
}
