# Tareas: Sección Hojas de Cálculo

## Resumen
Implementación de la nueva sección de hojas de cálculo siguiendo buenas prácticas (DDD, componentes separados, testing).

**Diseño:** `.ai/plans/2026-01-30-hojas-calculo-design.md`

---

## Fase A: Base de Datos y Estructura

### A.1 - Crear migración de Supabase para tablas
**Estimación:** S (1-2h)
**Tipo:** Database

**Descripción:**
Crear la migración SQL con las tablas `spreadsheets` y `spreadsheet_rows`, índices y políticas RLS.

**Criterios de aceptación:**
- [ ] Migración creada en `supabase/migrations/`
- [ ] Tabla `spreadsheets` con columnas: id, name, user_id, header_data, created_at, updated_at, archived_at
- [ ] Tabla `spreadsheet_rows` con todas las 15 columnas + id, spreadsheet_id, position
- [ ] FK de spreadsheet_rows → spreadsheets con ON DELETE CASCADE
- [ ] Índices en: spreadsheets(user_id), spreadsheets(archived_at), spreadsheet_rows(spreadsheet_id, position)
- [ ] RLS: usuarios autenticados pueden CRUD solo sus propios registros
- [ ] Migración ejecutada sin errores

**SQL de referencia:**
```sql
CREATE TABLE public.spreadsheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Sin nombre',
  user_id UUID NOT NULL,
  header_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE public.spreadsheet_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id UUID NOT NULL REFERENCES public.spreadsheets(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  week TEXT,
  invoice_date TEXT,
  date TEXT,
  final_client TEXT,
  kg NUMERIC(12,2),
  product TEXT,
  box_type TEXT,
  bundles INTEGER,
  price NUMERIC(12,4),
  order_number TEXT,
  awb TEXT,
  delivery_note TEXT,
  invoice_number TEXT,
  line TEXT,
  search TEXT
);
```

---

### A.2 - Crear estructura de carpetas
**Estimación:** XS (< 30min)
**Tipo:** Setup

**Descripción:**
Crear todas las carpetas necesarias para el bounded context de spreadsheets.

**Criterios de aceptación:**
- [ ] `src/server/spreadsheets/domain/entities/`
- [ ] `src/server/spreadsheets/domain/repositories/`
- [ ] `src/server/spreadsheets/application/use-cases/`
- [ ] `src/server/spreadsheets/application/dto/`
- [ ] `src/server/spreadsheets/infrastructure/persistence/`
- [ ] `src/client/spreadsheets/components/`
- [ ] `src/client/spreadsheets/hooks/`
- [ ] `src/client/spreadsheets/services/`
- [ ] `src/client/spreadsheets/types/`
- [ ] `src/app/hojas-calculo/nueva/`
- [ ] `src/app/hojas-calculo/[id]/`
- [ ] `src/app/hojas-calculo/papelera/`
- [ ] `src/app/api/spreadsheets/[id]/archive/`
- [ ] `src/app/api/spreadsheets/[id]/restore/`
- [ ] `src/app/api/spreadsheets/[id]/generate-invoice/`
- [ ] `src/app/api/spreadsheets/trash/`

---

### A.3 - Crear tipos del dominio
**Estimación:** S (1-2h)
**Tipo:** Domain

**Descripción:**
Definir tipos TypeScript para el bounded context.

**Criterios de aceptación:**
- [ ] `src/server/spreadsheets/domain/types.ts` con tipos del dominio
- [ ] `src/client/spreadsheets/types/index.ts` con tipos del cliente
- [ ] Tipos compartidos para las 15 columnas de la fila
- [ ] Tipo para header_data (reutilizar campos de factura)
- [ ] Tipo para estados de guardado: 'saved' | 'saving' | 'unsaved'

---

## Fase B: Backend (Domain + Application + Infrastructure)

### B.1 - Crear entidad Spreadsheet
**Estimación:** S (1-2h)
**Tipo:** Domain
**Depende de:** A.3

**Descripción:**
Entidad del dominio que representa una hoja de cálculo.

