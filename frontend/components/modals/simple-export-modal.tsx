"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Download, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { exportToXLSX, exportToCSV, ExportColumn } from "@/lib/services/exportService"

interface SimpleExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: any[]
  fileName: string
  sheetName?: string
  columns?: ExportColumn[]
  onSuccess?: () => void
}

export function SimpleExportModal({
  open,
  onOpenChange,
  data,
  fileName,
  sheetName = "Data",
  columns = [],
  onSuccess,
}: SimpleExportModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx")
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columns.length > 0 ? columns.map((c) => c.key) : []
  )
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // Filter to only selected columns
  const filteredColumns = columns.length > 0
    ? columns.filter((c) => selectedColumns.includes(c.key))
    : columns

  const handleToggleColumn = (key: string) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleExport = async () => {
    if (!data || data.length === 0) {
      toast({
        title: "No Data",
        description: "Nothing to export",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const exportConfig = {
        data,
        fileName,
        sheetName,
        columns: filteredColumns.length > 0 ? filteredColumns : columns,
        includeHeaders: true,
        freezeHeader: true,
      }

      if (format === "xlsx") {
        await exportToXLSX(exportConfig)
      } else {
        await exportToCSV(exportConfig)
      }

      setResult({
        success: true,
        message: `${data.length} records exported to ${format.toUpperCase()}`,
      })

      toast({
        title: "Export Successful",
        description: `Downloaded ${fileName}-${new Date().toISOString().split("T")[0]}.${format}`,
      })

      onSuccess?.()

      // Auto-close after 2 seconds
      setTimeout(() => {
        onOpenChange(false)
        setResult(null)
        setSelectedColumns(columns.length > 0 ? columns.map((c) => c.key) : [])
      }, 2000)
    } catch (error: any) {
      console.error("[Export] Error:", error)
      setResult({
        success: false,
        message: error.message || "Export failed",
      })
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export {sheetName}</DialogTitle>
          <DialogDescription>
            Export {data.length} records to Excel or CSV
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-4">
            {result.success ? (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <p className="font-medium text-green-900 dark:text-green-200">
                    Success!
                  </p>
                </div>
                <p className="text-sm text-green-800 dark:text-green-300">
                  {result.message}
                </p>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="font-medium text-red-900 dark:text-red-200">
                    Failed
                  </p>
                </div>
                <p className="text-sm text-red-800 dark:text-red-300">
                  {result.message}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label htmlFor="format" className="text-sm font-medium">
                File Format
              </Label>
              <Select value={format} onValueChange={(val: any) => setFormat(val)}>
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">
                    Excel (.xlsx) - Recommended
                  </SelectItem>
                  <SelectItem value="csv">
                    CSV (.csv) - Basic
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Column Selection */}
            {columns.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <Label className="text-sm font-medium">
                  Columns ({selectedColumns.length}/{columns.length})
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto bg-muted/30 p-3 rounded border">
                  {columns.map((col) => (
                    <div key={col.key} className="flex items-center gap-2">
                      <Checkbox
                        id={col.key}
                        checked={selectedColumns.includes(col.key)}
                        onCheckedChange={() => handleToggleColumn(col.key)}
                      />
                      <Label htmlFor={col.key} className="text-sm cursor-pointer flex-1">
                        {col.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info */}
            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/20 p-3 rounded text-xs border border-blue-200 dark:border-blue-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
              <p className="text-blue-800 dark:text-blue-300 leading-tight">
                File will be downloaded as{" "}
                <span className="font-medium">
                  {fileName}-{new Date().toISOString().split("T")[0]}.{format}
                </span>
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              setResult(null)
              setSelectedColumns(columns.length > 0 ? columns.map((c) => c.key) : [])
            }}
          >
            {result ? "Close" : "Cancel"}
          </Button>

          {!result && (
            <Button onClick={handleExport} disabled={isLoading || data.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              {isLoading ? "Exporting..." : "Export"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
