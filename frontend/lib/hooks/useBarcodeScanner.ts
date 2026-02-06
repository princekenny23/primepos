import { useEffect, useRef, useState } from 'react'

export type BarcodeScannerOptions = {
  minLength?: number
  suffixKey?: string // e.g., 'Enter'
  scanTimeout?: number // ms between keystrokes to consider same scan
  onScan?: (code: string) => void
  enabled?: boolean
}

/**
 * Lightweight keyboard-wedge barcode scanner handler.
 * - Buffers fast keystrokes and emits a scan when suffixKey is detected or
 *   a timeout elapses after a burst of keystrokes.
 * - Also dispatches a global `barcode-scanned` CustomEvent on window so other
 *   components (modals) can listen without passing callbacks.
 */
export function useBarcodeScanner(options: BarcodeScannerOptions = {}) {
  // Merge defaults <- localStorage <- explicit options so the Settings UI takes effect
  let stored: any = {}
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('scanner_settings_v1')
      if (raw) stored = JSON.parse(raw)
    } catch (e) {
      stored = {}
    }
  }

  const merged = {
    minLength: 3,
    suffixKey: 'Enter',
    scanTimeout: 60,
    enabled: true,
    ...stored,
    ...options,
  }

  const [config, setConfig] = useState(() => ({
    minLength: merged.minLength,
    suffixKey: merged.suffixKey,
    scanTimeout: merged.scanTimeout,
    enabled: merged.enabled,
  }))

  // Update config dynamically when settings change via a CustomEvent
  useEffect(() => {
    const handler = (e: any) => {
      const payload = e?.detail || {}
      setConfig(prev => ({ ...prev, ...payload }))
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('scanner-settings-changed', handler)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('scanner-settings-changed', handler)
      }
    }
  }, [])

  const { minLength, suffixKey, scanTimeout, enabled } = config
  const onScan = options.onScan
  const bufferRef = useRef<string>('')
  const lastTimeRef = useRef<number>(0)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return

    const handleKey = (e: KeyboardEvent) => {
      const now = Date.now()
      // Reset buffer if gap between keys is too large
      if (lastTimeRef.current && now - lastTimeRef.current > scanTimeout) {
        bufferRef.current = ''
      }

      lastTimeRef.current = now

      // Ignore modifier keys; guard against undefined/non-string keys
      if (typeof e.key !== 'string') return
      const key = e.key === 'NumpadEnter' ? 'Enter' : e.key
      if (key.length > 1 && key !== suffixKey) return

      // Append character (avoid interfering with typing into inputs)
      const active = document.activeElement
      const isInputFocused = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)

      // If an input is focused and it's not the global capture scenario, we still allow scans
      // because barcode scanners typically direct their input to currently focused element.
      // But for global handler, still capture even if input is focused.

      // Append key
      if (key === suffixKey) {
        // Suffix received - finalize buffer
        const code = bufferRef.current.trim()
        bufferRef.current = ''
        if (code.length >= minLength) {
          // Dispatch global event
          dispatchScan(code)
          if (onScan) onScan(code)
        }
        return
      }

      // Append regular character
      bufferRef.current += key

      // Clear previous timeout
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      // Set timeout to finalize scan if no more keys in scanTimeout ms
      timeoutRef.current = window.setTimeout(() => {
        const code = bufferRef.current.trim()
        bufferRef.current = ''
        if (code.length >= minLength) {
          dispatchScan(code)
          if (onScan) onScan(code)
        }
      }, scanTimeout)
    }

    const dispatchScan = (code: string) => {
      try {
        const ev = new CustomEvent('barcode-scanned', { detail: code })
        window.dispatchEvent(ev)
      } catch (err) {
        // Some browsers may not support CustomEvent constructor in older contexts
        try {
          const ev = document.createEvent('CustomEvent')
          ;(ev as any).initCustomEvent('barcode-scanned', true, true, code)
          window.dispatchEvent(ev)
        } catch (e) {
          // give up silently
        }
      }
    }

    window.addEventListener('keydown', handleKey)

    return () => {
      window.removeEventListener('keydown', handleKey)
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [minLength, suffixKey, scanTimeout, onScan, enabled])
}



