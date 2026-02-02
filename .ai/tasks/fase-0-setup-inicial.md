# Fase 0: Setup Inicial

## Resumen
Preparar el proyecto para la refactorización: testing, estructura de carpetas y configuración.

---

## Tareas

### 0.1 - Instalar y configurar Vitest
**Estimación:** XS (< 1h)
**Tipo:** Setup

**Descripción:**
Instalar Vitest y dependencias necesarias para testing unitario y de componentes React.

**Criterios de aceptación:**
- [ ] Dependencias instaladas: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- [ ] Archivo `vitest.config.ts` creado en la raíz
- [ ] Script `test` añadido a `package.json`
- [ ] Script `test:watch` añadido a `package.json`
- [ ] Script `test:coverage` añadido a `package.json`

**Comandos de referencia:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

---

### 0.2 - Crear test de humo para Vitest
**Estimación:** XS (< 1h)
**Tipo:** Testing
**Depende de:** 0.1

**Descripción:**
Crear un test simple que verifique que Vitest funciona correctamente.

**Criterios de aceptación:**
- [ ] Archivo `tests/unit/smoke.test.ts` creado
- [ ] Test pasa con `npm test`
- [ ] El test verifica algo trivial (ej: `1 + 1 = 2`)

**Código de referencia:**
```typescript
// tests/unit/smoke.test.ts
import { describe, it, expect } from 'vitest'

describe('Smoke test', () => {
  it('should verify vitest is working', () => {
    expect(1 + 1).toBe(2)
  })
})
```

---

### 0.3 - Instalar y configurar Playwright
**Estimación:** S (1-2h)
**Tipo:** Setup

**Descripción:**
Instalar Playwright para tests E2E.

**Criterios de aceptación:**
- [ ] Dependencia instalada: `@playwright/test`
- [ ] Browsers instalados con `npx playwright install`
- [ ] Archivo `playwright.config.ts` creado
- [ ] Script `test:e2e` añadido a `package.json`

**Comandos de referencia:**
```bash
npm install -D @playwright/test
npx playwright install chromium
```

---

### 0.4 - Crear test E2E de humo
**Estimación:** S (1-2h)
**Tipo:** Testing
**Depende de:** 0.3

**Descripción:**
Crear un test E2E simple que verifique que la app carga correctamente.

**Criterios de aceptación:**
- [ ] Archivo `tests/e2e/smoke.spec.ts` creado
- [ ] Test navega a la página principal
- [ ] Test verifica que algún elemento existe
- [ ] Test pasa con `npm run test:e2e`

**Código de referencia:**
```typescript
// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test'

test('app loads correctly', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/ProcesIA|Login/)
})
```

---

### 0.5 - Crear estructura de carpetas del servidor
**Estimación:** XS (< 1h)
**Tipo:** Refactor

**Descripción:**
Crear la estructura de carpetas para el backend siguiendo DDD.

**Criterios de aceptación:**
- [ ] Carpeta `src/server/labels/domain/entities/` creada
- [ ] Carpeta `src/server/labels/domain/value-objects/` creada
- [ ] Carpeta `src/server/labels/domain/services/` creada
- [ ] Carpeta `src/server/labels/domain/repositories/` creada
- [ ] Carpeta `src/server/labels/application/use-cases/` creada
- [ ] Carpeta `src/server/labels/application/dto/` creada
- [ ] Carpeta `src/server/labels/infrastructure/pdf/` creada
- [ ] Carpeta `src/server/labels/infrastructure/persistence/` creada
- [ ] Carpeta `src/server/labels/infrastructure/storage/` creada
- [ ] Carpeta `src/server/shared/domain/` creada

**Comando:**
```bash
mkdir -p src/server/labels/domain/{entities,value-objects,services,repositories}
mkdir -p src/server/labels/application/{use-cases,dto}
mkdir -p src/server/labels/infrastructure/{pdf,persistence,storage}
mkdir -p src/server/shared/domain
```

