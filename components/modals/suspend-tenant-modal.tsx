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
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface SuspendTenantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant?: any
}

export function SuspendTenantModal({ open, onOpenChange, tenant }: SuspendTenantModalProps) {
  const { toast } = useToast()
  const [isSuspending, setIsSuspending] = useState(false)
  const [reason, setReason] = useState("")

  if (!tenant) return null

  const handleSuspend = async () => {
    if (!reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for suspending this tenant.",
        variant: "destructive",
      })
      return
    }

    setIsSuspending(true)

    // In production, this would call API
    setTimeout(() => {
      setIsSuspending(false)
      toast({
        title: "Tenant Suspended",
        description: `${tenant.name} has been suspended successfully.`,
        variant: "destructive",
      })
      setReason("")
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Suspend Tenant
          </DialogTitle>
          <DialogDescription>
            Suspend {tenant.name} - This will prevent access to their account
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>Warning:</strong> Suspending this tenant will immediately revoke their access to the platform.
              All active sessions will be terminated.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Suspension *</Label>
            <Textarea
              id="reason"
              placeholder="Enter the reason for suspending this tenant..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              This reason will be logged and may be shared with the tenant.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSuspend}
            disabled={isSuspending || !reason.trim()}
          >
            {isSuspending ? "Suspending..." : "Suspend Tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

