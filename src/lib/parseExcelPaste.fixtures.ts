import type { InvoicePasteResult } from './parseExcelPaste'

type PasteFixture = {
  name: string
  raw: string
  expected: Partial<InvoicePasteResult>
}

export const parseExcelPasteFixtures: PasteFixture[] = [
  {
    name: 'header with blanks extracts invoice and awb without breaking rows',
    raw: [
      'Factura\tAWB\tProducto\tPeso neto\tPrecio\tBultos\tImporte',
      'FAC-001\t123-456789\tBASIL\t620\t7,5\t124\t',
      '\t\tMINT\t\t8,0\t\t',
      '\t\t\t\t\t\t',
    ].join('\n'),
    expected: {
      header: { invoiceNumber: 'FAC-001', awb: '123-456789' },
      rows: [
        { product: 'BASIL', invoiceNumber: 'FAC-001', awb: '123-456789', netWeightKg: 620, price: 7.5, bundles: 124, total: 4650 },
        { product: 'MINT', invoiceNumber: '', awb: '', price: 8 },
      ],
    },
  },
  {
    name: 'no header keeps legacy fallback mapping',
    raw: ['BASIL\t620\t7,5\t124\t4650', 'MINT\t500\t8\t100\t4000'].join('\n'),
    expected: {
      header: {},
      rows: [
        { product: 'BASIL', netWeightKg: 620, price: 7.5, bundles: 124, total: 4650 },
        { product: 'MINT', netWeightKg: 500, price: 8, bundles: 100, total: 4000 },
      ],
    },
  },
]
