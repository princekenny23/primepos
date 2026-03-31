"use client"

import { Badge } from "@/components/ui/badge"
import { offlineConfig } from "@/lib/offline/config"
import { useOfflineStore } from "@/stores/offlineStore"

export function OfflineStatusPill() {
  const isOnline = useOfflineStore((state) => state.isOnline)
  const isSyncing = useOfflineStore((state) => state.isSyncing)
  const pendingCount = useOfflineStore((state) => state.pendingCount)
  const deadLetterCount = useOfflineStore((state) => state.deadLetterCount)
  const lastSyncError = useOfflineStore((state) => state.lastSyncError)

  if (!offlineConfig.enabled) return null

  if (deadLetterCount > 0) {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-900 border-red-300" title={lastSyncError || "Some offline events need manual review."}>
        Sync Error ({deadLetterCount})
      </Badge>
    )
  }

  if (!isOnline) {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-300">
        Offline {pendingCount > 0 ? `(${pendingCount})` : ""}
      </Badge>
    )
  }

  if (isSyncing) {
    return <Badge className="bg-sky-100 text-sky-900 border-sky-300">Syncing...</Badge>
  }

  return <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300">Online</Badge>
}
