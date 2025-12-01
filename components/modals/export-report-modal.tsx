"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, FileText, FileSpreadsheet } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface ExportReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportType: string
}

export function ExportReportModal({ open, onOpenChange, reportType }: ExportReportModalProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv">("pdf")

  const handleExport = async () => {
    setIsExporting(true)

    // In production, this would generate and download the file
    setTimeout(() => {
      setIsExporting(false)
      toast({
        title: "Export Started",
        description: `${reportType} is being exported as ${exportFormat.toUpperCase()}.`,
      })
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Report</DialogTitle>
          <DialogDescription>
            Export {reportType} in your preferred format
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Report Type</p>
            <p className="font-medium">{reportType}</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Export Format</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportFormat("pdf")}
                className={`p-4 border-2 rounded-lg text-left transition-colors ${
                  exportFormat === "pdf"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <FileText className="h-6 w-6 mb-2" />
                <p className="font-medium">PDF</p>
                <p className="text-xs text-muted-foreground">Portable Document Format</p>
              </button>
              <button
                type="button"
                onClick={() => setExportFormat("csv")}
                className={`p-4 border-2 rounded-lg text-left transition-colors ${
                  exportFormat === "csv"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <FileSpreadsheet className="h-6 w-6 mb-2" />
                <p className="font-medium">CSV</p>
                <p className="text-xs text-muted-foreground">Comma Separated Values</p>
              </button>
            </div>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              The report will be generated with your current filter settings and downloaded automatically.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              "Exporting..."
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export {exportFormat.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

