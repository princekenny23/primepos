/**
 * Simple request cache to prevent duplicate API calls
 * Caches GET requests for a short period
 */

interface CacheEntry {
  data: any
  timestamp: number
  promise?: Promise<any>
}

class RequestCache {
  private cache = new Map<string, CacheEntry>()
  private readonly TTL = 5000 // 5 seconds cache TTL

  getKey(url: string, params?: Record<string, any>): string {
    const paramStr = params ? JSON.stringify(params) : ''
    return `${url}${paramStr}`
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const age = Date.now() - entry.timestamp
    if (age > this.TTL) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    })
  }

  getOrSet(key: string, fetcher: () => Promise<any>): Promise<any> {
    const cached = this.get(key)
    if (cached !== null) {
      return Promise.resolve(cached)
    }

    const entry = this.cache.get(key)
    if (entry?.promise) {
      return entry.promise
    }

    const promise = fetcher().then((data) => {
      this.set(key, data)
      const currentEntry = this.cache.get(key)
      if (currentEntry) {
        currentEntry.promise = undefined
      }
      return data
    })

    this.cache.set(key, {
      data: null,
      timestamp: Date.now(),
      promise,
    })

    return promise
  }

  clear(): void {
    this.cache.clear()
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.clear()
      return
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }
}

export const requestCache = new RequestCache()

// Helper to invalidate cache on data mutations
export const invalidateCache = (pattern: string) => {
  requestCache.invalidate(pattern)
}

// Invalidate dashboard cache when sales/expenses/etc change
if (typeof window !== 'undefined') {
  window.addEventListener('sale-completed', () => {
    requestCache.invalidate('stats-')
    requestCache.invalidate('sales-')
    requestCache.invalidate('activity-')
    requestCache.invalidate('top-selling-')
    requestCache.invalidate('pnl-')
    requestCache.invalidate('customer-summary-')
  })

  window.addEventListener('expense-updated', () => {
    requestCache.invalidate('stats-')
    requestCache.invalidate('sales-')
    requestCache.invalidate('activity-')
    requestCache.invalidate('top-selling-')
    requestCache.invalidate('pnl-')
    requestCache.invalidate('customer-summary-')
  })
  
  window.addEventListener('outlet-changed', () => {
    requestCache.clear()
  })
}

