/**
 * Receipt builder utility
 * Normalizes sale response data for printing across different endpoints
 */

export interface ReceiptItem {
  id: string
  name: string
  price: number
  quantity: number
  total: number
}

export interface ReceiptData {
  receiptNumber: string | number
  items: ReceiptItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  customerName?: string
  customerPhone?: string
  tableName?: string
  createdAt?: string
  [key: string]: any
}

export function buildReceipt(saleResponse: any): ReceiptData {
  const items = (saleResponse.items || []).map((it: any, idx: number) => ({
    id: it.productId ? `${it.productId}-${idx}` : `item-${idx}`,
    name: it.productName || it.product_name || it.name || 'Item',
    price: it.price || 0,
    quantity: it.quantity || 0,
    total: it.total || (it.quantity || 0) * (it.price || 0),
  }))

  const receipt: ReceiptData = {
    receiptNumber: saleResponse._raw?.receipt_number || saleResponse.id,
    items,
    subtotal: saleResponse.subtotal || 0,
    tax: saleResponse.tax || 0,
    discount: saleResponse.discount || 0,
    total: saleResponse.total || 0,
    customerName: saleResponse._raw?.customer_detail?.name || saleResponse.customerName,
    customerPhone: saleResponse._raw?.customer_detail?.phone || saleResponse.customerPhone,
    tableName: saleResponse._raw?.table_detail?.number || saleResponse.tableName,
    createdAt: saleResponse.createdAt || new Date().toISOString(),
  }

  return receipt
}

/**
 * Convert receipt data for print API consumption
 */
export function normalizeReceiptForPrint(receiptData: ReceiptData, outletId: string) {
  return {
    cart: receiptData.items,
    subtotal: receiptData.subtotal,
    discount: receiptData.discount,
    tax: receiptData.tax,
    total: receiptData.total,
    sale: {
      id: receiptData.receiptNumber,
      _raw: {
        receipt_number: receiptData.receiptNumber,
        customer_detail: {
          name: receiptData.customerName,
          phone: receiptData.customerPhone,
        },
        table_detail: {
          number: receiptData.tableName,
        },
      },
    },
    outletId,
  }
}