---

### 0.6 - Crear estructura de carpetas del cliente
**Estimación:** XS (< 1h)
**Tipo:** Refactor

**Descripción:**
Crear la estructura de carpetas para el frontend.

**Criterios de aceptación:**
- [ ] Carpeta `src/client/labels/components/` creada
- [ ] Carpeta `src/client/labels/hooks/` creada
- [ ] Carpeta `src/client/labels/services/` creada
- [ ] Carpeta `src/client/labels/types/` creada
- [ ] Carpeta `src/client/shared/components/` creada
- [ ] Carpeta `src/client/shared/hooks/` creada
- [ ] Carpeta `src/client/shared/utils/` creada

**Comando:**
```bash
mkdir -p src/client/labels/{components,hooks,services,types}
mkdir -p src/client/shared/{components,hooks,utils}
```

---

### 0.7 - Crear estructura de carpetas compartida
**Estimación:** XS (< 1h)
**Tipo:** Refactor

**Descripción:**
Crear la estructura de carpetas compartidas entre front y back.

**Criterios de aceptación:**
- [ ] Carpeta `src/shared/types/` creada
- [ ] Carpeta `tests/unit/server/labels/` creada
- [ ] Carpeta `tests/unit/client/labels/` creada
- [ ] Carpeta `tests/integration/labels/` creada
- [ ] Carpeta `tests/e2e/labels/` creada

**Comando:**
```bash
mkdir -p src/shared/types
mkdir -p tests/unit/server/labels/domain/{entities,value-objects,services}
mkdir -p tests/unit/server/labels/application/use-cases
mkdir -p tests/unit/client/labels/{components,hooks}
mkdir -p tests/integration/labels
mkdir -p tests/e2e/labels
```

---

### 0.8 - Configurar path aliases en tsconfig
**Estimación:** XS (< 1h)
**Tipo:** Config
**Depende de:** 0.5, 0.6, 0.7

**Descripción:**
Añadir aliases para las nuevas carpetas en TypeScript.

**Criterios de aceptación:**
- [ ] Alias `@server/*` → `src/server/*`
- [ ] Alias `@client/*` → `src/client/*`
- [ ] Alias `@shared/*` → `src/shared/*`
- [ ] Mantener alias existente `@/*` → `src/*`
- [ ] Imports funcionan correctamente con los nuevos aliases

