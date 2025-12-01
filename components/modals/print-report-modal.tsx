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
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Printer } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface PrintReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportType: string
}

export function PrintReportModal({ open, onOpenChange, reportType }: PrintReportModalProps) {
  const { toast } = useToast()
  const [isPrinting, setIsPrinting] = useState(false)
  const [includeCharts, setIncludeCharts] = useState(true)
  const [includeTables, setIncludeTables] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)

  const handlePrint = async () => {
    setIsPrinting(true)

    // In production, this would trigger print dialog
    setTimeout(() => {
      setIsPrinting(false)
      toast({
        title: "Printing Report",
        description: `${reportType} is being sent to printer...`,
      })
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Print Report</DialogTitle>
          <DialogDescription>
            Configure print options for {reportType}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Report Type</p>
            <p className="font-medium">{reportType}</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Print Options</p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-summary"
                  checked={includeSummary}
                  onCheckedChange={(checked) => setIncludeSummary(checked as boolean)}
                />
                <Label htmlFor="include-summary" className="cursor-pointer">
                  Include Summary
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-charts"
                  checked={includeCharts}
                  onCheckedChange={(checked) => setIncludeCharts(checked as boolean)}
                />
                <Label htmlFor="include-charts" className="cursor-pointer">
                  Include Charts
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-tables"
                  checked={includeTables}
                  onCheckedChange={(checked) => setIncludeTables(checked as boolean)}
                />
                <Label htmlFor="include-tables" className="cursor-pointer">
                  Include Data Tables
                </Label>
              </div>
            </div>
          </div>

          <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Make sure your printer is ready. The report will be printed with your current filter settings.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrint} disabled={isPrinting}>
            {isPrinting ? (
              "Printing..."
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                Print Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

