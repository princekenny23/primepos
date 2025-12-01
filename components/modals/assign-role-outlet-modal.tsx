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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Shield, MapPin } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface AssignRoleOutletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: any
}

export function AssignRoleOutletModal({ open, onOpenChange, staff }: AssignRoleOutletModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>(staff?.role || "")
  const [selectedOutlet, setSelectedOutlet] = useState<string>(staff?.outlet || "")

  if (!staff) return null

  const handleAssign = async () => {
    if (!selectedRole || !selectedOutlet) {
      toast({
        title: "Selection Required",
        description: "Please select both a role and an outlet.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    // In production, this would call API
    setTimeout(() => {
      setIsLoading(false)
      toast({
        title: "Assignment Updated",
        description: "Role and outlet have been assigned successfully.",
      })
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Assign Role & Outlet
          </DialogTitle>
          <DialogDescription>
            Assign role and outlet for {staff.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Current Assignment</p>
            <p className="font-medium">{staff.name}</p>
            <p className="text-sm text-muted-foreground">
              Role: {staff.role} • Outlet: {staff.outlet}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole} required>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Manager">Manager</SelectItem>
                <SelectItem value="Supervisor">Supervisor</SelectItem>
                <SelectItem value="Cashier">Cashier</SelectItem>
                <SelectItem value="Staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="outlet">Outlet *</Label>
            <Select value={selectedOutlet} onValueChange={setSelectedOutlet} required>
              <SelectTrigger id="outlet">
                <SelectValue placeholder="Select outlet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Outlets">All Outlets</SelectItem>
                <SelectItem value="Downtown Branch">Downtown Branch</SelectItem>
                <SelectItem value="Mall Location">Mall Location</SelectItem>
                <SelectItem value="Airport Kiosk">Airport Kiosk</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Changing the role will update the staff member's permissions. Changing the outlet will limit their access to that specific location.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isLoading || !selectedRole || !selectedOutlet}>
            {isLoading ? "Assigning..." : "Assign Role & Outlet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

