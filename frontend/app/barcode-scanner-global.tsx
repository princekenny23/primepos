"use client"

import { useBarcodeScanner } from "@/lib/hooks/useBarcodeScanner"

export function BarcodeScannerGlobal() {
  useBarcodeScanner()
  return null
}