# Diseño: Sección Hojas de Cálculo

## Resumen

Nueva sección que permite a los usuarios crear y gestionar hojas de cálculo directamente en la web para organizar el inventario de productos y generar facturas. A diferencia de la sección actual de Facturas (flujo de un solo uso: pegar → generar), esta sección permite persistencia, edición directa y gestión de múltiples hojas.

**Fecha:** 2026-01-30
**Estado:** Diseño aprobado

---

## Decisiones Tomadas

| Decisión | Elección | Razón |
|----------|----------|-------|
| Guardado | Auto-save (3s debounce) + manual | Coste adicional mínimo, mejor UX |
| Histórico | Básico (created_at + updated_at) | Trivial de implementar |
| Borrado | Soft delete con papelera | Seguridad para el usuario, campo archived_at |
| Columnas | 15 columnas fijas | Coinciden con la captura de referencia |
| Ruta | /hojas-calculo | Consistente con rutas en español (facturas/) |
| Estructura | server/ + client/ + app/ | Alineado con plan de refactorización |

---

## Base de Datos

### Tabla: `spreadsheets`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK, auto-generado |
| `name` | TEXT | Nombre de la hoja |
| `user_id` | UUID | FK al usuario creador |
| `header_data` | JSONB | Campos de cabecera (cliente, emisor, banco...) |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Última modificación |
| `archived_at` | TIMESTAMPTZ | NULL = activa, con fecha = papelera |

### Tabla: `spreadsheet_rows`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `spreadsheet_id` | UUID | FK a spreadsheets |
| `position` | INTEGER | Orden de la fila |
| `week` | TEXT | Semana |
| `invoice_date` | TEXT | Fecha factura |
| `date` | TEXT | Fecha |
| `final_client` | TEXT | Cliente final |
| `kg` | NUMERIC(12,2) | Kilogramos |
| `product` | TEXT | Producto |
| `box_type` | TEXT | Tipo de caja |
| `bundles` | INTEGER | Bultos |
| `price` | NUMERIC(12,4) | Precio |
| `order_number` | TEXT | Número de pedido |
| `awb` | TEXT | Air Waybill |
| `delivery_note` | TEXT | Albarán |
| `invoice_number` | TEXT | Número de factura |
| `line` | TEXT | Línea |
| `search` | TEXT | Campo búsqueda |

---

## Estructura de Carpetas

```
src/
├── server/
│   └── spreadsheets/
│       ├── domain/
│       │   ├── entities/
│       │   │   ├── Spreadsheet.ts
│       │   │   └── SpreadsheetRow.ts
│       │   ├── repositories/
│       │   │   └── SpreadsheetRepository.ts       # Interface
│       │   └── types.ts
│       ├── application/
│       │   ├── use-cases/
│       │   │   ├── CreateSpreadsheet.ts
│       │   │   ├── UpdateSpreadsheet.ts
│       │   │   ├── ArchiveSpreadsheet.ts
│       │   │   ├── RestoreSpreadsheet.ts
│       │   │   ├── DeleteSpreadsheet.ts
│       │   │   └── GenerateInvoiceFromSpreadsheet.ts
│       │   └── dto/
│       │       ├── SpreadsheetRequest.ts
│       │       └── SpreadsheetResponse.ts
│       └── infrastructure/
│           └── persistence/
│               └── SupabaseSpreadsheetRepository.ts
│
├── client/
│   └── spreadsheets/
│       ├── components/
│       │   ├── SpreadsheetTable.tsx
│       │   ├── SpreadsheetToolbar.tsx
│       │   ├── SpreadsheetHeaderForm.tsx
│       │   ├── SpreadsheetList.tsx
│       │   ├── SpreadsheetCard.tsx
│       │   ├── PasteFromExcel.tsx
│       │   └── TrashBin.tsx
│       ├── hooks/
│       │   ├── useSpreadsheet.ts
│       │   ├── useAutoSave.ts
│       │   └── useSpreadsheetList.ts
│       ├── services/
│       │   └── spreadsheetApi.ts
│       └── types/
│           └── index.ts
│
├── app/
│   ├── hojas-calculo/
│   │   ├── layout.tsx
│   │   ├── page.tsx                         # Lista + "Crear nueva"
│   │   ├── nueva/
│   │   │   └── page.tsx
│   │   ├── [id]/
│   │   │   └── page.tsx
│   │   └── papelera/
│   │       └── page.tsx
│   └── api/
│       └── spreadsheets/
│           ├── route.ts                     # GET lista, POST crear
│           ├── trash/
│           │   └── route.ts                 # GET papelera
│           └── [id]/
│               ├── route.ts                 # GET, PUT, DELETE
│               ├── archive/
│               │   └── route.ts             # POST archivar
│               ├── restore/
│               │   └── route.ts             # POST restaurar
│               └── generate-invoice/
│                   └── route.ts             # POST generar factura
```

