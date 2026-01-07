# Facturas – flujo manual

1) En el panel lateral pulsa **Facturas** → `/facturas/nueva` (o usa la pestaña **Historial** para ver facturas previas).
2) Completa número, fecha, datos de cliente y emisor.
3) Pega la tabla desde Excel (TSV recomendado). Columnas esperadas: `Producto`, `Peso neto (kg)`, `Precio`, `Bultos`, `Importe total`. Si faltan campos, edita manualmente en la tabla.
4) Pulsa **Procesar pegado** para rellenar la tabla.
5) Pulsa **Generar**: valida filas, genera el PDF y lo sube al bucket `facturas` (`facturas/<año>/<mes>/factura_<numero>_<fecha>.pdf`). Muestra enlace de descarga (public o signed según el bucket).
6) En **Historial** (`/facturas/historial`) se listan las facturas registradas (tabla `facturas`) con opción de abrir/descargar.

Notas rápidas:
- Parser: TSV/CSV autodetectado; con o sin cabecera. Si un dato falta, queda vacío para edición manual.
- Validación: cada fila necesita Producto e Importe (o Peso+Precio para calcular).
- Totales: suma de importes, IGIC 0% por defecto, total a pagar. 
