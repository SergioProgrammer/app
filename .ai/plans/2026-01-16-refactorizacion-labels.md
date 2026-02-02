# Plan de Refactorización: ProcesIA

## Resumen Ejecutivo

**Fecha:** 2026-01-16
**Equipo:** 2 desarrolladores MID
**Estado del proyecto:** En desarrollo, 1 cliente probando
**Dedicación inicial:** Completa (luego alternar con features)

### Decisiones Tomadas

| Decisión | Elección |
|----------|----------|
| Enfoque de refactorización | Vertical Slice + Strangler Fig |
| Primer bounded context | Labels (Etiquetas) |
| Separación arquitectónica | `src/server/` + `src/client/` + `src/app/` |
| Metodologías | DDD, Clean Code, XP, TDD |
| Testing | Unitarios + Integración + E2E |

---

## Estructura de Carpetas Acordada

```
src/
├── server/                              # ══════ BACKEND ══════
│   ├── labels/                          # Bounded Context: Etiquetas
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── Label.ts
│   │   │   │   ├── LabelType.ts
│   │   │   │   └── TraceNumber.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── PackagingDate.ts
│   │   │   │   ├── LotNumber.ts
│   │   │   │   └── Coordinates.ts
│   │   │   ├── services/
│   │   │   │   └── LabelLayoutCalculator.ts
│   │   │   └── repositories/
│   │   │       └── LabelRepository.ts       # Interface (puerto)
│   │   │
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   │   ├── RenderSingleLabel.ts
│   │   │   │   ├── RenderAldiLabelBatch.ts
│   │   │   │   └── RenderLidlLabelTriplet.ts
│   │   │   └── dto/
│   │   │       ├── RenderLabelRequest.ts
│   │   │       └── RenderLabelResponse.ts
│   │   │
│   │   └── infrastructure/
│   │       ├── persistence/
│   │       │   └── SupabaseLabelRepository.ts
│   │       ├── pdf/
│   │       │   ├── PdfLibRenderer.ts
│   │       │   └── templates/
│   │       └── storage/
│   │           └── SupabaseStorageAdapter.ts
│   │
│   ├── orders/                          # (Futuro) Bounded Context: Pedidos
│   ├── inventory/                       # (Futuro) Bounded Context: Inventario
│   │
│   └── shared/                          # Compartido entre bounded contexts backend
│       ├── domain/
│       │   ├── ValueObject.ts
│       │   ├── Entity.ts
│       │   └── Result.ts
│       └── infrastructure/
│           └── supabase/
│               └── SupabaseClient.ts
│
├── client/                              # ══════ FRONTEND ══════
│   ├── labels/                          # Bounded Context: Etiquetas
│   │   ├── components/
│   │   │   ├── LabelPreview.tsx
│   │   │   ├── LabelTypeSelector.tsx
│   │   │   └── LabelForm.tsx
│   │   ├── hooks/
│   │   │   └── useRenderLabel.ts
│   │   ├── services/
│   │   │   └── labelApi.ts              # Llamadas a /api/labels
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── orders/                          # (Futuro)
│   ├── inventory/                       # (Futuro)
│   │
│   └── shared/                          # Compartido entre bounded contexts frontend
│       ├── components/
│       │   ├── Button.tsx
│       │   ├── Modal.tsx
│       │   └── Layout.tsx
│       ├── hooks/
│       │   └── useSupabase.ts
│       └── utils/
│           └── formatters.ts
│
├── app/                                 # ══════ NEXT.JS ROUTING ══════
│   ├── api/
│   │   └── labels/
│   │       ├── route.ts                 # POST: Render label
│   │       ├── aldi/route.ts
│   │       └── lidl/route.ts
│   ├── panel/
│   │   └── [slug]/
│   │       └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
│
└── shared/                              # ══════ COMPARTIDO FRONT + BACK ══════
    └── types/
        └── api-contracts.ts             # DTOs para request/response API
```

---

## Stack de Testing Recomendado

