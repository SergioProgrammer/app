# Fase 1: Labels - Domain Layer

## Resumen
Extraer y modelar el dominio puro de etiquetas. Esta fase NO tiene dependencias de infraestructura.

**Prerequisitos:** Fase 0 completada

---

## Tareas

### 1.1 - Crear Value Object: PackagingDate
**Estimación:** S (1-2h)
**Tipo:** Domain

**Descripción:**
Crear el Value Object que representa la fecha de envasado con sus validaciones.

**Criterios de aceptación:**
- [ ] Archivo `src/server/labels/domain/value-objects/PackagingDate.ts` creado
- [ ] Extiende de `ValueObject` base
- [ ] Valida formato DD/MM/YYYY
- [ ] Rechaza fechas futuras
- [ ] Método `format(): string` para obtener la fecha formateada
- [ ] Método `isExpired(shelfLifeDays: number): boolean`
- [ ] Factory method estático `create()` que retorna `Result<PackagingDate>`
- [ ] Test en `tests/unit/server/labels/domain/value-objects/PackagingDate.test.ts`

**Casos de test:**
- Crear con fecha válida
- Rechazar fecha con formato inválido
- Rechazar fecha futura
- Verificar `format()` retorna string correcto
- Verificar `isExpired()` con diferentes valores
- Verificar `equals()` entre dos PackagingDate

---

### 1.2 - Crear Value Object: LotNumber
**Estimación:** S (1-2h)
**Tipo:** Domain

**Descripción:**
Crear el Value Object que representa el número de lote.

**Criterios de aceptación:**
- [ ] Archivo `src/server/labels/domain/value-objects/LotNumber.ts` creado
- [ ] Extiende de `ValueObject` base
- [ ] Valida que no esté vacío
- [ ] Valida caracteres permitidos (alfanumérico + guiones)
- [ ] Método `value: string` getter
- [ ] Factory method estático `create()` que retorna `Result<LotNumber>`
- [ ] Test en `tests/unit/server/labels/domain/value-objects/LotNumber.test.ts`

**Casos de test:**
- Crear con lote válido
- Rechazar lote vacío
- Rechazar lote con caracteres inválidos
- Verificar `equals()`

---

### 1.3 - Crear Value Object: TraceNumber
**Estimación:** M (2-4h)
**Tipo:** Domain

**Descripción:**
Crear el Value Object que representa el número de trazabilidad de Aldi (E00001-E99999).

**Criterios de aceptación:**
- [ ] Archivo `src/server/labels/domain/value-objects/TraceNumber.ts` creado
- [ ] Extiende de `ValueObject` base
- [ ] Formato: E + 5 dígitos (E00001 a E99999)
- [ ] Método `value: string` getter
- [ ] Método `next(): TraceNumber` que retorna el siguiente número
- [ ] Método estático `first(): TraceNumber` que retorna E00001
- [ ] Método estático `fromNumber(n: number): Result<TraceNumber>`
- [ ] Valida rango (1-99999)
- [ ] Test en `tests/unit/server/labels/domain/value-objects/TraceNumber.test.ts`

**Casos de test:**
- Crear E00001 con `first()`
- Crear desde número válido
- Rechazar número fuera de rango (0, 100000)
- Verificar `next()` incrementa correctamente
- Verificar `next()` en E99999 falla o cicla (definir comportamiento)
- Verificar formato siempre tiene 5 dígitos (E00001, no E1)

---

### 1.4 - Crear Value Object: Coordinates
**Estimación:** S (1-2h)
**Tipo:** Domain

**Descripción:**
Crear el Value Object que representa posición en el PDF.

**Criterios de aceptación:**
- [ ] Archivo `src/server/labels/domain/value-objects/Coordinates.ts` creado
- [ ] Extiende de `ValueObject` base
- [ ] Props: `x: number`, `y: number`
- [ ] Valida que x, y sean no negativos
- [ ] Valida que estén dentro del canvas (1262×768 px)
- [ ] Getters `x` e `y`
- [ ] Factory method `create()` que retorna `Result<Coordinates>`
- [ ] Test en `tests/unit/server/labels/domain/value-objects/Coordinates.test.ts`

**Casos de test:**
- Crear con coordenadas válidas
- Rechazar coordenadas negativas
- Rechazar coordenadas fuera de canvas
- Coordenadas en el límite (0, 0) y (1262, 768) son válidas
- Verificar `equals()`

---

### 1.5 - Crear Value Object: TextLayout
**Estimación:** S (1-2h)
**Tipo:** Domain

**Descripción:**
Crear el Value Object que agrupa coordenadas con propiedades de texto.

