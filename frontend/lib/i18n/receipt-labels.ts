/**
 * Receipt Labels for i18n
 * 
 * These labels are used in printed/digital receipts.
 * They must align correctly in both languages to ensure
 * professional-looking receipts.
 */

import type { Locale } from "@/lib/i18n"

export interface ReceiptLabels {
  // Header
  receipt: string
  receiptNumber: string
  date: string
  time: string
  cashier: string
  
  // Items
  item: string
  qty: string
  price: string
  amount: string
  
  // Totals
  subtotal: string
  discount: string
  tax: string
  total: string
  
  // Payment
  paymentMethod: string
  cash: string
  card: string
  mobile: string
  credit: string
  received: string
  change: string
  
  // Footer
  thankYou: string
  visitAgain: string
  
  // Business Info
  address: string
  phone: string
  taxId: string
}

const englishLabels: ReceiptLabels = {
  // Header
  receipt: "RECEIPT",
  receiptNumber: "Receipt No.",
  date: "Date",
  time: "Time",
  cashier: "Cashier",
  
  // Items
  item: "Item",
  qty: "Qty",
  price: "Price",
  amount: "Amount",
  
  // Totals
  subtotal: "Subtotal",
  discount: "Discount",
  tax: "Tax",
  total: "TOTAL",
  
  // Payment
  paymentMethod: "Payment",
  cash: "Cash",
  card: "Card",
  mobile: "Mobile Money",
  credit: "Credit",
  received: "Received",
  change: "Change",
  
  // Footer
  thankYou: "Thank you for your purchase!",
  visitAgain: "Please visit again",
  
  // Business Info
  address: "Address",
  phone: "Phone",
  taxId: "Tax ID",
}

const chichewaLabels: ReceiptLabels = {
  // Header
  receipt: "RISITI",
  receiptNumber: "Nambala",
  date: "Tsiku",
  time: "Nthawi",
  cashier: "Wogulitsa",
  
  // Items
  item: "Chinthu",
  qty: "Kuch.",  // Abbreviated for receipt width
  price: "Mtengo",
  amount: "Ndalama",
  
  // Totals
  subtotal: "Zonse",
  discount: "Kuchepetsa",
  tax: "Msonkho",
  total: "ZONSE",
  
  // Payment
  paymentMethod: "Kulipira",
  cash: "Ndalama",
  card: "Khadi",
  mobile: "Mobile",
  credit: "Ngongole",
  received: "Zolandidwa",
  change: "Chenjiyo",
  
  // Footer
  thankYou: "Zikomo kwambiri!",
  visitAgain: "Bwerani kachiwiri",
  
  // Business Info
  address: "Adilesi",
  phone: "Foni",
  taxId: "Nambala ya Msonkho",
}

/**
 * Get receipt labels for a specific locale
 */
export function getReceiptLabels(locale: Locale): ReceiptLabels {
  switch (locale) {
    case "ny":
      return chichewaLabels
    case "en":
    default:
      return englishLabels
  }
}

/**
 * Format payment method name for receipt
 */
export function formatPaymentMethod(method: string, locale: Locale): string {
  const labels = getReceiptLabels(locale)
  
  switch (method.toLowerCase()) {
    case "cash":
      return labels.cash
    case "card":
      return labels.card
    case "mobile":
      return labels.mobile
    case "credit":
    case "tab":
      return labels.credit
    default:
      return method
  }
}

/**
 * Generate receipt header line (centered)
 * @param text - Text to center
 * @param width - Total width in characters
 */
export function centerText(text: string, width: number = 40): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2))
  return " ".repeat(padding) + text
}

/**
 * Generate receipt separator line
 */
export function separator(width: number = 40, char: string = "-"): string {
  return char.repeat(width)
}

/**
 * Format currency for receipt (right-aligned)
 */
export function formatReceiptAmount(
  amount: number,
  currencySymbol: string = "MWK",
  width: number = 12
): string {
  const formatted = `${currencySymbol} ${amount.toFixed(2)}`
  return formatted.padStart(width)
}

