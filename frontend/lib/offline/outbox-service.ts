import { api, apiEndpoints } from "@/lib/api"
import { offlineConfig } from "@/lib/offline/config"
import {
  markOfflineSaleFailed,
  markOfflineSalesSynced,
  markOfflineSalesSyncing,
} from "@/lib/offline/offline-sales"
import {
  getOutboxCounts,
  getPendingOutboxCount,
  listPendingOutboxEvents,
  markOutboxEventFailed,
  markOutboxEventsSyncing,
  removeOutboxEvents,
  type OutboxEvent,
} from "@/lib/offline/outbox-db"
import { useOfflineStore } from "@/stores/offlineStore"

export interface SyncPushEvent {
  client_event_id: string
  event_type: string
  payload: unknown
  tenant_id: string
  outlet_id: string
  user_id: string
}

type PushResult = {
  client_event_id?: string
  status?: string
  detail?: string
}

export async function pushBatch(events: SyncPushEvent[]) {
  if (!offlineConfig.isPhaseAtLeast(2)) {
    return { skipped: true, reason: "Offline phase < 2" }
  }

  const setSyncing = useOfflineStore.getState().setSyncing
  const setLastSyncError = useOfflineStore.getState().setLastSyncError
  const setLastSyncAt = useOfflineStore.getState().setLastSyncAt

  setSyncing(true)
  try {
    const response = await api.post<any>(apiEndpoints.sync.pushBatch, { events })
    setLastSyncError(null)
    setLastSyncAt(new Date().toISOString())
    return response
  } catch (error: any) {
    setLastSyncError(error?.message || "Push batch failed")
    throw error
  } finally {
    setSyncing(false)
  }
}

export async function pullChanges(cursor?: string) {
  if (!offlineConfig.isPhaseAtLeast(2)) {
    return { skipped: true, reason: "Offline phase < 2", changes: [] as any[] }
  }

  const setSyncing = useOfflineStore.getState().setSyncing
  const setLastSyncError = useOfflineStore.getState().setLastSyncError
  const setLastSyncAt = useOfflineStore.getState().setLastSyncAt

  setSyncing(true)
  try {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""
    const response = await api.get<any>(`${apiEndpoints.sync.pullChanges}${query}`)
    setLastSyncError(null)
    setLastSyncAt(new Date().toISOString())
    return response
  } catch (error: any) {
    setLastSyncError(error?.message || "Pull changes failed")
    throw error
  } finally {
    setSyncing(false)
  }
}

function toSyncPushEvent(event: OutboxEvent): SyncPushEvent {
  return {
    client_event_id: event.client_event_id,
    event_type: event.event_type,
    payload: event.payload,
    tenant_id: event.tenant_id,
    outlet_id: event.outlet_id,
    user_id: event.user_id,
  }
}

export async function flushPendingOutbox(limit = 50) {
  if (!offlineConfig.isPhaseAtLeast(2)) {
    return { skipped: true, reason: "Offline phase < 2" }
  }

  if (typeof window !== "undefined" && !window.navigator.onLine) {
    return { skipped: true, reason: "Browser is offline" }
  }

  const pending = await listPendingOutboxEvents(limit)
  if (!pending.length) {
    const counts = await getOutboxCounts().catch(() => ({ pending: 0, deadLetter: 0, failed: 0 }))
    useOfflineStore.getState().setPendingCount(counts.pending)
    useOfflineStore.getState().setDeadLetterCount(counts.deadLetter)
    return { flushed: 0, pendingCount: counts.pending, deadLetterCount: counts.deadLetter }
  }

  const clientEventIds = pending.map((event) => event.client_event_id)
  await markOutboxEventsSyncing(clientEventIds)
  await markOfflineSalesSyncing(clientEventIds).catch(() => undefined)

  let response: any
  try {
    response = await pushBatch(pending.map(toSyncPushEvent))
  } catch (error: any) {
    for (const clientEventId of clientEventIds) {
      await markOutboxEventFailed(clientEventId, error?.message || "Batch sync failed")
      await markOfflineSaleFailed(clientEventId, error?.message || "Batch sync failed").catch(() => undefined)
    }
    const counts = await getOutboxCounts().catch(() => ({ pending: 0, deadLetter: 0, failed: 0 }))
    useOfflineStore.getState().setPendingCount(counts.pending)
    useOfflineStore.getState().setDeadLetterCount(counts.deadLetter)
    throw error
  }
  const results: PushResult[] = Array.isArray(response?.results) ? response.results : []

  const acceptedStatuses = new Set(["accepted", "accepted_placeholder", "duplicate"])
  const acceptedIds = new Set<string>()

  for (const result of results) {
    const id = result?.client_event_id
    if (!id) continue
    if (acceptedStatuses.has(String(result.status || ""))) {
      acceptedIds.add(id)
      continue
    }
    await markOutboxEventFailed(id, result.detail || "Sync rejected")
    await markOfflineSaleFailed(id, result.detail || "Sync rejected").catch(() => undefined)
  }

  if (acceptedIds.size) {
    const acceptedIdList = Array.from(acceptedIds)
    await removeOutboxEvents(acceptedIdList)
    await markOfflineSalesSynced(acceptedIdList).catch(() => undefined)

    if (typeof window !== "undefined") {
      const acceptedIdSet = new Set(acceptedIdList)
      const acceptedEvents = pending.filter((event) => acceptedIdSet.has(event.client_event_id))
      window.dispatchEvent(
        new CustomEvent("offline-sync-complete", {
          detail: {
            acceptedCount: acceptedIdList.length,
            clientEventIds: acceptedIdList,
            outletIds: Array.from(new Set(acceptedEvents.map((event) => String(event.outlet_id || "")).filter(Boolean))),
          },
        })
      )
    }
  }

  const counts = await getOutboxCounts().catch(() => ({ pending: 0, deadLetter: 0, failed: 0 }))
  useOfflineStore.getState().setPendingCount(counts.pending)
  useOfflineStore.getState().setDeadLetterCount(counts.deadLetter)
  return { flushed: acceptedIds.size, pendingCount: counts.pending, deadLetterCount: counts.deadLetter }
}
