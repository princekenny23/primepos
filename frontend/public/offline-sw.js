const CACHE_VERSION = "primepos-offline-v1"
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
    requestUrl.pathname.includes("/api/v1/settings")
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

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  )
})
