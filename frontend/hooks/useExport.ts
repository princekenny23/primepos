import { useState, useCallback } from "react"
import { ExportColumn } from "@/lib/services/exportService"

export interface UseExportOptions {
  fileName: string
  sheetName?: string
  columns?: ExportColumn[]
}

export function useExport(options: UseExportOptions) {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<any[]>([])

  const openExport = useCallback(
    (dataToExport: any[]) => {
      setData(dataToExport)
      setIsOpen(true)
    },
    []
  )

  const closeExport = useCallback(() => {
    setIsOpen(false)
    setData([])
  }, [])

  return {
    isOpen,
    data,
    openExport,
    closeExport,
    ...options,
  }
}
