export {}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: any) => void
      getResponse: () => string
    }
  }
}
