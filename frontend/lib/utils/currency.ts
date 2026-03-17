// Currency Formatting Utilities
import type { Business } from "../types"

/**
 * Format currency amount using business currency settings
 * 
 * @param amount - The amount to format
 * @param business - Optional business object (if not provided, uses default MWK)
 * @param options - Formatting options
 * @returns Formatted currency string (e.g., "MWK 1,234.56")
 */
export function formatCurrency(
  amount: number,
  business?: Business | null,
  options?: {
    showSymbol?: boolean
    decimals?: number
    symbolOverride?: string
  }
): string {
  const currency = business?.currency || "MWK"
  const symbol = options?.symbolOverride || business?.currencySymbol || "MWK"
  const decimals = options?.decimals ?? 2
  const showSymbol = options?.showSymbol ?? true

  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return showSymbol ? `${symbol} ${formatted}` : formatted
}

