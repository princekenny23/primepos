import type { Product } from "@/lib/types"

export interface LowStockAlertItem {
  id: string
  name: string
  sku: string
  currentStock: number
  minStock: number
  category: string
}

export type ExpiryAlertStatus = "expired" | "expires-today" | "expiring-soon" | "expiring-month"

export interface ExpiryAlertItem {
  id: string
  name: string
  sku: string
  category: string
  expiryDate: string
  status: ExpiryAlertStatus
  days: number
}

export function getExpiryAlertStatus(expiryDate?: string): { status: ExpiryAlertStatus; days: number } | null {
  if (!expiryDate) return null

  const expiry = new Date(expiryDate)
  if (Number.isNaN(expiry.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expiry.setHours(0, 0, 0, 0)

  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilExpiry < 0) {
    return { status: "expired", days: Math.abs(daysUntilExpiry) }
  }

  if (daysUntilExpiry === 0) {
    return { status: "expires-today", days: 0 }
  }

  if (daysUntilExpiry <= 7) {
    return { status: "expiring-soon", days: daysUntilExpiry }
  }

  if (daysUntilExpiry <= 30) {
    return { status: "expiring-month", days: daysUntilExpiry }
  }

  return null
}

export function mapLowStockAlerts(products: any[]): LowStockAlertItem[] {
  return products.map((product: any) => {
    const lowVariation = product.variations?.find(
      (variation: any) =>
        variation.track_inventory &&
        variation.low_stock_threshold > 0 &&
        (variation.total_stock || variation.stock || 0) <= variation.low_stock_threshold,
    )

    return {
      id: String(product.id),
      name: product.name,
      sku: product.sku || lowVariation?.sku || "N/A",
      currentStock: lowVariation ? (lowVariation.total_stock || lowVariation.stock || 0) : (product.stock || 0),
      minStock: lowVariation ? (lowVariation.low_stock_threshold || 0) : (product.low_stock_threshold || 0),
      category: product.category?.name || "General",
    }
  })
}

export function mapExpiryAlerts(products: Product[]): ExpiryAlertItem[] {
  return products
    .filter((product) => product.track_expiration || product.expiry_date)
    .map((product) => {
      const expiryStatus = getExpiryAlertStatus(product.expiry_date)
      if (!expiryStatus || !product.expiry_date) {
        return null
      }

      return {
        id: String(product.id),
        name: product.name,
        sku: product.sku || "N/A",
        category: product.category?.name || "General",
        expiryDate: product.expiry_date,
        status: expiryStatus.status,
        days: expiryStatus.days,
      }
    })
    .filter((item): item is ExpiryAlertItem => item !== null)
    .sort((left, right) => {
      const rank: Record<ExpiryAlertStatus, number> = {
        expired: 0,
        "expires-today": 1,
        "expiring-soon": 2,
        "expiring-month": 3,
      }

      if (rank[left.status] !== rank[right.status]) {
        return rank[left.status] - rank[right.status]
      }

      return left.days - right.days
    })
}