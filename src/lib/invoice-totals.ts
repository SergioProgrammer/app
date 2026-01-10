import type { InvoicePasteRow } from './parseExcelPaste'

export type InvoiceTotals = {
  totalBundles: number
  totalNetKg: number
  totalGrossKg: number
  totalAmount: number
}

function normalizeNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function calculateTotals(items: InvoicePasteRow[]): InvoiceTotals {
  const totals = items.reduce(
    (acc, item) => {
      acc.totalBundles += normalizeNumber(item.bundles)
      acc.totalNetKg += normalizeNumber(item.netWeightKg)
      acc.totalAmount += normalizeNumber(item.total)
      return acc
    },
    { totalBundles: 0, totalNetKg: 0, totalAmount: 0 },
  )
  const totalGrossKg = Number((totals.totalBundles * 0.4 * 2 + totals.totalNetKg).toFixed(2))
  return { ...totals, totalGrossKg }
}
