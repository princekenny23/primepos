export interface OutboxEvent {
  id?: number
  client_event_id: string
  tenant_id: string
  outlet_id: string
  user_id: string
  event_type: string
  payload: unknown
  created_at_local: string
  retry_count: number
  last_error: string | null
  status: "pending" | "syncing" | "failed" | "dead_letter"
}

const DB_NAME = "primepos-offline"
const DB_VERSION = 1
const OUTBOX_STORE = "outbox_events"
export const MAX_OUTBOX_RETRIES = 5

function getUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available"))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: "id", autoIncrement: true })
        store.createIndex("status", "status", { unique: false })
        store.createIndex("created_at_local", "created_at_local", { unique: false })
        store.createIndex("client_event_id", "client_event_id", { unique: true })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"))
  })
}

export async function getPendingOutboxCount(): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readonly")
    const store = tx.objectStore(OUTBOX_STORE)
    const index = store.index("status")
    const request = index.count("pending")
    request.onsuccess = () => resolve(request.result || 0)
    request.onerror = () => reject(request.error || new Error("Failed to count pending outbox events"))
  })
}

export async function getOutboxCounts(): Promise<{
  pending: number
  deadLetter: number
  failed: number
}> {
  const db = await openDb()
  const countByStatus = async (status: OutboxEvent["status"]) =>
    new Promise<number>((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, "readonly")
      const store = tx.objectStore(OUTBOX_STORE)
      const index = store.index("status")
      const request = index.count(status)
      request.onsuccess = () => resolve(request.result || 0)
      request.onerror = () => reject(request.error || new Error(`Failed to count ${status} outbox events`))
    })

  const [pending, deadLetter, failed] = await Promise.all([
    countByStatus("pending"),
    countByStatus("dead_letter"),
    countByStatus("failed"),
  ])

  return { pending, deadLetter, failed }
}

export async function enqueueOutboxEvent(event: Omit<OutboxEvent, "id" | "created_at_local" | "retry_count" | "last_error" | "status" | "client_event_id">): Promise<OutboxEvent> {
  const db = await openDb()
  const normalized: OutboxEvent = {
    client_event_id: getUuid(),
    created_at_local: new Date().toISOString(),
    retry_count: 0,
    last_error: null,
    status: "pending",
    ...event,
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite")
    const store = tx.objectStore(OUTBOX_STORE)
    const request = store.add(normalized)
    request.onsuccess = () => resolve({ ...normalized, id: Number(request.result) })
    request.onerror = () => reject(request.error || new Error("Failed to enqueue outbox event"))
  })
}

export async function listPendingOutboxEvents(limit = 100): Promise<OutboxEvent[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readonly")
    const store = tx.objectStore(OUTBOX_STORE)
    const index = store.index("status")
    const request = index.getAll("pending")
    request.onsuccess = () => {
      const items = (request.result || []) as OutboxEvent[]
      items.sort((a, b) => String(a.created_at_local).localeCompare(String(b.created_at_local)))
      resolve(items.slice(0, limit))
    }
    request.onerror = () => reject(request.error || new Error("Failed to list pending outbox events"))
  })
}

export async function markOutboxEventsSyncing(clientEventIds: string[]): Promise<void> {
  if (!clientEventIds.length) return
  const db = await openDb()

  await Promise.all(
    clientEventIds.map(
      (clientEventId) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(OUTBOX_STORE, "readwrite")
          const store = tx.objectStore(OUTBOX_STORE)
          const index = store.index("client_event_id")
          const getReq = index.get(clientEventId)
          getReq.onsuccess = () => {
            const record = getReq.result as OutboxEvent | undefined
            if (!record) {
              resolve()
              return
            }
            record.status = "syncing"
            const putReq = store.put(record)
            putReq.onsuccess = () => resolve()
            putReq.onerror = () => reject(putReq.error || new Error("Failed to mark event syncing"))
          }
          getReq.onerror = () => reject(getReq.error || new Error("Failed to load outbox event"))
        })
    )
  )
}

export async function markOutboxEventsPending(clientEventIds: string[], errorMessage?: string): Promise<void> {
  if (!clientEventIds.length) return
  const db = await openDb()

  await Promise.all(
    clientEventIds.map(
      (clientEventId) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(OUTBOX_STORE, "readwrite")
          const store = tx.objectStore(OUTBOX_STORE)
          const index = store.index("client_event_id")
          const getReq = index.get(clientEventId)
          getReq.onsuccess = () => {
            const record = getReq.result as OutboxEvent | undefined
            if (!record) {
              resolve()
              return
            }
            record.status = "pending"
            if (errorMessage) {
              record.last_error = errorMessage
            }
            const putReq = store.put(record)
            putReq.onsuccess = () => resolve()
            putReq.onerror = () => reject(putReq.error || new Error("Failed to reset event to pending"))
          }
          getReq.onerror = () => reject(getReq.error || new Error("Failed to load outbox event"))
        })
    )
  )
}

export async function markOutboxEventFailed(clientEventId: string, errorMessage: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite")
    const store = tx.objectStore(OUTBOX_STORE)
    const index = store.index("client_event_id")
    const getReq = index.get(clientEventId)
    getReq.onsuccess = () => {
      const record = getReq.result as OutboxEvent | undefined
      if (!record) {
        resolve()
        return
      }
      const nextRetryCount = Number(record.retry_count || 0) + 1
      record.retry_count = nextRetryCount
      record.last_error = errorMessage
      if (nextRetryCount >= MAX_OUTBOX_RETRIES) {
        record.status = "dead_letter"
      } else {
        record.status = "pending"
      }
      const putReq = store.put(record)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error || new Error("Failed to mark event failed"))
    }
    getReq.onerror = () => reject(getReq.error || new Error("Failed to find outbox event"))
  })
}

export async function removeOutboxEvents(clientEventIds: string[]): Promise<void> {
  if (!clientEventIds.length) return
  const db = await openDb()

  await Promise.all(
    clientEventIds.map(
      (clientEventId) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(OUTBOX_STORE, "readwrite")
          const store = tx.objectStore(OUTBOX_STORE)
          const index = store.index("client_event_id")
          const getReq = index.getKey(clientEventId)
          getReq.onsuccess = () => {
            const key = getReq.result
            if (key === undefined || key === null) {
              resolve()
              return
            }
            const delReq = store.delete(key)
            delReq.onsuccess = () => resolve()
            delReq.onerror = () => reject(delReq.error || new Error("Failed to delete outbox event"))
          }
          getReq.onerror = () => reject(getReq.error || new Error("Failed to lookup outbox event key"))
        })
    )
  )
}
