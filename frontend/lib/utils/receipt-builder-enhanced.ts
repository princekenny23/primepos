/**
 * Enhanced Receipt Builder
 * Includes unit conversions and multi-unit product support
 */

import type { Product, ItemVariation, ProductUnit } from "@/lib/types"

export interface SaleItemWithUnits {
  productId: string
  productName: string
  variationName?: string
  quantity: number
  unit?: ProductUnit
  unitName?: string
  pricePerUnit: number
  subtotal: number
  totalPieces?: number // For unit conversion display
}

export interface ReceiptData {
  receiptNumber: string
  date: string
  time: string
  outlet: string
  cashier: string
  items: SaleItemWithUnits[]
  subtotal: number
  tax?: number
  discount?: number
  total: number
  paymentMethod: "cash" | "card" | "mobile" | "tab"
  businessName?: string
  phone?: string
  address?: string
  taxId?: string
  notes?: string
}

/**
 * Format item line for receipt with unit conversion
 */
export function formatReceiptItemLine(item: SaleItemWithUnits): string {
  const parts: string[] = []

  // Product and variation name
  let productLine = item.productName
  if (item.variationName) {
    productLine += ` - ${item.variationName}`
  }
  parts.push(productLine)

  // Unit and conversion info
  if (item.unit && item.unit.conversion_factor > 1) {
    const unitLine = `  ${item.quantity} × ${item.unitName} @ MWK ${item.pricePerUnit.toFixed(2)}`
    parts.push(unitLine)

    // Add conversion line
    if (item.totalPieces) {
      parts.push(`  = ${item.totalPieces} pieces`)
    }
  } else {
    const unitLine = `  ${item.quantity} × ${item.unitName || "pcs"} @ MWK ${item.pricePerUnit.toFixed(2)}`
    parts.push(unitLine)
  }

  // Subtotal
  parts.push(`  Subtotal: MWK ${item.subtotal.toFixed(2)}`)

  return parts.join("\n")
}

/**
 * Generate HTML receipt with unit conversions
 */
