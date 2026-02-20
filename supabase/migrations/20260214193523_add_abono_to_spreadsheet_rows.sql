-- Agregar columna 'abono' a spreadsheet_rows
ALTER TABLE spreadsheet_rows
ADD COLUMN abono NUMERIC(12,4);

-- Calcular abono retroactivo para filas existentes con bundles > 0 y kg > 0
UPDATE spreadsheet_rows
SET abono = ROUND((kg / NULLIF(bundles, 0))::numeric, 4)
WHERE bundles > 0 AND kg > 0 AND abono IS NULL;

-- Comentario: abono es el "peso por unidad" usado para calcular bultos
COMMENT ON COLUMN spreadsheet_rows.abono IS 'Peso por unidad (kg/unidad). Bultos = Kg / Abono';