**Criterios de aceptación:**
- [ ] `src/server/spreadsheets/domain/entities/Spreadsheet.ts`
- [ ] Props: id, name, userId, headerData, rows, createdAt, updatedAt, archivedAt
- [ ] Método `archive()`: marca como archivada
- [ ] Método `restore()`: elimina marca de archivada
- [ ] Método `isArchived(): boolean`
- [ ] Método `updateHeaderData(data)`: actualiza cabecera
- [ ] Método `updateRows(rows)`: reemplaza filas
- [ ] Test unitario

---

### B.2 - Crear entidad SpreadsheetRow
**Estimación:** S (1-2h)
**Tipo:** Domain
**Depende de:** A.3

**Descripción:**
Entidad que representa una fila de la hoja de cálculo.

**Criterios de aceptación:**
- [ ] `src/server/spreadsheets/domain/entities/SpreadsheetRow.ts`
- [ ] 15 campos + id + position
- [ ] Método `toInvoiceItem()`: mapea a InvoiceItem para generación de factura
- [ ] Validación: position >= 0
- [ ] Test unitario

---

### B.3 - Crear interface SpreadsheetRepository
**Estimación:** XS (< 30min)
**Tipo:** Domain
**Depende de:** B.1, B.2

**Descripción:**
Interface (puerto) del repositorio.

**Criterios de aceptación:**
- [ ] `src/server/spreadsheets/domain/repositories/SpreadsheetRepository.ts`
- [ ] Métodos: findById, findAllByUser, findArchivedByUser, save, update, delete

---

### B.4 - Crear SupabaseSpreadsheetRepository
**Estimación:** M (2-4h)
**Tipo:** Infrastructure
**Depende de:** A.1, B.3

**Descripción:**
Implementación del repositorio usando Supabase.

**Criterios de aceptación:**
- [ ] `src/server/spreadsheets/infrastructure/persistence/SupabaseSpreadsheetRepository.ts`
- [ ] Implementa SpreadsheetRepository
- [ ] `findById`: carga spreadsheet + rows ordenadas por position
- [ ] `findAllByUser`: filtra por user_id, archived_at IS NULL, ordena por updated_at DESC
- [ ] `findArchivedByUser`: filtra por user_id, archived_at IS NOT NULL
- [ ] `save`: inserta spreadsheet + filas en batch
- [ ] `update`: actualiza spreadsheet + delete/insert filas
- [ ] `delete`: elimina permanentemente (CASCADE elimina filas)
- [ ] Test de integración (opcional)

---

### B.5 - Crear DTOs
**Estimación:** S (1-2h)
**Tipo:** Application
**Depende de:** A.3

**Descripción:**
Definir DTOs para request/response de la API.

**Criterios de aceptación:**
- [ ] `src/server/spreadsheets/application/dto/SpreadsheetRequest.ts`
  - CreateSpreadsheetRequest: { name }
  - UpdateSpreadsheetRequest: { name?, headerData?, rows[] }
- [ ] `src/server/spreadsheets/application/dto/SpreadsheetResponse.ts`
  - SpreadsheetResponse: { id, name, headerData, rows[], createdAt, updatedAt }
  - SpreadsheetListItem: { id, name, rowCount, updatedAt }
- [ ] Validación con Zod para los requests

---

### B.6 - Crear use case: CreateSpreadsheet
**Estimación:** S (1-2h)
**Tipo:** Application
**Depende de:** B.3, B.5

**Criterios de aceptación:**
- [ ] `src/server/spreadsheets/application/use-cases/CreateSpreadsheet.ts`
- [ ] Recibe: { name, userId }
- [ ] Crea Spreadsheet con nombre y usuario
- [ ] Guarda via repository
- [ ] Retorna SpreadsheetResponse
- [ ] Test unitario con mock del repository

---

### B.7 - Crear use case: UpdateSpreadsheet
**Estimación:** M (2-4h)
**Tipo:** Application
**Depende de:** B.3, B.5

**Criterios de aceptación:**
- [ ] `src/server/spreadsheets/application/use-cases/UpdateSpreadsheet.ts`
- [ ] Recibe: { id, userId, headerData?, rows[]? }
- [ ] Verifica que la hoja pertenece al usuario
- [ ] Actualiza header_data y/o filas
- [ ] Actualiza updated_at
- [ ] Retorna SpreadsheetResponse actualizado
- [ ] Test unitario

