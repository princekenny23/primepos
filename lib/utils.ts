import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency amount in MWK (Malawian Kwacha)
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted currency string (e.g., "MWK 1,234.56")
 */
export function formatCurrency(
  amount: number,
  options?: {
    showSymbol?: boolean
    decimals?: number
    locale?: string
  }
): string {
  const {
    showSymbol = true,
    decimals = 2,
    locale = "en-US",
  } = options || {}

  const formatted = amount.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return showSymbol ? `MWK ${formatted}` : formatted
}

