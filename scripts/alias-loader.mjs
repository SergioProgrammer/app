import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const srcDir = path.join(process.cwd(), 'src')
const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

function resolveAlias(specifier) {
  if (!specifier.startsWith('@/')) return null
  const relativePath = specifier.slice(2)
  const candidates = [
    path.join(srcDir, `${relativePath}.ts`),
    path.join(srcDir, `${relativePath}.tsx`),
    path.join(srcDir, relativePath, 'index.ts'),
    path.join(srcDir, relativePath, 'index.tsx'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return pathToFileURL(candidate).href
    }
  }
  return pathToFileURL(path.join(srcDir, relativePath)).href
}

function resolveTsLike(specifier, parentURL) {
  const parentPath = parentURL ? fileURLToPath(parentURL) : process.cwd()
  const basePath = specifier.startsWith('file:')
    ? fileURLToPath(specifier)
    : specifier.startsWith('/')
    ? specifier
    : path.resolve(path.dirname(parentPath), specifier)

  const hasExtension = TS_EXTENSIONS.some((ext) => basePath.endsWith(ext))
  const candidates = hasExtension
    ? [basePath]
    : [
        `${basePath}.ts`,
        `${basePath}.tsx`,
        `${basePath}/index.ts`,
        `${basePath}/index.tsx`,
      ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return pathToFileURL(candidate).href
    }
  }
  return null
}

export async function resolve(specifier, context, next) {
  const mapped = resolveAlias(specifier)
  if (mapped) {
    return { url: mapped, shortCircuit: true }
  }
  if (specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/')) {
    const tsResolved = resolveTsLike(specifier, context.parentURL)
    if (tsResolved) {
      return { url: tsResolved, shortCircuit: true }
    }
  }
  return next(specifier, context)
}
