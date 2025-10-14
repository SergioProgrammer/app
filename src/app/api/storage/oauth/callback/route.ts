import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code') ?? ''
  const error = url.searchParams.get('error')

  if (error) {
    const description =
      url.searchParams.get('error_description') ??
      'Google devolvió un error durante el proceso de autorización.'
    return new NextResponse(
      `<!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Autorización cancelada</title>
          <style>
            body { font-family: sans-serif; margin: 3rem auto; max-width: 560px; color: #111; background: #fafafa; }
            code { background: #eee; padding: 0.2rem 0.4rem; border-radius: 4px; }
            a { color: #0d6efd; text-decoration: none; }
          </style>
        </head>
        <body>
          <h1>La autorización se canceló</h1>
          <p>Google respondió con el error <code>${error}</code>.</p>
          <p>${description}</p>
          <p>Vuelve a la terminal y ejecuta <code>npm run drive:auth</code> de nuevo para reintentar.</p>
        </body>
      </html>`,
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  if (!code) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Sin código de autorización</title>
          <style>
            body { font-family: sans-serif; margin: 3rem auto; max-width: 560px; color: #111; background: #fafafa; }
            code { background: #eee; padding: 0.2rem 0.4rem; border-radius: 4px; }
            a { color: #0d6efd; text-decoration: none; }
          </style>
        </head>
        <body>
          <h1>No recibimos ningún código</h1>
          <p>No se encontró el parámetro <code>code</code> en la URL.</p>
          <p>Vuelve a la terminal y ejecuta <code>npm run drive:auth</code> de nuevo.</p>
        </body>
      </html>`,
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  return new NextResponse(
    `<!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Autorización completada</title>
        <style>
          body { font-family: sans-serif; margin: 3rem auto; max-width: 640px; color: #111; background: #fafafa; }
          code, pre { background: #eee; padding: 0.2rem 0.4rem; border-radius: 4px; }
          pre { white-space: break-spaces; word-break: break-all; padding: 1rem; }
          a { color: #0d6efd; text-decoration: none; }
        </style>
      </head>
      <body>
        <h1>¡Autorización completada!</h1>
        <p>Copia el siguiente código y pégalo en la terminal donde ejecutaste <code>npm run drive:auth</code>:</p>
        <pre>${code}</pre>
        <p>Después puedes cerrar esta pestaña.</p>
      </body>
    </html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