---

### B.8 - Crear use cases: Archive, Restore, Delete
**Estimación:** S (1-2h)
**Tipo:** Application
**Depende de:** B.3

**Criterios de aceptación:**
- [ ] `ArchiveSpreadsheet.ts`: marca archived_at = now()
- [ ] `RestoreSpreadsheet.ts`: marca archived_at = null
- [ ] `DeleteSpreadsheet.ts`: elimina permanentemente, solo si está archivada
- [ ] Todos verifican propiedad del usuario
- [ ] Tests unitarios para los 3

---

### B.9 - Crear use case: GenerateInvoiceFromSpreadsheet
**Estimación:** M (2-4h)
**Tipo:** Application
**Depende de:** B.3

**Descripción:**
Genera factura PDF reutilizando código existente de facturas.

**Criterios de aceptación:**
- [ ] `src/server/spreadsheets/application/use-cases/GenerateInvoiceFromSpreadsheet.ts`
- [ ] Carga hoja con filas
- [ ] Mapea filas a InvoiceItem[] (usa SpreadsheetRow.toInvoiceItem())
- [ ] Mapea headerData a InvoicePayload
- [ ] Llama a generateInvoicePdf() de invoice-pdf.ts
- [ ] Llama a generateAnexoIVPdf() de anexo-iv-pdf.ts
- [ ] Sube PDFs con uploadInvoicePdf() / uploadSupplementPdf()
- [ ] Retorna { invoiceUrl, anexoUrl }
- [ ] Test unitario con mocks

---

## Fase C: API Routes

### C.1 - Crear API route: GET/POST /api/spreadsheets
**Estimación:** S (1-2h)
**Tipo:** API
**Depende de:** B.6

**Criterios de aceptación:**
- [ ] `src/app/api/spreadsheets/route.ts`
- [ ] GET: lista hojas activas del usuario autenticado
- [ ] POST: crea nueva hoja, retorna { id }
- [ ] Autenticación: verifica sesión Supabase
- [ ] Errores: 401 si no autenticado

---

### C.2 - Crear API route: GET/PUT/DELETE /api/spreadsheets/[id]
**Estimación:** S (1-2h)
**Tipo:** API
**Depende de:** B.7, B.8

**Criterios de aceptación:**
- [ ] `src/app/api/spreadsheets/[id]/route.ts`
- [ ] GET: retorna hoja completa con filas
- [ ] PUT: actualiza hoja (usado por auto-save y guardado manual)
- [ ] DELETE: elimina permanentemente (solo si archivada)
- [ ] Errores: 401, 403 (no es dueño), 404

---

### C.3 - Crear API routes: archive, restore, trash
**Estimación:** S (1-2h)
**Tipo:** API
**Depende de:** B.8

**Criterios de aceptación:**
- [ ] `src/app/api/spreadsheets/[id]/archive/route.ts` - POST
- [ ] `src/app/api/spreadsheets/[id]/restore/route.ts` - POST
- [ ] `src/app/api/spreadsheets/trash/route.ts` - GET lista papelera

---

### C.4 - Crear API route: generate-invoice
**Estimación:** S (1-2h)
**Tipo:** API
**Depende de:** B.9

**Criterios de aceptación:**
- [ ] `src/app/api/spreadsheets/[id]/generate-invoice/route.ts`
- [ ] POST: genera factura y retorna URLs
- [ ] Valida que la hoja tiene datos suficientes

---

## Fase D: Frontend - Hooks y Services

### D.1 - Crear servicio spreadsheetApi
**Estimación:** S (1-2h)
**Tipo:** Frontend
**Depende de:** C.1, C.2, C.3, C.4

**Criterios de aceptación:**
- [ ] `src/client/spreadsheets/services/spreadsheetApi.ts`
- [ ] Funciones: list, getById, create, update, archive, restore, delete, generateInvoice, listTrash
- [ ] Tipado con tipos de `client/spreadsheets/types/`
- [ ] Manejo de errores HTTP

---

### D.2 - Crear hook useSpreadsheetList
**Estimación:** S (1-2h)
**Tipo:** Frontend

