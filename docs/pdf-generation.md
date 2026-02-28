# PDF Generation

## Core Engine

The main PDF engine is `src/server/label-renderer.ts`.

## Supported Label Types (7)

```typescript
type LabelType =
  | 'mercadona'      // Template-based fixed layout
  | 'aldi'           // Multi-label with variable lot numbers (E00001-E99999)
  | 'lidl'           // 3-label system (base + 2 white labels)
  | 'hiperdino'      // Customizable weight and lot
  | 'kanali'         // Dedicated design
  | 'blanca-grande'  // Generic large white label
  | 'blanca-pequena' // Generic small white label
```

## Key Functions

- `renderLabelPdf()` - Main entry point for single labels
- `renderAldiLabelSet()` - Generates Aldi labels with trace numbers (E00001, E00002, etc.)
- `renderLidlLabelSet()` - Generates 3 PDFs for Lidl (base + 2 white labels)
- `processLabelAutomation()` in `label-automation.ts` - Orchestrates rendering -> upload -> inventory

## Template Resolution

Templates are loaded from `public/` directory:
- Default: `Etiqueta.pdf` or `Etiqueta.png`
- Aldi: `Etiqueta-Aldi.pdf`
- Environment variable: `LABEL_TEMPLATE_PATH` (optional override)

## Font Loading

- Tries `LABEL_FONT_PATH` env var first
- Fallback candidates: `public/fonts/Arial.ttf`, system fonts
- Uses `@pdf-lib/fontkit` for custom fonts

## Layout System

Text is positioned using pixel coordinates based on a 1262x768px canvas (67mm x 41mm label):

```typescript
const TEXT_LAYOUT: Record<TemplateLayoutField, LayoutEntry> = {
  fechaEnvasado: { baseX: 325, baseY: 415, align: 'left', fontSize: 34 },
  lote: { baseX: 215, baseY: 490, align: 'left', fontSize: 34 },
  codigoCoc: { baseX: 205, baseY: 630, align: 'left', fontSize: 34 },
  codigoR: { baseX: 1020, baseY: 505, align: 'left', fontSize: 27 },
}
```

**Coordinate system**: Origin (0,0) is bottom-left corner, NOT top-left.

## Adding a New Label Type

1. **Define the label type** in `src/lib/product-selection.ts`:
   ```typescript
   export type LabelType = 'mercadona' | 'aldi' | ... | 'new-type'
   ```

2. **Create a specialized renderer** (if complex) in `src/server/renderers/`:
   ```typescript
   // src/server/renderers/new-type-renderer.ts
   export async function renderNewTypeLabel(fields: LabelRenderFields): Promise<LabelRenderResult> {
     // Custom rendering logic
   }
   ```

3. **Update `label-renderer.ts`** to route to your renderer:
   ```typescript
   if (labelType === 'new-type') {
     return renderNewTypeLabel(fields)
   }
   ```

4. **Add template file** to `public/` (e.g., `Etiqueta-NewType.pdf`)

5. **Update `panel-config.ts`** if UI changes needed

## Modifying Label Layouts

Edit `TEXT_LAYOUT` constants in `src/server/label-renderer.ts`:

```typescript
const TEXT_LAYOUT: Record<TemplateLayoutField, LayoutEntry> = {
  fechaEnvasado: {
    baseX: 325,    // Horizontal position (pixels)
    baseY: 415,    // Vertical position (pixels)
    align: 'left', // Text alignment
    fontSize: 34   // Font size
  },
  // ... other fields
}
```

## Debugging PDF Generation

1. **Check template file exists**: Templates must be in `public/` with exact case-sensitive name
2. **Verify font loading**: Check console for font load errors
3. **Inspect coordinates**: Use `console.log()` in `label-renderer.ts` to debug positioning
4. **Test with different data**: Empty strings or special characters may cause issues
5. **Check buffer size**: Large PDFs may timeout API routes

## Common Gotchas

- **Template not found**: File must exist in `public/` with exact case-sensitive name
- **Font rendering issues**: Verify `Arial.ttf` exists or set `LABEL_FONT_PATH`
- **Coordinate system confusion**: PDF origin is bottom-left, not top-left
- **Aldi trace numbers**: Auto-generated as E00001, E00002, ... E99999 (5 digits)
- **Lidl labels**: Always generates 3 PDFs (1 base + 2 white labels)
