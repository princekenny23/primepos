const CACHE_VERSION = "primepos-offline-v2"
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`
const READ_CACHE = `${CACHE_VERSION}-read`
const APP_SHELL_ASSETS = ["/", "/icon.jpg"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_ASSETS)).catch(() => undefined)
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("primepos-offline-") && !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

function isReadApiRequest(requestUrl) {
  return (
    requestUrl.pathname.includes("/api/v1/products") ||
    requestUrl.pathname.includes("/api/v1/customers") ||
    requestUrl.pathname.includes("/api/v1/settings") ||
    requestUrl.pathname.includes("/api/v1/shifts") ||
    requestUrl.pathname.includes("/api/v1/devices") ||
    requestUrl.pathname.includes("/api/v1/notifications")
  )
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)

  if (isReadApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone()
          caches.open(READ_CACHE).then((cache) => cache.put(request, cloned)).catch(() => undefined)
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          return cached || new Response(JSON.stringify({ detail: "Offline and no cached data" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
        })
    )
    return
  }

  // For same-origin assets (JS/CSS/HTML): cache-first, then network, then offline fallback
  const isSameOrigin = url.origin === self.location.origin
  if (isSameOrigin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request)
          .then((response) => {
            const cloned = response.clone()
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, cloned)).catch(() => undefined)
            return response
          })
          .catch(() =>
            new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
          )
      })
    )
    return
  }

  // Cross-origin requests we don't explicitly handle: try network, return offline response on failure
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).catch(() =>
        new Response(JSON.stringify({ detail: "Offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    })
  )
})