**Criterios de aceptación:**
- [ ] `src/client/spreadsheets/hooks/useSpreadsheetList.ts`
- [ ] Carga lista de hojas al montar
- [ ] Estado: loading, error, spreadsheets[]
- [ ] Métodos: refresh, archive, delete
- [ ] Soporte para lista activa y papelera (modo)

---

### D.3 - Crear hook useSpreadsheet
**Estimación:** M (2-4h)
**Tipo:** Frontend

**Descripción:**
Hook principal que gestiona el estado de una hoja individual.

**Criterios de aceptación:**
- [ ] `src/client/spreadsheets/hooks/useSpreadsheet.ts`
- [ ] Carga hoja por ID (o vacía si nueva)
- [ ] Estado: loading, error, spreadsheet, rows[], headerData
- [ ] Métodos: updateRow, addRow, deleteRows, moveRow, copyRow, pasteRows, updateHeaderData
- [ ] Método save(): persiste estado actual
- [ ] Integra con useAutoSave

---

### D.4 - Crear hook useAutoSave
**Estimación:** S (1-2h)
**Tipo:** Frontend

**Criterios de aceptación:**
- [ ] `src/client/spreadsheets/hooks/useAutoSave.ts`
- [ ] Debounce de 3 segundos tras cambios
- [ ] Estados: 'saved' | 'saving' | 'unsaved'
- [ ] Protección beforeunload
- [ ] Método forceSave() para guardado manual
- [ ] Manejo de errores: mantiene 'unsaved' si falla

---

## Fase E: Frontend - Componentes

### E.1 - Crear SpreadsheetTable
**Estimación:** L (4-8h)
**Tipo:** Frontend
**Depende de:** D.3

**Descripción:**
Componente central: tabla editable estilo Excel con las 15 columnas.

**Criterios de aceptación:**
- [ ] `src/client/spreadsheets/components/SpreadsheetTable.tsx`
- [ ] 15 columnas fijas con headers
- [ ] Celdas editables (input inline)
- [ ] Navegación con Tab entre celdas
- [ ] Navegación con Enter (baja a siguiente fila)
- [ ] Fila vacía al final para añadir nuevos datos
- [ ] Selección de filas con checkbox
- [ ] Números de fila
- [ ] Scroll horizontal para las 15 columnas
- [ ] Columnas con ancho ajustado al contenido típico

---

### E.2 - Crear SpreadsheetToolbar
**Estimación:** M (2-4h)
**Tipo:** Frontend
**Depende de:** D.3, D.4

**Criterios de aceptación:**
- [ ] `src/client/spreadsheets/components/SpreadsheetToolbar.tsx`
- [ ] Botón "Guardar" (manual)
- [ ] Botón "Añadir fila"
- [ ] Botón "Eliminar fila(s)" (seleccionadas)
- [ ] Botón "Copiar fila(s)"
- [ ] Botón "Pegar fila(s)"
- [ ] Botones "Mover arriba" / "Mover abajo"
- [ ] Indicador de estado: "Guardado ✓" / "Guardando..." / "Cambios sin guardar"
- [ ] Botones deshabilitados cuando no aplican (ej: eliminar sin selección)

---

### E.3 - Crear SpreadsheetHeaderForm
**Estimación:** M (2-4h)
**Tipo:** Frontend
**Depende de:** D.3

**Descripción:**
Formulario de cabecera de facturación. Reutiliza los campos de `/facturas/nueva`.

**Criterios de aceptación:**
- [ ] `src/client/spreadsheets/components/SpreadsheetHeaderForm.tsx`
- [ ] Campos: invoiceNumber, invoiceDate, clientName, clientTaxId, clientAddress
- [ ] Campos: emitterName, emitterTaxId, emitterAddress
- [ ] Campos: destination, incoterm, awb, flightNumber
- [ ] Campos: paymentTerms, bankName, bankIban, bankSwift
- [ ] Campos: productForm, botanicalName
- [ ] Validación con react-hook-form + zod
- [ ] Colapsable (accordion) para no ocupar demasiado espacio
- [ ] Cambios se propagan al hook useSpreadsheet

---

### E.4 - Crear PasteFromExcel
**Estimación:** M (2-4h)
**Tipo:** Frontend
**Depende de:** D.3

