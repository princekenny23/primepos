import { useEffect, useRef } from "react"

export type BarcodeScannerOptions = {
  minLength?: number
  suffixKey?: string
  scanTimeout?: number
  maxScanDuration?: number
  onScan?: (code: string) => void
  enabled?: boolean
}

export function useBarcodeScanner(options: BarcodeScannerOptions = {}) {
  const {
    minLength = 3,
    suffixKey = "Enter",
    scanTimeout = 300,
    maxScanDuration = 1200,
    onScan,
    enabled = true,
  } = options

  const bufferRef = useRef("")
  const lastTimeRef = useRef(0)
  const startTimeRef = useRef(0)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return

    const resetBuffer = () => {
      bufferRef.current = ""
      startTimeRef.current = 0
    }

    const finalizeScan = (code: string) => {
      const trimmed = code.trim()
      if (trimmed.length < minLength) return
      console.error("Barcode scan detected:", trimmed)
      onScan?.(trimmed)
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return

      const now = Date.now()
      const lastTime = lastTimeRef.current
      const startTime = startTimeRef.current

      if (lastTime && now - lastTime > scanTimeout) {
        resetBuffer()
      }

      if (startTime && now - startTime > maxScanDuration) {
        resetBuffer()
      }

      lastTimeRef.current = now

      if (typeof e.key !== "string") return
      const key = e.key === "NumpadEnter" ? "Enter" : e.key
      if (key.length > 1 && key !== suffixKey) return

      if (key === suffixKey) {
        const code = bufferRef.current
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        resetBuffer()
        finalizeScan(code)
        return
      }

      if (!startTimeRef.current) {
        startTimeRef.current = now
      }
      bufferRef.current += key

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      timeoutRef.current = window.setTimeout(() => {
        const code = bufferRef.current
        resetBuffer()
        finalizeScan(code)
      }, scanTimeout)
    }

    window.addEventListener("keydown", handleKey, true)

    return () => {
      window.removeEventListener("keydown", handleKey, true)
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [enabled, maxScanDuration, minLength, onScan, scanTimeout, suffixKey])
}