export function generateHTMLReceipt(data: ReceiptData): string {
  const itemsHTML = data.items
    .map((item) => {
      const showConversion = item.unit && item.unit.conversion_factor > 1

      return `
      <tr>
        <td colspan="3" style="font-weight: bold; padding-top: 8px;">
          ${item.productName}${item.variationName ? ` - ${item.variationName}` : ""}
        </td>
      </tr>
      <tr>
        <td>${item.quantity} ${item.unitName || "pcs"}</td>
        <td>MWK ${item.pricePerUnit.toFixed(2)}</td>
        <td style="text-align: right;">MWK ${item.subtotal.toFixed(2)}</td>
      </tr>
      ${
        showConversion
          ? `
      <tr style="color: #666;">
        <td colspan="3" style="font-size: 0.9em; padding: 4px 0;">
          = ${item.totalPieces} pieces
        </td>
      </tr>
      `
          : ""
      }
    `
    })
    .join("")

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: monospace; width: 80mm; margin: 0; padding: 10px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 18px; }
        .header p { margin: 4px 0; font-size: 12px; }
        .divider { border-top: 1px dashed #000; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 4px 0; }
        .items td { border-bottom: 1px solid #eee; }
        .totals { font-weight: bold; margin-top: 10px; }
        .total-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .total-amount { font-size: 18px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; }
        .conversion-note { color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${data.businessName || "PrimePOS Receipt"}</h1>
        ${data.phone ? `<p>☎️ ${data.phone}</p>` : ""}
        ${data.address ? `<p>${data.address}</p>` : ""}
      </div>

      <div class="divider"></div>

      <table>
        <tr>
          <td>Receipt #: ${data.receiptNumber}</td>
          <td style="text-align: right;">${data.date}</td>
        </tr>
        <tr>
          <td>Outlet: ${data.outlet}</td>
          <td style="text-align: right;">${data.time}</td>
        </tr>
        <tr>
          <td>Cashier: ${data.cashier}</td>
        </tr>
      </table>

      <div class="divider"></div>

      <table class="items">
        <thead>
          <tr style="font-weight: bold; border-bottom: 2px solid #000;">
            <td>Qty</td>
            <td>Price</td>
            <td style="text-align: right;">Amount</td>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <div class="divider"></div>

      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>MWK ${data.subtotal.toFixed(2)}</span>
        </div>
        ${
          data.tax
            ? `
        <div class="total-row">
          <span>Tax:</span>
          <span>MWK ${data.tax.toFixed(2)}</span>
        </div>
        `
            : ""
        }
        ${
          data.discount
            ? `
        <div class="total-row">
          <span>Discount:</span>
          <span>-MWK ${data.discount.toFixed(2)}</span>
        </div>
        `
            : ""
        }
        <div class="total-row total-amount">
          <span>TOTAL:</span>
          <span>MWK ${data.total.toFixed(2)}</span>
        </div>
      </div>

      <div class="divider"></div>

      <table>
        <tr>
          <td>Payment: ${data.paymentMethod.toUpperCase()}</td>
        </tr>
      </table>

      <div class="footer">
        <p>Thank you for your purchase!</p>
        ${data.notes ? `<p>${data.notes}</p>` : ""}
        <p>PrimePOS - Professional Retail System</p>
      </div>
    </body>
    </html>
  `
}

/**
 * Generate plain text receipt
 */
export function generateTextReceipt(data: ReceiptData): string {
  const lines: string[] = []

  // Header
  lines.push("")
  lines.push("=" .repeat(40))
  lines.push(data.businessName || "PRIMEPOS RECEIPT")
  if (data.phone) lines.push(data.phone)
  if (data.address) lines.push(data.address)
  lines.push("=" .repeat(40))
  lines.push("")

  // Receipt info
  lines.push(`Receipt #: ${data.receiptNumber}`)
  lines.push(`Date: ${data.date} ${data.time}`)
  lines.push(`Outlet: ${data.outlet}`)
  lines.push(`Cashier: ${data.cashier}`)
  lines.push("")
  lines.push("-" .repeat(40))

  // Items
  lines.push("ITEMS:")
  lines.push("")

  data.items.forEach((item) => {
    lines.push(
      item.productName +
        (item.variationName ? ` - ${item.variationName}` : "")
    )

    if (item.unit && item.unit.conversion_factor > 1) {
      lines.push(
        `  ${item.quantity}x ${item.unitName} @ MWK ${item.pricePerUnit.toFixed(2)}`
      )
      if (item.totalPieces) {
        lines.push(`  = ${item.totalPieces} pieces`)
      }
    } else {
      lines.push(
        `  ${item.quantity} ${item.unitName || "pcs"} @ MWK ${item.pricePerUnit.toFixed(2)}`
      )
    }

    lines.push(`  ${item.subtotal.toFixed(2)} MWK`)
    lines.push("")
  })

  lines.push("-" .repeat(40))
  lines.push("SUMMARY:")
  lines.push(`Subtotal:          ${data.subtotal.toFixed(2).padStart(10)} MWK`)

  if (data.tax) {
    lines.push(`Tax:               ${data.tax.toFixed(2).padStart(10)} MWK`)
  }

  if (data.discount) {
    lines.push(`Discount:          ${data.discount.toFixed(2).padStart(10)} MWK`)
  }

  lines.push("-" .repeat(40))
  lines.push(`TOTAL:             ${data.total.toFixed(2).padStart(10)} MWK`)
  lines.push("=" .repeat(40))
  lines.push("")

  lines.push(`Payment Method: ${data.paymentMethod.toUpperCase()}`)
  lines.push("")
  lines.push("Thank you for your purchase!")
  if (data.notes) lines.push(data.notes)
  lines.push("")

  return lines.join("\n")
}

/**
 * Get conversion summary for receipt footer
 */
export function getConversionSummary(items: SaleItemWithUnits[]): string | null {
  const conversions = items
    .filter((item) => item.unit && item.unit.conversion_factor > 1)
    .map((item) => `${item.quantity} ${item.unitName} = ${item.totalPieces} pcs`)

  if (conversions.length === 0) return null

  return `\nUnit Conversions:\n${conversions.map((c) => `  • ${c}`).join("\n")}`
}