---

## API Routes

| Método | Ruta | Use Case | Descripción |
|--------|------|----------|-------------|
| GET | /api/spreadsheets | ListSpreadsheets | Lista hojas activas |
| POST | /api/spreadsheets | CreateSpreadsheet | Crea hoja vacía |
| GET | /api/spreadsheets/trash | ListArchivedSpreadsheets | Lista papelera |
| GET | /api/spreadsheets/[id] | GetSpreadsheet | Obtiene hoja + filas |
| PUT | /api/spreadsheets/[id] | UpdateSpreadsheet | Actualiza todo (auto-save + manual) |
| DELETE | /api/spreadsheets/[id] | DeleteSpreadsheet | Elimina permanente (solo archivadas) |
| POST | /api/spreadsheets/[id]/archive | ArchiveSpreadsheet | Mueve a papelera |
| POST | /api/spreadsheets/[id]/restore | RestoreSpreadsheet | Restaura de papelera |
| POST | /api/spreadsheets/[id]/generate-invoice | GenerateInvoiceFromSpreadsheet | Genera factura PDF |

---

## Flujo de Usuario

```
/hojas-calculo (lista)
    │
    ├── "Crear nueva +"  →  /hojas-calculo/nueva
    │                            │
    │                            ▼
    │                     Hoja vacía con:
    │                     - Tabla editable (15 columnas fijas)
    │                     - Pegar desde Excel
    │                     - Cabecera de facturación
    │                     - Botón "Generar factura"
    │                     - Auto-save activo
    │                     (Al primer guardado → redirige a /hojas-calculo/[id])
    │
    ├── Hoja existente  →  /hojas-calculo/[id]
    │                     Misma vista con datos cargados
    │
    └── Papelera        →  /hojas-calculo/papelera
                          Lista archivadas: Restaurar / Eliminar
```

---

## Componentes Clave

### SpreadsheetTable.tsx
- Grid editable con 15 columnas fijas
- Navegación con Tab/Enter entre celdas
- Toolbar contextual: eliminar, copiar, mover fila
- Fila vacía al final para añadir datos
- Selección múltiple de filas

### SpreadsheetToolbar.tsx
- Guardar (manual), Añadir fila, Eliminar fila(s)
- Copiar / Pegar fila(s)
- Indicador: "Guardado" / "Guardando..." / "Cambios sin guardar"

### SpreadsheetHeaderForm.tsx
- Mismos campos que /facturas/nueva (cliente, emisor, banco, shipping)
- react-hook-form + zod

### PasteFromExcel.tsx
- Textarea de pegado
- Reutiliza parseExcelPaste() existente
- Mapea columnas → añade filas a la tabla

### useAutoSave.ts
- Debounce 3 segundos tras último cambio
- Protección beforeunload contra pérdida de datos
- Estados: saved / saving / unsaved

---

## Reutilización de Código Existente

| Función | Archivo | Uso |
|---------|---------|-----|
| parseExcelPaste() | src/lib/parseExcelPaste.ts | Parsear datos pegados |
| generateInvoicePdf() | src/lib/invoice-pdf.ts | Generar PDF de factura |
| generateAnexoIVPdf() | src/lib/anexo-iv-pdf.ts | Generar anexo IV |
| uploadInvoicePdf() | src/lib/invoice-storage.ts | Subir factura a Supabase |
| uploadSupplementPdf() | src/lib/invoice-storage.ts | Subir anexo a Supabase |
| calculateTotals() | src/lib/invoice-totals.ts | Calcular totales |

---

## Sidebar

Nuevo item en posición 6 de navItems (panel-layout.tsx):

```typescript
{ label: 'Hojas de cálculo', href: '/hojas-calculo', icon: Table2 }
```

Orden final:
1. Generar Etiqueta
2. Plantillas
3. Registro de Pedidos
4. Pedidos subidos
5. Stock
6. **Hojas de cálculo** ← nuevo
7. Facturas
8. Historial facturas
