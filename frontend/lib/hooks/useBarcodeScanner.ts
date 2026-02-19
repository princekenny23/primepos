import { useEffect, useRef } from "react"

export type BarcodeScannerOptions = {
  onScan?: (code: string) => void
  enabled?: boolean
  minLength?: number
  timeout?: number
  scanTimeout?: number
  suffixKeys?: string[]
  suffixKey?: string
  maxScanDuration?: number
}

type ScannerConfig = {
  enabled: boolean
  minLength: number
  timeout: number
  suffixKeys: Set<string>
}

const DEFAULT_SUFFIX_KEYS = ["Enter", "Tab"]
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Fn"])

function normalizeKey(key: string): string {
  if (key === "NumpadEnter") return "Enter"
  return key
}

function resolveTimeout(options: BarcodeScannerOptions): number {
  const timeout = options.timeout ?? options.scanTimeout ?? 600
  if (!Number.isFinite(timeout)) return 600
  return Math.max(200, Math.min(5000, timeout))
}

function resolveSuffixKeys(options: BarcodeScannerOptions): Set<string> {
  const suffix = new Set<string>()

  for (const key of DEFAULT_SUFFIX_KEYS) {
    suffix.add(normalizeKey(key))
  }

  if (Array.isArray(options.suffixKeys)) {
    for (const key of options.suffixKeys) {
      if (typeof key === "string" && key.trim()) {
        suffix.add(normalizeKey(key.trim()))
      }
    }
  }

  if (typeof options.suffixKey === "string" && options.suffixKey.trim()) {
    suffix.add(normalizeKey(options.suffixKey.trim()))
  }

  return suffix
}

function toConfig(options: BarcodeScannerOptions): ScannerConfig {
  return {
    enabled: options.enabled ?? true,
    minLength: Math.max(1, options.minLength ?? 4),
    timeout: resolveTimeout(options),
    suffixKeys: resolveSuffixKeys(options),
  }
}

export function useBarcodeScanner(options: BarcodeScannerOptions = {}) {
  const onScanRef = useRef<BarcodeScannerOptions["onScan"]>(options.onScan)
  const configRef = useRef<ScannerConfig>(toConfig(options))

  const bufferRef = useRef("")
  const lastKeyTimeRef = useRef(0)
  const resetTimerRef = useRef<number | null>(null)

  useEffect(() => {
    onScanRef.current = options.onScan
  }, [options.onScan])

  useEffect(() => {
    configRef.current = toConfig(options)
  }, [
    options.enabled,
    options.minLength,
    options.timeout,
    options.scanTimeout,
    options.suffixKey,
    options.suffixKeys,
  ])

  useEffect(() => {
    if (typeof window === "undefined") return

    const clearResetTimer = () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
    }

    const resetBuffer = () => {
      bufferRef.current = ""
      lastKeyTimeRef.current = 0
      clearResetTimer()
    }

    const scheduleReset = (timeout: number) => {
      clearResetTimer()
      resetTimerRef.current = window.setTimeout(() => {
        resetBuffer()
      }, timeout)
    }

    const emitScan = (code: string) => {
      const { minLength } = configRef.current
      const trimmed = code.trim()
      if (trimmed.length < minLength) return
      onScanRef.current?.(trimmed)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const config = configRef.current
      if (!config.enabled) return
      if (event.isComposing) return
      if (event.ctrlKey || event.altKey || event.metaKey) return

      const now = Date.now()
      if (
        bufferRef.current.length > 0 &&
        lastKeyTimeRef.current > 0 &&
        now - lastKeyTimeRef.current > config.timeout
      ) {
        resetBuffer()
      }

      const key = normalizeKey(event.key || "")
      if (!key) return
      if (MODIFIER_KEYS.has(key)) return

      if (config.suffixKeys.has(key)) {
        const code = bufferRef.current
        resetBuffer()
        emitScan(code)
        return
      }

      if (key === "Escape") {
        resetBuffer()
        return
      }

      if (key === "Backspace") {
        if (bufferRef.current.length > 0) {
          bufferRef.current = bufferRef.current.slice(0, -1)
          lastKeyTimeRef.current = now
          scheduleReset(config.timeout)
        }
        return
      }

      if (key.length !== 1) return

      bufferRef.current += key
      lastKeyTimeRef.current = now
      scheduleReset(config.timeout)
    }

    window.addEventListener("keydown", handleKeyDown, true)

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true)
      clearResetTimer()
      bufferRef.current = ""
      lastKeyTimeRef.current = 0
    }
  }, [])
}



