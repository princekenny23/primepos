"use client"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface PrintReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportType?: string
}

export function PrintReportModal({ open, onOpenChange, reportType }: PrintReportModalProps) {
  const handlePrint = () => {
    // Use browser print for now; replace with PDF generation if needed
    if (typeof window !== "undefined") {
      window.print()
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Print {reportType || "Report"}</DialogTitle>
          <DialogDescription>
            Use your browser print dialog to print or save the current report as PDF.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrint}>
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