**Código de referencia:**
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@server/*": ["./src/server/*"],
      "@client/*": ["./src/client/*"],
      "@shared/*": ["./src/shared/*"]
    }
  }
}
```

---

### 0.9 - Crear clase base ValueObject
**Estimación:** S (1-2h)
**Tipo:** Domain
**Depende de:** 0.5

**Descripción:**
Crear la clase abstracta base para Value Objects del dominio.

**Criterios de aceptación:**
- [ ] Archivo `src/server/shared/domain/ValueObject.ts` creado
- [ ] Clase abstracta con método `equals()`
- [ ] Test unitario en `tests/unit/server/shared/domain/ValueObject.test.ts`
- [ ] Test pasa

**Código de referencia:**
```typescript
// src/server/shared/domain/ValueObject.ts
export abstract class ValueObject<T> {
  protected readonly props: T

  protected constructor(props: T) {
    this.props = Object.freeze(props)
  }

  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) return false
    return JSON.stringify(this.props) === JSON.stringify(vo.props)
  }
}
```

---

### 0.10 - Crear clase base Entity
**Estimación:** S (1-2h)
**Tipo:** Domain
**Depende de:** 0.5

**Descripción:**
Crear la clase abstracta base para Entities del dominio.

**Criterios de aceptación:**
- [ ] Archivo `src/server/shared/domain/Entity.ts` creado
- [ ] Clase abstracta con `id` y método `equals()`
- [ ] Test unitario en `tests/unit/server/shared/domain/Entity.test.ts`
- [ ] Test pasa

**Código de referencia:**
```typescript
// src/server/shared/domain/Entity.ts
export abstract class Entity<T> {
  protected readonly _id: string
  protected props: T

  protected constructor(props: T, id?: string) {
    this._id = id ?? crypto.randomUUID()
    this.props = props
  }

  get id(): string {
    return this._id
  }

  public equals(entity?: Entity<T>): boolean {
    if (entity === null || entity === undefined) return false
    return this._id === entity._id
  }
}
```

---

### 0.11 - Crear tipo Result para manejo de errores
**Estimación:** S (1-2h)
**Tipo:** Domain
**Depende de:** 0.5

**Descripción:**
Crear el tipo Result para manejo de errores sin excepciones (Railway Oriented Programming).

**Criterios de aceptación:**
- [ ] Archivo `src/server/shared/domain/Result.ts` creado
- [ ] Tipo `Result<T, E>` con métodos `ok()`, `fail()`, `isOk()`, `isFail()`
- [ ] Test unitario en `tests/unit/server/shared/domain/Result.test.ts`
- [ ] Test pasa

**Código de referencia:**
```typescript
// src/server/shared/domain/Result.ts
export type Result<T, E = string> = Ok<T> | Fail<E>

export class Ok<T> {
  readonly value: T
  constructor(value: T) { this.value = value }
  isOk(): this is Ok<T> { return true }
  isFail(): this is Fail<never> { return false }
}

export class Fail<E> {
  readonly error: E
  constructor(error: E) { this.error = error }
  isOk(): this is Ok<never> { return false }
  isFail(): this is Fail<E> { return true }
}

export const ok = <T>(value: T): Ok<T> => new Ok(value)
export const fail = <E>(error: E): Fail<E> => new Fail(error)
```

---

## Orden Sugerido de Ejecución

```
0.1 → 0.2 (Vitest)
0.3 → 0.4 (Playwright)
0.5, 0.6, 0.7 (Estructura - pueden ser paralelas)
0.8 (Path aliases - después de estructura)
0.9, 0.10, 0.11 (Clases base - pueden ser paralelas, después de 0.5)
```

## Diagrama de Dependencias

```
    ┌─────┐     ┌─────┐
    │ 0.1 │────▶│ 0.2 │
    └─────┘     └─────┘

    ┌─────┐     ┌─────┐
    │ 0.3 │────▶│ 0.4 │
    └─────┘     └─────┘

    ┌─────┐
    │ 0.5 │──┬──────────────────┐
    └─────┘  │                  │
             ▼                  ▼
    ┌─────┐ ┌─────┐     ┌─────┬─────┬─────┐
    │ 0.6 │ │ 0.7 │     │ 0.9 │0.10 │0.11 │
    └──┬──┘ └──┬──┘     └─────┴─────┴─────┘
       │       │
       ▼       ▼
       └───┬───┘
           ▼
       ┌─────┐
       │ 0.8 │
       └─────┘
```

---

## Resumen de Tareas

| ID | Tarea | Estimación | Tipo |
|----|-------|------------|------|
| 0.1 | Instalar y configurar Vitest | XS | Setup |
| 0.2 | Crear test de humo Vitest | XS | Testing |
| 0.3 | Instalar y configurar Playwright | S | Setup |
| 0.4 | Crear test E2E de humo | S | Testing |
| 0.5 | Crear estructura carpetas servidor | XS | Refactor |
| 0.6 | Crear estructura carpetas cliente | XS | Refactor |
| 0.7 | Crear estructura carpetas compartida | XS | Refactor |
| 0.8 | Configurar path aliases tsconfig | XS | Config |
| 0.9 | Crear clase base ValueObject | S | Domain |
| 0.10 | Crear clase base Entity | S | Domain |
| 0.11 | Crear tipo Result | S | Domain |

**Total estimado:** ~8-12 horas de trabajo
