import type { InvoicePasteRow } from './parseExcelPaste'

export type InvoiceTotals = {
  totalBundles: number
  totalNetKg: number
  totalGrossKg: number
  totalAmount: number
}

/** Tare weight per bundle in kg (box weight) */
const BUNDLE_TARE_KG = 0.8

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
  let totalGrossKg = Number((totals.totalBundles * BUNDLE_TARE_KG + totals.totalNetKg).toFixed(2))
  // Sanity check: gross weight can never be less than net weight
  if (totalGrossKg < totals.totalNetKg) totalGrossKg = totals.totalNetKg
  return { ...totals, totalGrossKg }
}
