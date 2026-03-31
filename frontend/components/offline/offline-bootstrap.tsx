"use client"

import { useEffect } from "react"
import { useOfflineStore } from "@/stores/offlineStore"
import { offlineConfig } from "@/lib/offline/config"
import { registerOfflineServiceWorker } from "@/lib/offline/sw-register"
import { getOutboxCounts } from "@/lib/offline/outbox-db"
import { flushPendingOutbox, pullChanges } from "@/lib/offline/outbox-service"

export function OfflineBootstrap() {
  const setOnline = useOfflineStore((state) => state.setOnline)
  const setPendingCount = useOfflineStore((state) => state.setPendingCount)
  const setDeadLetterCount = useOfflineStore((state) => state.setDeadLetterCount)

  useEffect(() => {
    if (!offlineConfig.enabled || typeof window === "undefined") return

    setOnline(window.navigator.onLine)

    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)

    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    registerOfflineServiceWorker().catch(() => {
      // no-op: registration errors are handled internally
    })

    getOutboxCounts()
      .then((counts) => {
        setPendingCount(counts.pending)
        setDeadLetterCount(counts.deadLetter)
      })
      .catch(() => {
        setPendingCount(0)
        setDeadLetterCount(0)
      })

    const runSync = async () => {
      if (!offlineConfig.isPhaseAtLeast(2) || !window.navigator.onLine) return
      try {
        await flushPendingOutbox(50)
        const cursorKey = "offline-sync-cursor"
        const cursor = localStorage.getItem(cursorKey) || undefined
        const pullResponse = await pullChanges(cursor)
        const nextCursor = pullResponse?.cursor_out
        if (nextCursor !== undefined && nextCursor !== null) {
          localStorage.setItem(cursorKey, String(nextCursor))
        }
      } catch {
        // Store state is already updated by outbox service; ignore loop errors.
      }
    }

    runSync().catch(() => {
      // ignore initial sync loop error
    })
    const syncTimer = window.setInterval(() => {
      runSync().catch(() => {
        // ignore periodic sync loop error
      })
    }, 15000)

    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      window.clearInterval(syncTimer)
    }
  }, [setDeadLetterCount, setOnline, setPendingCount])

  return null
}