**Criterios de aceptación:**
- [ ] `src/client/spreadsheets/components/PasteFromExcel.tsx`
- [ ] Textarea con placeholder explicativo
- [ ] Botón "Procesar pegado"
- [ ] Usa parseExcelPaste() de src/lib/parseExcelPaste.ts
- [ ] Mapea columnas parseadas a las 15 columnas de la tabla
- [ ] Añade filas al final de la tabla existente
- [ ] Muestra warnings si hay problemas de parseo
- [ ] Limpia textarea tras procesar
- [ ] Colapsable

---

### E.5 - Crear SpreadsheetList
**Estimación:** M (2-4h)
**Tipo:** Frontend
**Depende de:** D.2

**Criterios de aceptación:**
- [ ] `src/client/spreadsheets/components/SpreadsheetList.tsx`
- [ ] Grid/lista de tarjetas con las hojas del usuario
- [ ] Cada tarjeta (SpreadsheetCard): nombre, filas, última edición
- [ ] Click en tarjeta → navega a /hojas-calculo/[id]
- [ ] Botón "Crear nueva +" prominente
- [ ] Menú contextual en cada tarjeta: Renombrar, Archivar
- [ ] Estado vacío si no hay hojas

---

### E.6 - Crear SpreadsheetCard
**Estimación:** S (1-2h)
**Tipo:** Frontend

**Criterios de aceptación:**
- [ ] `src/client/spreadsheets/components/SpreadsheetCard.tsx`
- [ ] Nombre de la hoja
- [ ] Número de filas
- [ ] Fecha "Editado hace X"
- [ ] Menú con opciones: Archivar
- [ ] Hover/click state

---

### E.7 - Crear TrashBin
**Estimación:** S (1-2h)
**Tipo:** Frontend
**Depende de:** D.2

**Criterios de aceptación:**
- [ ] `src/client/spreadsheets/components/TrashBin.tsx`
- [ ] Lista de hojas archivadas
- [ ] Acciones por hoja: Restaurar / Eliminar permanentemente
- [ ] Confirmación antes de eliminar permanentemente
- [ ] Estado vacío si papelera está vacía

---

## Fase F: Páginas y Navegación

### F.1 - Crear layout de hojas-calculo
**Estimación:** XS (< 30min)
**Tipo:** Frontend

**Criterios de aceptación:**
- [ ] `src/app/hojas-calculo/layout.tsx`
- [ ] Usa PanelLayout existente
- [ ] Consistente con layout de facturas

---

### F.2 - Crear página de lista
**Estimación:** S (1-2h)
**Tipo:** Frontend
**Depende de:** E.5

**Criterios de aceptación:**
- [ ] `src/app/hojas-calculo/page.tsx`
- [ ] Renderiza SpreadsheetList
- [ ] Título "Hojas de cálculo"
- [ ] Link a papelera

---

### F.3 - Crear página nueva hoja
**Estimación:** S (1-2h)
**Tipo:** Frontend
**Depende de:** E.1, E.2, E.3, E.4

**Criterios de aceptación:**
- [ ] `src/app/hojas-calculo/nueva/page.tsx`
- [ ] Compone: SpreadsheetToolbar + PasteFromExcel + SpreadsheetTable + SpreadsheetHeaderForm + botón Generar
- [ ] Al primer guardado crea hoja y redirige a /hojas-calculo/[id]
- [ ] Botón "Generar factura" al final

---

### F.4 - Crear página editar hoja
**Estimación:** S (1-2h)
**Tipo:** Frontend
**Depende de:** E.1, E.2, E.3, E.4

**Criterios de aceptación:**
- [ ] `src/app/hojas-calculo/[id]/page.tsx`
- [ ] Carga hoja existente por ID
- [ ] Misma composición que nueva, con datos cargados
- [ ] Auto-save activo
- [ ] Botón "Generar factura"

---

### F.5 - Crear página papelera
**Estimación:** XS (< 30min)
**Tipo:** Frontend
**Depende de:** E.7

**Criterios de aceptación:**
- [ ] `src/app/hojas-calculo/papelera/page.tsx`
- [ ] Renderiza TrashBin
- [ ] Link para volver a lista principal

---

