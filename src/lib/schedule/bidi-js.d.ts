declare module 'bidi-js' {
  export interface EmbeddingLevelsResult {
    levels: Uint8Array
    paragraphs: { start: number; end: number; level: number }[]
  }
  export interface BidiApi {
    getEmbeddingLevels(text: string, baseDirection?: 'ltr' | 'rtl' | 'auto'): EmbeddingLevelsResult
    getReorderedString(text: string, embeddingLevels: EmbeddingLevelsResult, start?: number, end?: number): string
    getReorderedIndices(text: string, embeddingLevels: EmbeddingLevelsResult, start?: number, end?: number): number[]
  }
  const bidiFactory: () => BidiApi
  export default bidiFactory
}