**Criterios de aceptación:**
- [ ] Archivo `src/server/labels/domain/value-objects/TextLayout.ts` creado
- [ ] Extiende de `ValueObject` base
- [ ] Props: `coordinates: Coordinates`, `fontSize: number`, `align: 'left' | 'center' | 'right'`
- [ ] Valida fontSize > 0
- [ ] Factory method `create()`
- [ ] Test en `tests/unit/server/labels/domain/value-objects/TextLayout.test.ts`

**Casos de test:**
- Crear con valores válidos
- Rechazar fontSize <= 0
- Verificar diferentes alignments

---

### 1.6 - Crear Entity: LabelType
**Estimación:** M (2-4h)
**Tipo:** Domain

**Descripción:**
Crear la entidad que representa un tipo de etiqueta con su configuración.

**Criterios de aceptación:**
- [ ] Archivo `src/server/labels/domain/entities/LabelType.ts` creado
- [ ] Enum o union type con los 7 tipos: mercadona, aldi, lidl, hiperdino, kanali, blanca-grande, blanca-pequena
- [ ] Cada tipo conoce:
  - Su template file name
  - Sus campos requeridos
  - Su layout (TextLayout por campo)
- [ ] Método `getLayout(field: string): TextLayout`
- [ ] Método `getRequiredFields(): string[]`
- [ ] Método `getTemplateName(): string`
- [ ] Test en `tests/unit/server/labels/domain/entities/LabelType.test.ts`

**Casos de test:**
- Obtener layout para cada tipo y campo
- Verificar campos requeridos por tipo
- Verificar template name por tipo
- Aldi requiere traceNumber, otros no

**Referencia código actual:**
Extraer de `TEXT_LAYOUT` en `src/server/label-renderer.ts` (líneas ~50-150)

---

### 1.7 - Crear Entity: ProductInfo
**Estimación:** S (1-2h)
**Tipo:** Domain

**Descripción:**
Crear la entidad que representa la información del producto en la etiqueta.

**Criterios de aceptación:**
- [ ] Archivo `src/server/labels/domain/entities/ProductInfo.ts` creado
- [ ] Props: `name: string`, `variety?: string`, `cocCode: string`, `rCode: string`
- [ ] Validaciones: name no vacío, códigos con formato correcto
- [ ] Factory method `create()` que retorna `Result<ProductInfo>`
- [ ] Test en `tests/unit/server/labels/domain/entities/ProductInfo.test.ts`

**Casos de test:**
- Crear con datos válidos
- Crear con variety opcional
- Rechazar name vacío
- Validar formato de códigos

---

### 1.8 - Crear Entity: Label
**Estimación:** M (2-4h)
**Tipo:** Domain

**Descripción:**
Crear la entidad principal que representa una etiqueta.

**Criterios de aceptación:**
- [ ] Archivo `src/server/labels/domain/entities/Label.ts` creado
- [ ] Extiende de `Entity` base
- [ ] Props:
  - `type: LabelType`
  - `packagingDate: PackagingDate`
  - `lotNumber: LotNumber`
  - `traceNumber?: TraceNumber` (solo para Aldi)
  - `product: ProductInfo`
- [ ] Validación: si type es Aldi, traceNumber es requerido
- [ ] Factory method `create()` que retorna `Result<Label>`
- [ ] Test en `tests/unit/server/labels/domain/entities/Label.test.ts`

**Casos de test:**
- Crear etiqueta Mercadona válida (sin traceNumber)
- Crear etiqueta Aldi válida (con traceNumber)
- Rechazar Aldi sin traceNumber
- Rechazar Mercadona con traceNumber (o permitir y ignorar?)
- Verificar todos los getters

---

### 1.9 - Crear Domain Service: LabelLayoutCalculator
**Estimación:** M (2-4h)
**Tipo:** Domain

**Descripción:**
Crear el servicio de dominio que calcula layouts de texto.

**Criterios de aceptación:**
- [ ] Archivo `src/server/labels/domain/services/LabelLayoutCalculator.ts` creado
- [ ] Método `calculateLayout(label: Label, field: string): TextLayout`
- [ ] Usa LabelType internamente para obtener configuración
- [ ] Test en `tests/unit/server/labels/domain/services/LabelLayoutCalculator.test.ts`

**Casos de test:**
- Calcular layout para cada campo de Mercadona
- Calcular layout para campos específicos de Aldi
- Verificar que coordenadas coinciden con los valores actuales

**Referencia código actual:**
Extraer lógica de `TEXT_LAYOUT` en `src/server/label-renderer.ts`

---

