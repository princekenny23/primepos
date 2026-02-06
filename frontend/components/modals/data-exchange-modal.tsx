"use client"

import { useState, useCallback } from "react"
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
import { Upload, Download, AlertCircle, CheckCircle2, XCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import * as XLSX from "xlsx"
import { DataExchangeConfig } from "@/lib/utils/data-exchange-config"

interface DataExchangeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: "import" | "export"
  config: DataExchangeConfig
  data?: any[]
  onSuccess?: (result: any) => void
  outlets?: Array<{ id: number | string; name: string }>
  categories?: Array<{ id: number | string; name: string }>
}

export function DataExchangeModal({
  open,
  onOpenChange,
  type,
  config,
  data = [],
  onSuccess,
  outlets = [],
  categories = [],
}: DataExchangeModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<"xlsx" | "csv">(config.defaultFormat)
  const [selectedFilters, setSelectedFilters] = useState<Record<string, any>>({})
  const [result, setResult] = useState<any>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const fileName = selectedFile.name.toLowerCase()
    if (!fileName.match(/\.(xlsx?|csv)$/)) {
      toast({
        title: "Invalid File Type",
        description: "Please select Excel (.xlsx) or CSV (.csv) file",
        variant: "destructive",
      })
      return
    }

    setFile(selectedFile)
    setResult(null)
  }

  const generateTemplate = useCallback(() => {
    const templateData = [config.fields.map(f => f.label)]

    const ws = XLSX.utils.aoa_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Template")

    // Format: set column widths
    ws["!cols"] = config.fields.map(() => ({ wch: 20 }))

    // Add data validations and freeze headers
    ws["!freeze"] = { xSplit: 0, ySplit: 1 }

    XLSX.writeFile(
      wb,
      `${config.entityType}-template-${new Date().toISOString().split("T")[0]}.xlsx`
    )

    toast({
      title: "Template Downloaded",
      description: `Excel template with ${config.fields.length} fields`,
    })
  }, [config, toast])

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "No File",
        description: "Please select a file to import",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      Object.entries(selectedFilters).forEach(([key, value]) => {
        if (value && value !== "all") {
          formData.append(key, String(value))
        }
      })

      // Get auth token from localStorage
      const token = typeof window !== "undefined" 
        ? localStorage.getItem("authToken") 
        : null
      
      // Get current outlet ID if available
      const outletId = typeof window !== "undefined"
        ? localStorage.getItem("currentOutletId")
        : null

      // Build headers
      const headers: Record<string, string> = {}
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }
      if (outletId) {
        headers["X-Outlet-ID"] = outletId
      }

      // Build full URL
      const baseURL = process.env.NEXT_PUBLIC_API_URL || "https://primepos-5mf6.onrender.com/api/v1"
      const importPath = config.apiEndpoints.import.startsWith("/api/v1") 
        ? config.apiEndpoints.import.replace("/api/v1", "")
        : config.apiEndpoints.import
      const importUrl = `${baseURL}${importPath}`

      console.log("Import URL debug:", {
        baseURL,
        configEndpoint: config.apiEndpoints.import,
        importPath,
        finalUrl: importUrl
      })

      const response = await fetch(importUrl, {
        method: "POST",
        body: formData,
        headers,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Import failed: ${response.status}`)
      }

      setResult(data)

      if (data.success || (data.imported && data.imported > 0)) {
        toast({
          title: "Import Successful",
          description: `${data.imported || 0} records imported${
            data.failed ? `, ${data.failed} failed` : ""
          }`,
        })
        onSuccess?.(data)
      } else {
        toast({
          title: "Import Completed",
          description: data.message || "Check file format and try again",
          variant: data.imported > 0 ? "default" : "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Import Error",
        description: error.message,
        variant: "destructive",
      })
      console.error("Import error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async () => {
    setIsLoading(true)

    try {
      // Get auth token from localStorage
      const token = typeof window !== "undefined" 
        ? localStorage.getItem("authToken") 
        : null
      
      // Get current outlet ID if available
      const outletId = typeof window !== "undefined"
        ? localStorage.getItem("currentOutletId")
        : null

      const params = new URLSearchParams({
        format,
      })

      Object.entries(selectedFilters).forEach(([key, value]) => {
        if (value && value !== "all") {
          params.append(key, String(value))
        }
      })

      // Build headers
      const headers: Record<string, string> = {}
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }
      if (outletId) {
        headers["X-Outlet-ID"] = outletId
      }

      // Build full URL
      const baseURL = process.env.NEXT_PUBLIC_API_URL || "https://primepos-5mf6.onrender.com/api/v1"
      const exportPath = config.apiEndpoints.export.startsWith("/api/v1") 
        ? config.apiEndpoints.export.replace("/api/v1", "")
        : config.apiEndpoints.export
      const exportUrl = `${baseURL}${exportPath}`

      console.log("Export URL debug:", {
        baseURL,
        configEndpoint: config.apiEndpoints.export,
        exportPath,
        finalUrl: `${exportUrl}?${params.toString()}`
      })

      const response = await fetch(`${exportUrl}?${params.toString()}`, {
        method: "GET",
        headers,
      })

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${config.entityType}-export-${new Date().toISOString().split("T")[0]}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Export Complete",
        description: "File downloaded successfully",
      })
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      })
      console.error("Export error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {type === "import" ? "Import" : "Export"} {config.entityType}
          </DialogTitle>
          <DialogDescription>
            {type === "import"
              ? "Upload a file to import records. Headers are required."
              : "Download your data in Excel or CSV format"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto flex-1 pr-3">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>File Format</Label>
            <Select value={format} onValueChange={(val: any) => setFormat(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">
                  Excel (.xlsx) - Recommended
                </SelectItem>
                <SelectItem value="csv">CSV (.csv) - Basic format</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filters Section */}
          {config.filters && Object.keys(config.filters).length > 0 && (
            <div className="border-t pt-2 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Filters</p>

              {config.filters.outlet && outlets.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Outlet</Label>
                  <Select
                    value={selectedFilters.outlet_id || "all"}
                    onValueChange={(val) =>
                      setSelectedFilters({ ...selectedFilters, outlet_id: val })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="All outlets" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Outlets</SelectItem>
                      {outlets.map((outlet) => (
                        <SelectItem
                          key={outlet.id}
                          value={String(outlet.id)}
                        >
                          {outlet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {config.filters.category && categories.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={selectedFilters.category_id || "all"}
                    onValueChange={(val) =>
                      setSelectedFilters({
                        ...selectedFilters,
                        category_id: val,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {config.filters.status && (
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={selectedFilters.status || "all"}
                    onValueChange={(val) =>
                      setSelectedFilters({ ...selectedFilters, status: val })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* File Upload (Import Only) */}
          {type === "import" && (
            <div className="border-t pt-2 space-y-1.5">
              <Label className="text-xs">File to Import</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer block">
                  <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {file ? file.name : "Click to select file"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Excel (.xlsx) or CSV
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Fields Info */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2 rounded text-xs space-y-1">
            <p className="font-medium text-blue-900 dark:text-blue-200">
              Fields ({config.requiredFields.length} required):
            </p>
            <div className="space-y-0.5 max-h-32 overflow-y-auto text-[11px]">
              {config.fields.map((f) => (
                <div key={f.name} className="flex items-start gap-1">
                  {f.required ? (
                    <span className="text-red-600 font-bold min-w-3">*</span>
                  ) : (
                    <span className="text-gray-400 min-w-3">•</span>
                  )}
                  <span className="flex-1">
                    <span className="font-medium">{f.label}</span>
                    {f.description && (
                      <span className="text-gray-500 text-[10px] block leading-tight">
                        {f.description}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              * = Required field
            </p>
          </div>

          {/* Results */}
          {result && (
            <div className="border-t pt-2 space-y-2">
              {result.imported > 0 || result.exported > 0 ? (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-2 rounded space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="text-xs font-medium text-green-900 dark:text-green-200">
                      {type === "import" ? "Import" : "Export"} Successful
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-muted-foreground">
                        {type === "import" ? "Imported:" : "Exported:"}
                      </span>
                      <span className="ml-1 font-medium text-green-600">
                        {result.imported || result.exported || 0}
                      </span>
                    </div>
                    {result.failed > 0 && (
                      <div>
                        <span className="text-muted-foreground">Failed:</span>
                        <span className="ml-1 font-medium text-red-600">
                          {result.failed}
                        </span>
                      </div>
                    )}
                    {result.skipped > 0 && (
                      <div>
                        <span className="text-muted-foreground">Skipped:</span>
                        <span className="ml-1 font-medium text-orange-600">
                          {result.skipped}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-2 rounded space-y-1">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <p className="text-xs font-medium text-red-900 dark:text-red-200">
                      {type === "import" ? "Import" : "Export"} Failed
                    </p>
                  </div>
                  {result.error && (
                    <p className="text-[11px] text-red-700 dark:text-red-300">
                      {result.error}
                    </p>
                  )}
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-red-600 mb-0.5">
                    Errors ({result.errors.length}):
                  </p>
                  <div className="max-h-16 overflow-y-auto space-y-0.5 text-[10px] text-muted-foreground bg-muted p-1.5 rounded">
                    {result.errors.slice(0, 3).map((err: any, idx: number) => (
                      <div key={idx}>
                        Row {err.row || "?"}: {err.error || err.message}
                      </div>
                    ))}
                    {result.errors.length > 3 && (
                      <div className="text-[10px]">
                        ... and {result.errors.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {result.warnings && result.warnings.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-yellow-600 mb-0.5">
                    Warnings ({result.warnings.length}):
                  </p>
                  <div className="max-h-16 overflow-y-auto space-y-0.5 text-[10px] text-muted-foreground bg-muted p-1.5 rounded">
                    {result.warnings.slice(0, 3).map((warn: any, idx: number) => (
                      <div key={idx}>{warn.warning || warn.message}</div>
                    ))}
                    {result.warnings.length > 3 && (
                      <div className="text-[10px]">
                        ... and {result.warnings.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info */}
          {!result && (
            <div className="flex items-start gap-2 bg-muted p-2 rounded text-[11px]">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground leading-tight">
                {type === "import"
                  ? "First row must contain headers. Empty cells skipped. Max 10,000 records."
                  : "File will include current filters. Download starts immediately."}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result ? "Close" : "Cancel"}
          </Button>

          <div className="flex gap-2">
            {type === "import" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateTemplate}
                  disabled={isLoading}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Template
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!file || isLoading}
                >
                  {isLoading ? "Importing..." : "Import"}
                </Button>
              </>
            )}

            {type === "export" && (
              <Button onClick={handleExport} disabled={isLoading}>
                {isLoading ? "Exporting..." : "Export"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
