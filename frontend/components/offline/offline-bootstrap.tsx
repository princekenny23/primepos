"use client"

import { useEffect } from "react"
import { useOfflineStore } from "@/stores/offlineStore"
import { offlineConfig } from "@/lib/offline/config"
import { registerOfflineServiceWorker } from "@/lib/offline/sw-register"
import { getOutboxCounts } from "@/lib/offline/outbox-db"
import { flushPendingOutbox, pullChanges } from "@/lib/offline/outbox-service"

// Derive the health probe URL from the API base (strips the path to get origin + /health/)
const PROBE_URL = (() => {
  const base = process.env.NEXT_PUBLIC_API_URL || "https://primepos-5mf6.onrender.com/api/v1"
  try {
    return new URL("/health/", base).href
  } catch {
    return "/health/"
  }
})()

/** Returns true if the backend health endpoint is reachable within 5 seconds. */
async function probeConnectivity(): Promise<boolean> {
  if (!window.navigator.onLine) return false
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(PROBE_URL, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timer)
  }
}

export function OfflineBootstrap() {
  const setOnline = useOfflineStore((state) => state.setOnline)
  const setPendingCount = useOfflineStore((state) => state.setPendingCount)
  const setDeadLetterCount = useOfflineStore((state) => state.setDeadLetterCount)

  useEffect(() => {
    if (typeof window === "undefined") return

    // Probe real connectivity on mount instead of trusting navigator.onLine
    probeConnectivity().then(setOnline)

    const onOnline = () => {
      // Browser says we're back — re-verify with a real probe
      probeConnectivity().then(setOnline)
    }
    const onOffline = () => setOnline(false)

    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    if (!offlineConfig.enabled) {
      // Also probe periodically when offline mode is disabled
      const simplePoll = window.setInterval(() => {
        probeConnectivity().then(setOnline)
      }, 15000)
      return () => {
        window.removeEventListener("online", onOnline)
        window.removeEventListener("offline", onOffline)
        window.clearInterval(simplePoll)
      }
    }

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

    // Periodic real-connectivity probe (every 15 s) — browser events alone are unreliable
    const probeTimer = window.setInterval(() => {
      probeConnectivity().then(setOnline)
    }, 15000)

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
      window.clearInterval(probeTimer)
      window.clearInterval(syncTimer)
    }
  }, [setDeadLetterCount, setOnline, setPendingCount])

  return null
}