### 1.10 - Crear Interface: LabelRepository
**Estimación:** XS (< 1h)
**Tipo:** Domain

**Descripción:**
Definir la interface (puerto) del repositorio de etiquetas.

**Criterios de aceptación:**
- [ ] Archivo `src/server/labels/domain/repositories/LabelRepository.ts` creado
- [ ] Interface con métodos:
  - `save(label: Label, pdfBuffer: Buffer): Promise<Result<LabelStorageResult>>`
  - `getTemplate(type: LabelType): Promise<Result<Buffer>>`
- [ ] Tipo `LabelStorageResult` definido con `url: string`, `path: string`
- [ ] NO implementación (solo interface)

**Nota:** Esta es solo la definición del puerto. La implementación va en Infrastructure (Fase 3).

---

### 1.11 - Crear Interface: PdfRenderer
**Estimación:** XS (< 1h)
**Tipo:** Domain

**Descripción:**
Definir la interface (puerto) del renderizador de PDFs.

**Criterios de aceptación:**
- [ ] Archivo `src/server/labels/domain/services/PdfRenderer.ts` creado
- [ ] Interface con método:
  - `render(label: Label, template: Buffer): Promise<Result<Buffer>>`
- [ ] NO implementación (solo interface)

**Nota:** Esta es solo la definición del puerto. La implementación va en Infrastructure (Fase 3).

---

### 1.12 - Crear barrel exports del dominio
**Estimación:** XS (< 1h)
**Tipo:** Refactor
**Depende de:** 1.1-1.11

**Descripción:**
Crear archivos index.ts para exportar todo el dominio de forma organizada.

**Criterios de aceptación:**
- [ ] `src/server/labels/domain/value-objects/index.ts` exporta todos los VOs
- [ ] `src/server/labels/domain/entities/index.ts` exporta todas las entidades
- [ ] `src/server/labels/domain/services/index.ts` exporta todos los servicios
- [ ] `src/server/labels/domain/repositories/index.ts` exporta todas las interfaces
- [ ] `src/server/labels/domain/index.ts` re-exporta todo

**Código de referencia:**
```typescript
// src/server/labels/domain/index.ts
export * from './value-objects'
export * from './entities'
export * from './services'
export * from './repositories'
```

---

## Orden Sugerido de Ejecución

```
Value Objects (pueden ser paralelos):
1.1 (PackagingDate) | 1.2 (LotNumber) | 1.3 (TraceNumber) | 1.4 (Coordinates)
         │                  │                  │                  │
         └──────────────────┴────────┬─────────┴──────────────────┘
                                     ▼
                              1.5 (TextLayout)
                                     │
                                     ▼
Entities (secuencial):        1.6 (LabelType)
                                     │
                                     ▼
                              1.7 (ProductInfo)
                                     │
                                     ▼
                              1.8 (Label)
                                     │
                                     ▼
Services & Interfaces:        1.9 (LabelLayoutCalculator)
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              1.10 (Repo)     1.11 (Renderer)   1.12 (Exports)
```

---

## Resumen de Tareas

| ID | Tarea | Estimación | Tipo |
|----|-------|------------|------|
| 1.1 | Value Object: PackagingDate | S | Domain |
| 1.2 | Value Object: LotNumber | S | Domain |
| 1.3 | Value Object: TraceNumber | M | Domain |
| 1.4 | Value Object: Coordinates | S | Domain |
| 1.5 | Value Object: TextLayout | S | Domain |
| 1.6 | Entity: LabelType | M | Domain |
| 1.7 | Entity: ProductInfo | S | Domain |
| 1.8 | Entity: Label | M | Domain |
| 1.9 | Service: LabelLayoutCalculator | M | Domain |
| 1.10 | Interface: LabelRepository | XS | Domain |
| 1.11 | Interface: PdfRenderer | XS | Domain |
| 1.12 | Barrel exports | XS | Refactor |

**Total estimado:** ~16-24 horas de trabajo

---

## Notas de Implementación

### Extracción del código actual
El archivo `src/server/label-renderer.ts` contiene toda la lógica actual. Puntos clave para extraer:

1. **TEXT_LAYOUT** (~línea 50-150): Coordenadas y layouts por tipo
2. **LabelType** (~línea 20-30): Tipos de etiqueta
3. **Lógica de TraceNumber** (~línea 200-250): Generación de E00001-E99999

### Principios a seguir
- **No dependencias externas**: El dominio NO importa pdf-lib, Supabase, etc.
- **Inmutabilidad**: Value Objects son inmutables
- **Validación en construcción**: Las entidades se validan al crearse
- **Result en lugar de excepciones**: Usar `Result<T>` para errores esperados
