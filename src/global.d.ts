export {}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => void
      getResponse: () => string
    }
  }
}
