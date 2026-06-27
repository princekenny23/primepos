import { api, apiEndpoints } from "@/lib/api"
import { printReceipt } from "@/lib/print"
import { receiptService } from "@/lib/services/receiptService"

export interface ReceiptActionPayload {
  cart: Array<{ name: string; price: number; quantity: number; total: number; sku?: string }>
  subtotal: number
  discount: number
  tax: number
  total: number
  sale: any
  outletId?: number | string
}

export async function printReceiptForSale(payload: ReceiptActionPayload): Promise<void> {
  await printReceipt(
    {
      cart: payload.cart,
      subtotal: payload.subtotal,
      discount: payload.discount,
      tax: payload.tax,
      total: payload.total,
      sale: payload.sale,
    },
    payload.outletId
  )
}

export async function downloadReceiptForSale(saleId: string): Promise<void> {
  let receipt

  try {
    receipt = await receiptService.getBySale(String(saleId))
  } catch (error: any) {
    const status = error?.status || error?.response?.status
    const message = String(error?.message || "").toLowerCase()
    const isNotFound = status === 404 || message.includes("receipt not found")

    if (!isNotFound) {
      throw error
    }

    await api.post(`${apiEndpoints.sales.get(String(saleId))}generate-receipt/`, { format: "pdf" })
    receipt = await receiptService.getBySale(String(saleId))
  }

  if (receipt.format !== "pdf") {
    receipt = await receiptService.regenerate(receipt.id, "pdf")
  }

  const { data, contentType } = await receiptService.download(receipt.id)
  const isPdf = contentType?.includes("pdf") || receipt.format === "pdf"
  const mimeType = isPdf ? "application/pdf" : "text/plain"
  const extension = isPdf ? "pdf" : "txt"

  const blob = new Blob([data], { type: mimeType })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `Receipt-${receipt.receipt_number || saleId}.${extension}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
