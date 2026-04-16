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
import { Input } from "@/components/ui/input"
import { Trash2, AlertTriangle } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { adminService, type AdminTenant } from "@/lib/services/adminService"

interface DeleteTenantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant: AdminTenant | null
  onDelete?: () => void
}

export function DeleteTenantModal({ open, onOpenChange, tenant, onDelete }: DeleteTenantModalProps) {
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  if (!tenant) return null

  const tenantName = tenant.name
  const isConfirmed = confirmText === tenantName

  const handleDelete = async () => {
    if (!isConfirmed) {
      toast({
        title: "Confirmation Required",
        description: `Please type "${tenantName}" to confirm deletion.`,
        variant: "destructive",
      })
      return
    }

    setIsDeleting(true)

    try {
      await adminService.deleteTenant(tenant.id)
      
      // Close modal and clear state first
      setConfirmText("")
      onOpenChange(false)
      
      // Then trigger callback to refresh list
      if (onDelete) {
        await onDelete()
      }
      
      toast({
        title: "Tenant Deleted",
        description: `${tenantName} has been permanently deleted.`,
        variant: "destructive",
      })
    } catch (error: any) {
      const blockedModels = Array.isArray(error?.data?.blocked_by_models)
        ? error.data.blocked_by_models.join(", ")
        : ""
      const isProtectedDelete = error?.status === 409

      toast({
        title: isProtectedDelete ? "Tenant Has Linked Records" : "Error",
        description: isProtectedDelete
          ? `${error?.message || "Tenant cannot be deleted."}${blockedModels ? ` Blocked by: ${blockedModels}.` : ""} You can suspend this tenant instead.`
          : (error.message || "Failed to delete tenant"),
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Tenant
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. If this tenant has linked records, deletion will be blocked.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>Warning:</strong> Deleting this tenant will permanently remove:
            </p>
            <ul className="text-sm text-red-800 dark:text-red-200 mt-2 ml-4 list-disc">
              <li>All tenant data and settings</li>
              <li>All associated outlets</li>
              <li>All user accounts</li>
              <li>All sales and transaction history</li>
              <li>All products and inventory data</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">
              Type <strong>{tenantName}</strong> to confirm deletion
            </Label>
            <Input
              id="confirm"
              placeholder={tenantName}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setConfirmText("")
            onOpenChange(false)
          }}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || !isConfirmed}
          >
            {isDeleting ? "Deleting..." : "Delete Tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

