import { offlineConfig } from "@/lib/offline/config"

export async function registerOfflineServiceWorker(): Promise<void> {
  if (!offlineConfig.isPhaseAtLeast(1)) return
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

  try {
    await navigator.serviceWorker.register("/offline-sw.js", { scope: "/" })
  } catch (error) {
    console.warn("Offline service worker registration failed:", error)
  }
}
