import { buildSaleCreatePayload, type CreateSaleData } from "@/lib/services/saleService"
import { enqueueOutboxEvent, getPendingOutboxCount } from "@/lib/offline/outbox-db"
import { useOfflineStore } from "@/stores/offlineStore"

export interface OfflineSaleItem {
  id: string
  name: string
  price: number
  quantity: number
  total: number
}

export interface OfflineCompletedSale {
  local_sale_id: string
  client_event_id: string
  receipt_number: string
  tenant_id: string
  outlet_id: string
  shift_id: string
  user_id: string
  customer_id: string | null
  customer_name: string | null
  business_name: string | null
  outlet_name: string | null
  cashier_name: string | null
  payment_method: "cash"
  subtotal: number
  tax: number
  discount: number
  total: number
  cash_received: number
  change_given: number
  created_at_local: string
  status: "pending" | "syncing" | "synced" | "failed"
  last_error: string | null
  items: OfflineSaleItem[]
  server_sale_id?: string | null
  server_receipt_number?: string | null
}

const DB_NAME = "primepos-offline-sales"
const DB_VERSION = 1
const SALES_STORE = "offline_completed_sales"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available"))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SALES_STORE)) {
        const store = db.createObjectStore(SALES_STORE, { keyPath: "local_sale_id" })
        store.createIndex("client_event_id", "client_event_id", { unique: true })
        store.createIndex("status", "status", { unique: false })
        store.createIndex("created_at_local", "created_at_local", { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error("Failed to open offline sales database"))
  })
}

function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
}

function generateReceiptNumber(outletId: string): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`
  const outletSuffix = String(outletId || "0").replace(/\D/g, "").slice(-4) || "0000"
  return `OFF-${outletSuffix}-${stamp}`
}

async function putSale(record: OfflineCompletedSale): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SALES_STORE, "readwrite")
    const store = tx.objectStore(SALES_STORE)
    const request = store.put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error || new Error("Failed to save offline sale"))
  })
}

async function getSaleByClientEventId(clientEventId: string): Promise<OfflineCompletedSale | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SALES_STORE, "readonly")
    const store = tx.objectStore(SALES_STORE)
    const index = store.index("client_event_id")
    const request = index.get(clientEventId)
    request.onsuccess = () => resolve((request.result as OfflineCompletedSale | undefined) || null)
    request.onerror = () => reject(request.error || new Error("Failed to load offline sale"))
  })
}

function readLocalContext() {
  if (typeof window === "undefined") {
    throw new Error("Offline POS is only available in the browser")
  }

  const userRaw = localStorage.getItem("primepos-auth")
  const businessRaw = localStorage.getItem("primepos-business")

  const parsedUser = userRaw ? JSON.parse(userRaw) : null
  const parsedBusiness = businessRaw ? JSON.parse(businessRaw) : null

  const tenantId = String(parsedBusiness?.state?.currentBusiness?.id || "")
  const businessName = parsedBusiness?.state?.currentBusiness?.name ? String(parsedBusiness.state.currentBusiness.name) : null
  const outletName = parsedBusiness?.state?.currentOutlet?.name ? String(parsedBusiness.state.currentOutlet.name) : null
  const userId = String(parsedUser?.state?.user?.id || "")
  const cashierName = parsedUser?.state?.user?.name || parsedUser?.state?.user?.full_name || parsedUser?.state?.user?.username || null

  return {
    tenantId,
    businessName,
    outletName,
    userId,
    cashierName: cashierName ? String(cashierName) : null,
  }
}

export async function completeOfflineCashSale(input: {
  saleData: CreateSaleData
  cashReceived: number
  changeGiven: number
  items: OfflineSaleItem[]
  customerName?: string | null
}): Promise<OfflineCompletedSale> {
  const salePayload = buildSaleCreatePayload(input.saleData)
  const { tenantId, businessName, outletName, userId, cashierName } = readLocalContext()
  const outletId = String(input.saleData.outlet)
  const shiftId = String(input.saleData.shift || "")

  if (!tenantId || !userId || !outletId || !shiftId) {
    throw new Error("Offline sale cannot be completed because tenant, user, outlet, or shift context is missing.")
  }

  const queued = await enqueueOutboxEvent({
    tenant_id: tenantId,
    outlet_id: outletId,
    user_id: userId,
    event_type: "post:/sales/",
    payload: salePayload,
  })

  const record: OfflineCompletedSale = {
    local_sale_id: generateId("offline-sale"),
    client_event_id: queued.client_event_id,
    receipt_number: generateReceiptNumber(outletId),
    tenant_id: tenantId,
    outlet_id: outletId,
    shift_id: shiftId,
    user_id: userId,
    customer_id: input.saleData.customer ? String(input.saleData.customer) : null,
    customer_name: input.customerName || null,
    business_name: businessName,
    outlet_name: outletName,
    cashier_name: cashierName,
    payment_method: "cash",
    subtotal: Number(input.saleData.subtotal || 0),
    tax: Number(input.saleData.tax || 0),
    discount: Number(input.saleData.discount || 0),
    total: Number(input.saleData.total || 0),
    cash_received: Number(input.cashReceived || 0),
    change_given: Number(input.changeGiven || 0),
    created_at_local: new Date().toISOString(),
    status: "pending",
    last_error: null,
    items: input.items,
    server_sale_id: null,
    server_receipt_number: null,
  }

  await putSale(record)

  const pending = await getPendingOutboxCount().catch(() => 0)
  useOfflineStore.getState().setPendingCount(pending)
  useOfflineStore.getState().setLastSyncError(null)

  return record
}

export function buildOfflinePrintableSale(record: OfflineCompletedSale) {
  return {
    id: record.local_sale_id,
    receipt_number: record.receipt_number,
    created_at: record.created_at_local,
    cashier_name: record.cashier_name || "Cashier",
    business: {
      name: record.business_name || "Business",
    },
    outlet: {
      id: record.outlet_id,
      name: record.outlet_name || "Outlet",
    },
    customer_detail: record.customer_name
      ? {
          name: record.customer_name,
        }
      : undefined,
  }
}

export async function markOfflineSalesSyncing(clientEventIds: string[]): Promise<void> {
  await Promise.all(
    clientEventIds.map(async (clientEventId) => {
      const sale = await getSaleByClientEventId(clientEventId)
      if (!sale) return
      await putSale({ ...sale, status: "syncing", last_error: null })
    })
  )
}

export async function markOfflineSaleFailed(clientEventId: string, errorMessage: string): Promise<void> {
  const sale = await getSaleByClientEventId(clientEventId)
  if (!sale) return
  await putSale({ ...sale, status: "failed", last_error: errorMessage })
}

export async function markOfflineSalesSynced(clientEventIds: string[]): Promise<void> {
  await Promise.all(
    clientEventIds.map(async (clientEventId) => {
      const sale = await getSaleByClientEventId(clientEventId)
      if (!sale) return
      await putSale({ ...sale, status: "synced", last_error: null })
    })
  )
}