// Currency Formatting Utilities
import type { Business } from "../types"

function normalizeCurrencyLabel(value?: string | null): string {
  const normalized = String(value || "").trim().toUpperCase()

  if (normalized === "MK") {
    return "MWK"
  }

  return normalized || "MWK"
}

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
  const currency = normalizeCurrencyLabel(business?.currency)
  const symbol = normalizeCurrencyLabel(options?.symbolOverride || business?.currencySymbol || currency)
  const decimals = options?.decimals ?? 2
  const showSymbol = options?.showSymbol ?? true

  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return showSymbol ? `${symbol} ${formatted}` : formatted
}

