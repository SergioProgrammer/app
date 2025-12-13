declare module 'pdfjs-dist' {
  export function getDocument(data: unknown): {
    promise: Promise<{
      numPages: number
      getPage: (pageNumber: number) => Promise<{
        getViewport: (params: { scale: number }) => { width: number; height: number }
        render: (params: { canvasContext: unknown; viewport: { width: number; height: number } }) => { promise: Promise<void> }
      }>
    }>
  }
}

declare module '@napi-rs/canvas' {
  export interface CanvasRenderingContext2D {
    canvas: Canvas
  }

  export interface Canvas {
    width: number
    height: number
    getContext: (contextId: '2d') => CanvasRenderingContext2D
    toBuffer: (type?: string) => Buffer
  }

  export function createCanvas(width: number, height: number): Canvas
}