### Unitarios y de Integración
- **Vitest** - Rápido, ESM nativo, excelente DX
- **Testing Library** - Para componentes React

### E2E
- **Playwright** - Más moderno que Cypress, mejor soporte multi-browser

### Configuración Base

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D @playwright/test
```

### Estructura de Tests

```
tests/
├── unit/                                # Tests unitarios (separados del código)
│   ├── server/
│   │   └── labels/
│   │       ├── domain/
│   │       │   ├── entities/
│   │       │   │   ├── Label.test.ts
│   │       │   │   └── LabelType.test.ts
│   │       │   ├── value-objects/
│   │       │   │   ├── PackagingDate.test.ts
│   │       │   │   ├── LotNumber.test.ts
│   │       │   │   ├── TraceNumber.test.ts
│   │       │   │   └── Coordinates.test.ts
│   │       │   └── services/
│   │       │       └── LabelLayoutCalculator.test.ts
│   │       └── application/
│   │           └── use-cases/
│   │               ├── RenderSingleLabel.test.ts
│   │               ├── RenderAldiLabelBatch.test.ts
│   │               └── RenderLidlLabelTriplet.test.ts
│   │
│   └── client/
│       └── labels/
│           ├── components/
│           │   ├── LabelForm.test.tsx
│           │   ├── LabelPreview.test.tsx
│           │   └── LabelTypeSelector.test.tsx
│           └── hooks/
│               └── useRenderLabel.test.ts
│
├── integration/                         # Tests de integración
│   └── labels/
│       ├── render-single-label.integration.test.ts
│       ├── render-aldi-batch.integration.test.ts
│       └── render-lidl-triplet.integration.test.ts
│
└── e2e/                                 # Tests E2E con Playwright
    └── labels/
        ├── create-mercadona-label.spec.ts
        ├── create-aldi-labels.spec.ts
        └── create-lidl-labels.spec.ts
