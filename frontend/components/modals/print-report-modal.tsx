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
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Print {reportType || "Report"}</DialogTitle>
          <DialogDescription>
            Printing is handled by the local print agent when supported.
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