### F.6 - Añadir item al sidebar
**Estimación:** XS (< 30min)
**Tipo:** Frontend

**Criterios de aceptación:**
- [ ] Nuevo item en navItems de panel-layout.tsx
- [ ] Label: "Hojas de cálculo"
- [ ] Icon: Table2 (lucide-react)
- [ ] Href: /hojas-calculo
- [ ] Posición: entre Stock y Facturas

---

## Orden Sugerido de Ejecución

```
Fase A: Base (paralela)
A.1 (DB) | A.2 (Carpetas) | A.3 (Tipos)
    │           │               │
    └───────────┴───────┬───────┘
                        ▼
Fase B: Backend (semi-paralela)
B.1 (Entity) | B.2 (Row Entity) | B.5 (DTOs)
    │                │                │
    └────────┬───────┘                │
             ▼                        │
         B.3 (Interface)              │
             │                        │
             ▼                        │
         B.4 (Repository)            │
             │                        │
             ├────────────────────────┘
             ▼
B.6 (Create) | B.7 (Update) | B.8 (Archive/Restore/Delete) | B.9 (Generate)

Fase C: API Routes (tras Fase B)
C.1 | C.2 | C.3 | C.4 (todas paralelas)

Fase D: Hooks (tras Fase C)
D.1 (API service) → D.2 (List hook) | D.3 (Spreadsheet hook) | D.4 (AutoSave hook)

Fase E: Componentes (tras Fase D)
E.1 (Table) | E.2 (Toolbar) | E.3 (HeaderForm) | E.4 (Paste) | E.5 (List) | E.6 (Card) | E.7 (Trash)

Fase F: Páginas (tras Fase E)
F.1 (Layout) → F.2 (Lista) | F.3 (Nueva) | F.4 (Editar) | F.5 (Papelera) | F.6 (Sidebar)
```

---

## Resumen de Tareas

| ID | Tarea | Estimación | Tipo |
|----|-------|------------|------|
| **Fase A** | | | |
| A.1 | Migración Supabase | S | Database |
| A.2 | Estructura de carpetas | XS | Setup |
| A.3 | Tipos del dominio | S | Domain |
| **Fase B** | | | |
| B.1 | Entidad Spreadsheet | S | Domain |
| B.2 | Entidad SpreadsheetRow | S | Domain |
| B.3 | Interface Repository | XS | Domain |
| B.4 | SupabaseSpreadsheetRepository | M | Infrastructure |
| B.5 | DTOs + Zod | S | Application |
| B.6 | Use case: Create | S | Application |
| B.7 | Use case: Update | M | Application |
| B.8 | Use cases: Archive/Restore/Delete | S | Application |
| B.9 | Use case: GenerateInvoice | M | Application |
| **Fase C** | | | |
| C.1 | API: GET/POST /spreadsheets | S | API |
| C.2 | API: GET/PUT/DELETE /spreadsheets/[id] | S | API |
| C.3 | API: archive, restore, trash | S | API |
| C.4 | API: generate-invoice | S | API |
| **Fase D** | | | |
| D.1 | Service: spreadsheetApi | S | Frontend |
| D.2 | Hook: useSpreadsheetList | S | Frontend |
| D.3 | Hook: useSpreadsheet | M | Frontend |
| D.4 | Hook: useAutoSave | S | Frontend |
| **Fase E** | | | |
| E.1 | Componente: SpreadsheetTable | L | Frontend |
| E.2 | Componente: SpreadsheetToolbar | M | Frontend |
| E.3 | Componente: SpreadsheetHeaderForm | M | Frontend |
| E.4 | Componente: PasteFromExcel | M | Frontend |
| E.5 | Componente: SpreadsheetList | M | Frontend |
| E.6 | Componente: SpreadsheetCard | S | Frontend |
| E.7 | Componente: TrashBin | S | Frontend |
| **Fase F** | | | |
| F.1 | Layout hojas-calculo | XS | Frontend |
| F.2 | Página lista | S | Frontend |
| F.3 | Página nueva hoja | S | Frontend |
| F.4 | Página editar hoja | S | Frontend |
| F.5 | Página papelera | XS | Frontend |
| F.6 | Sidebar: nuevo item | XS | Frontend |