```

---

## Fases de Refactorización

### Fase 0: Setup Inicial (1-2 días)
Preparar el terreno para la refactorización.

### Fase 1: Labels - Domain Layer (3-5 días)
Extraer y modelar el dominio puro de etiquetas.

### Fase 2: Labels - Application Layer (2-3 días)
Crear casos de uso que orquesten el dominio.

### Fase 3: Labels - Infrastructure Layer (2-3 días)
Implementar adaptadores para PDF, storage, etc.

### Fase 4: Labels - Client Layer (2-3 días)
Refactorizar componentes React del módulo.

### Fase 5: Labels - Integración y Limpieza (1-2 días)
Conectar todo, eliminar código viejo, validar.

### Fase 6+: Siguientes Bounded Contexts
Replicar el patrón en Orders, Inventory, etc.

---

## Fase 0: Setup Inicial

### Tareas

#### 0.1 Configurar Vitest
- Instalar dependencias: `vitest`, `@testing-library/react`, `jsdom`
- Crear `vitest.config.ts`
- Añadir scripts a `package.json`
- Crear primer test de humo

#### 0.2 Configurar Playwright
- Instalar: `@playwright/test`
- Crear `playwright.config.ts`
- Crear primer E2E de humo (login o navegación básica)

#### 0.3 Crear Estructura Base
- Crear carpetas: `src/server/`, `src/client/`, `src/shared/`
- Crear `src/server/shared/domain/` con clases base:
  - `ValueObject.ts`
  - `Entity.ts`
  - `Result.ts` (para manejo de errores sin excepciones)

#### 0.4 Configurar Path Aliases
- Actualizar `tsconfig.json` con aliases:
  - `@server/*` → `src/server/*`
  - `@client/*` → `src/client/*`
  - `@shared/*` → `src/shared/*`
- Mantener `@/*` para compatibilidad durante migración

---

## Fase 1: Labels - Domain Layer

### Análisis del Código Actual

El archivo `src/server/label-renderer.ts` (1,718 líneas) contiene:
- 7 tipos de etiqueta: mercadona, aldi, lidl, hiperdino, kanali, blanca-grande, blanca-pequena
- Lógica de coordenadas y layout
- Generación de números de trazabilidad (Aldi: E00001-E99999)
- Carga de templates y fuentes
- Renderizado PDF con pdf-lib

### Tareas

#### 1.1 Crear Value Objects Base
Ubicación: `src/server/labels/domain/value-objects/`

**PackagingDate.ts**
```typescript
// Representa fecha de envasado con validación
// - Formato: DD/MM/YYYY
// - No puede ser futura
// - Métodos: format(), isExpired(shelfLifeDays)
```
- [ ] Implementar clase
- [ ] Tests unitarios: creación válida, formatos inválidos, fecha futura

**LotNumber.ts**
```typescript
// Número de lote
// - Formato según supermercado
// - Validación de caracteres permitidos
```
- [ ] Implementar clase
- [ ] Tests unitarios

**TraceNumber.ts**
```typescript
// Número de trazabilidad (Aldi)
// - Formato: E + 5 dígitos (E00001-E99999)
// - Auto-incrementable
// - Método: next()
```
- [ ] Implementar clase
- [ ] Tests unitarios: generación secuencial, límites, formato

**Coordinates.ts**
```typescript
// Posición en el PDF
// - x, y en píxeles
// - Origen: bottom-left
// - Validación: no negativos, dentro de canvas (1262×768)
```
- [ ] Implementar clase
- [ ] Tests unitarios

#### 1.2 Crear Entidad LabelType
Ubicación: `src/server/labels/domain/entities/`

**LabelType.ts**
```typescript
// Enum o union type con los 7 tipos
// Cada tipo conoce:
// - Su template base
// - Sus campos requeridos
// - Su layout (coordenadas de cada campo)
```
- [ ] Extraer tipos de `product-selection.ts`
- [ ] Modelar layouts como configuración del tipo
- [ ] Tests unitarios

#### 1.3 Crear Entidad Label
Ubicación: `src/server/labels/domain/entities/`

**Label.ts**
```typescript
// Entidad principal
// - type: LabelType
// - packagingDate: PackagingDate
// - lotNumber: LotNumber
// - traceNumber?: TraceNumber (solo Aldi)
// - product: ProductInfo
// - Validaciones de negocio
```
- [ ] Implementar entidad
- [ ] Validaciones: campos requeridos según tipo
- [ ] Tests unitarios

#### 1.4 Crear Domain Service: LabelLayoutCalculator
Ubicación: `src/server/labels/domain/services/`

**LabelLayoutCalculator.ts**
```typescript
// Calcula posiciones de texto según tipo de etiqueta
// - Input: LabelType, campo
// - Output: Coordinates, fontSize, alignment
// Extrae la lógica de TEXT_LAYOUT del renderer actual
```
- [ ] Extraer constantes TEXT_LAYOUT
- [ ] Implementar servicio
- [ ] Tests unitarios: cada tipo, cada campo

#### 1.5 Crear Interface de Repositorio
Ubicación: `src/server/labels/domain/repositories/`

**LabelRepository.ts**
```typescript
// Puerto (interface)
interface LabelRepository {
  save(label: Label, pdfBuffer: Buffer): Promise<LabelStorageResult>
  getTemplate(type: LabelType): Promise<Buffer>
}
```
- [ ] Definir interface
- [ ] Definir tipos de resultado

---

## Fase 2: Labels - Application Layer

### Tareas

#### 2.1 Crear DTOs
Ubicación: `src/server/labels/application/dto/`

**RenderLabelRequest.ts**
```typescript
interface RenderLabelRequest {
  labelType: string
  packagingDate: string
  lotNumber: string
  product: {
    name: string
    variety?: string
    cocCode: string
    rCode: string
  }
  quantity?: number  // Para Aldi (múltiples etiquetas)
}
```
- [ ] Definir request DTO
- [ ] Validación con Zod

**RenderLabelResponse.ts**
```typescript
interface RenderLabelResponse {
  success: boolean
  urls?: string[]
  error?: string
}
```
- [ ] Definir response DTO

#### 2.2 Caso de Uso: RenderSingleLabel
Ubicación: `src/server/labels/application/use-cases/`

**RenderSingleLabel.ts**
```typescript
// Caso de uso para etiquetas individuales (Mercadona, Hiperdino, Kanali, Blancas)
// 1. Valida input (DTO → Domain)
// 2. Crea entidad Label
// 3. Usa PdfRenderer para generar PDF
// 4. Usa Repository para guardar
// 5. Retorna resultado
```
- [ ] Implementar use case
- [ ] Tests con mocks de infraestructura

#### 2.3 Caso de Uso: RenderAldiLabelBatch
Ubicación: `src/server/labels/application/use-cases/`

**RenderAldiLabelBatch.ts**
```typescript
// Genera N etiquetas Aldi con números de traza secuenciales
// E00001, E00002, ... E0000N
// Cada etiqueta es una Label con TraceNumber único
```
- [ ] Implementar use case
- [ ] Tests: generación secuencial, límites, formato de traza

#### 2.4 Caso de Uso: RenderLidlLabelTriplet
Ubicación: `src/server/labels/application/use-cases/`

**RenderLidlLabelTriplet.ts**
```typescript
// Genera siempre 3 PDFs para Lidl:
// 1. Etiqueta base (con diseño Lidl)
// 2. Etiqueta blanca 1
// 3. Etiqueta blanca 2
// Invariante: siempre retorna exactamente 3 PDFs
```
- [ ] Implementar use case
- [ ] Tests: genera exactamente 3 PDFs, estructura correcta

---

## Fase 3: Labels - Infrastructure Layer

### Tareas

#### 3.1 Implementar PdfLibRenderer
Ubicación: `src/server/labels/infrastructure/pdf/`

**PdfLibRenderer.ts**
```typescript
// Adaptador para pdf-lib
// - Carga templates
// - Carga fuentes
// - Dibuja texto en coordenadas
// - Genera buffer PDF
```
- [ ] Extraer lógica de renderizado de `label-renderer.ts`
- [ ] Implementar como clase con inyección de dependencias
- [ ] Tests de integración: genera PDF válido

#### 3.2 Implementar SupabaseLabelRepository
Ubicación: `src/server/labels/infrastructure/persistence/`

**SupabaseLabelRepository.ts**
```typescript
// Implementa LabelRepository
// - save(): Sube PDF a bucket `etiquetas_final`
// - getTemplate(): Lee template de `public/`
```
- [ ] Implementar adaptador
- [ ] Tests de integración con Supabase (pueden ser opcionales/CI)

#### 3.3 Implementar SupabaseStorageAdapter
Ubicación: `src/server/labels/infrastructure/storage/`

**SupabaseStorageAdapter.ts**
```typescript
// Wrapper sobre supabase-storage.ts actual
// Simplifica interface para el dominio
```
- [ ] Extraer y simplificar
- [ ] Tests de integración

---

## Fase 4: Labels - Client Layer

### Tareas

#### 4.1 Crear Service API
Ubicación: `src/client/labels/services/`

**labelApi.ts**
```typescript
// Cliente HTTP para /api/labels
export const labelApi = {
  render: (request: RenderLabelRequest) => Promise<RenderLabelResponse>,
  renderAldiSet: (request, quantity) => Promise<RenderLabelResponse>,
  renderLidlSet: (request) => Promise<RenderLabelResponse>,
}
```
- [ ] Implementar cliente
- [ ] Tipado compartido con `src/shared/types/api-contracts.ts`

#### 4.2 Crear Hook useRenderLabel
Ubicación: `src/client/labels/hooks/`

**useRenderLabel.ts**
```typescript
// Hook React para renderizar etiquetas
// - Estado: loading, error, result
// - Métodos: render(), reset()
// - Integra con react-hook-form si aplica
```
- [ ] Implementar hook
- [ ] Tests con Testing Library

#### 4.3 Refactorizar Componentes
Ubicación: `src/client/labels/components/`

Extraer de las páginas actuales:

**LabelTypeSelector.tsx**
- [ ] Componente para seleccionar tipo de etiqueta
- [ ] Props tipadas, accesible
- [ ] Tests

**LabelForm.tsx**
- [ ] Formulario con react-hook-form + zod
- [ ] Campos dinámicos según LabelType
- [ ] Tests

**LabelPreview.tsx**
- [ ] Preview del PDF generado
- [ ] Tests

---

## Fase 5: Integración y Limpieza

### Tareas

#### 5.1 Actualizar API Routes
- [ ] Crear `src/app/api/labels/route.ts` delegando a use cases
- [ ] Crear rutas específicas: `/api/labels/aldi`, `/api/labels/lidl`
- [ ] Mantener rutas viejas temporalmente (deprecar)

#### 5.2 Actualizar Páginas
- [ ] Modificar `src/app/panel/[slug]/page.tsx` para usar nuevos componentes
- [ ] Verificar que todo funciona igual

#### 5.3 Tests E2E
Ubicación: `tests/e2e/labels/`

- [ ] `create-mercadona-label.spec.ts`
- [ ] `create-aldi-labels.spec.ts` (múltiples)
- [ ] `create-lidl-labels.spec.ts` (3 PDFs)

#### 5.4 Eliminar Código Viejo
- [ ] Eliminar `src/server/label-renderer.ts` (verificar no se usa)
- [ ] Eliminar renderers individuales migrados
- [ ] Limpiar imports no usados

#### 5.5 Documentación
- [ ] Actualizar CLAUDE.md con nueva estructura
- [ ] Documentar cómo añadir nuevos tipos de etiqueta

---

## Siguientes Bounded Contexts

Una vez completado Labels, replicar el patrón en:

### Orders (Pedidos)
- Parsing con Vision AI
- Subida de archivos
- Procesamiento de pedidos

### Inventory (Stock)
- Gestión de inventario
- Ajustes de stock
- Alertas

### Auth
- Ya está mayormente en Supabase
- Quizás solo wrapper y tipos

### Automations
- Workflows N8N
- Emails automáticos

---

## Criterios de Aceptación Global

### Para cada Fase
- [ ] Todos los tests pasan
- [ ] No hay regresiones en funcionalidad
- [ ] El cliente puede seguir probando la app
- [ ] Code review entre los 2 devs

### Para el Bounded Context Completo
- [ ] Cobertura de tests > 80% en domain y application
- [ ] Al menos 3 tests E2E cubriendo happy paths
- [ ] Código viejo eliminado
- [ ] Sin `@ts-ignore` ni `@ts-nocheck` en código nuevo

---

## Notas para Pair Programming

### Sugerencia de División
- **Dev 1:** Domain + Application (lógica de negocio)
- **Dev 2:** Infrastructure + Client (adaptadores y UI)
- **Ambos:** Tests E2E, code review cruzado

### Sesiones Recomendadas
1. **Kick-off (2h):** Revisar plan, resolver dudas, setup inicial
2. **Daily sync (15min):** Qué hice, qué haré, bloqueos
3. **Review semanal (1h):** Demo de progreso, ajustar plan

---

## Historial de Decisiones

| Fecha | Decisión | Razón |
|-------|----------|-------|
| 2026-01-16 | Vertical Slice sobre Big Bang | Menor riesgo, resultados rápidos |
| 2026-01-16 | Labels como primer contexto | Es el core, mayor complejidad |
| 2026-01-16 | Vitest sobre Jest | Más rápido, mejor DX con ESM |
| 2026-01-16 | Sin carpeta /modules | Anidación innecesaria |
| 2026-01-16 | Tests en `tests/unit/` | Separar código de producción de tests |
| 2026-01-16 | Nombres explícitos en use cases | RenderSingleLabel, RenderAldiLabelBatch, RenderLidlLabelTriplet |
