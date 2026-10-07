import { requestCache } from "@/lib/utils/request-cache"

export const APP_REFRESH_EVENT = "primepos:refresh"

export function requestAppRefresh(): void {
  if (typeof window === "undefined") return
  requestCache.clear()
  window.dispatchEvent(new CustomEvent(APP_REFRESH_EVENT))
}