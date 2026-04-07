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
import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { staffService, roleService, type Staff, type Role } from "@/lib/services/staffService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"

interface AssignRoleOutletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff?: Staff | null
  onSuccess?: () => void
}

type StaffOutletValue = { id?: string | number } | string | number

export function AssignRoleOutletModal({ open, onOpenChange, staff, onSuccess }: AssignRoleOutletModalProps) {
  const { toast } = useToast()
  const { currentBusiness } = useBusinessStore()
  const { outlets } = useTenant()
  const [isLoading, setIsLoading] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [fallbackRoleId, setFallbackRoleId] = useState<string>("")
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([])
  const [outletRoleMap, setOutletRoleMap] = useState<Record<string, string>>({})

  const loadRoles = useCallback(async () => {
    if (!currentBusiness) return
    try {
      const response = await roleService.list({ tenant: currentBusiness.id, is_active: true })
      setRoles(response.results || [])
    } catch (error) {
      console.error("Failed to load roles:", error)
    }
  }, [currentBusiness])

  useEffect(() => {
    if (open && staff) {
      loadRoles()
      setFallbackRoleId(staff.role?.id ? String(staff.role.id) : "")
      // Extract outlet IDs from outlets array
      const outletIds = staff.outlets?.map((o: StaffOutletValue) => {
        // Handle both object format {id, name} and string format
        return typeof o === "object" && o !== null ? String(o.id) : String(o)
      }) || []
      setSelectedOutletIds(outletIds)

      const nextMap: Record<string, string> = {}
      const assignments = staff.outlet_role_assignments || []
      for (const assignment of assignments) {
        if (assignment.role_id !== null && assignment.role_id !== undefined) {
          nextMap[String(assignment.outlet_id)] = String(assignment.role_id)
        }
      }
      setOutletRoleMap(nextMap)
    }
  }, [open, staff, currentBusiness, loadRoles])

  if (!staff) return null

  const handleOutletToggle = (outletId: string) => {
    setSelectedOutletIds((prev) =>
      prev.includes(outletId)
        ? prev.filter((id) => id !== outletId)
        : [...prev, outletId]
    )
  }

  const handleOutletRoleChange = (outletId: string, roleId: string) => {
    setOutletRoleMap((prev) => ({
      ...prev,
      [outletId]: roleId === "none" ? "" : roleId,
    }))
  }

  const handleAssign = async () => {
    setIsLoading(true)

    try {
      const updateData: any = {
        outlet_roles: selectedOutletIds.map((id) => ({
          outlet_id: parseInt(id),
          role_id: outletRoleMap[id]
            ? parseInt(outletRoleMap[id])
            : (fallbackRoleId ? parseInt(fallbackRoleId) : null),
        })),
      }
      if (fallbackRoleId) {
        updateData.role_id = parseInt(fallbackRoleId)
      } else {
        updateData.role_id = null
      }

      await staffService.update(staff.id, updateData)
      toast({
        title: "Assignment Updated",
        description: "Role and outlets have been assigned successfully.",
      })
      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error("Failed to update assignment:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update role and outlet assignment.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Assign Role & Outlets
          </DialogTitle>
          <DialogDescription>
            Assign role and outlets for {staff.user?.name || "this staff member"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Current Assignment</p>
            <p className="font-medium">{staff.user?.name || "N/A"}</p>
            <p className="text-sm text-muted-foreground">
              Role: {staff.role?.name || "No role"} • Outlets: {staff.outlets?.length || 0}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Default Role (Fallback)</Label>
            <Select 
              value={fallbackRoleId || "none"} 
              onValueChange={(value) => setFallbackRoleId(value === "none" ? "" : value)}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select default role (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No role assigned</SelectItem>
                {roles.map(role => (
                  <SelectItem key={role.id} value={String(role.id)}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Outlets (Optional)</Label>
            <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
              {outlets.filter((outlet) => outlet.isActive).length === 0 ? (
                <p className="text-sm text-muted-foreground">No active outlets available</p>
              ) : (
                <div className="space-y-2">
                  {outlets.filter((outlet) => outlet.isActive).map((outlet) => (
                    <div key={outlet.id} className="space-y-2 rounded-md border p-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`outlet-${outlet.id}`}
                          checked={selectedOutletIds.includes(String(outlet.id))}
                          onChange={() => handleOutletToggle(String(outlet.id))}
                          className="h-4 w-4 rounded border-gray-300"
                          aria-label={`Select ${outlet.name} outlet`}
                        />
                        <Label
                          htmlFor={`outlet-${outlet.id}`}
                          className="flex items-center gap-2 cursor-pointer flex-1"
                        >
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>{outlet.name}</span>
                        </Label>
                      </div>
                      {selectedOutletIds.includes(String(outlet.id)) && (
                        <div className="pl-6">
                          <Label htmlFor={`outlet-role-${outlet.id}`} className="text-xs text-muted-foreground">Role For This Outlet</Label>
                          <Select
                            value={outletRoleMap[String(outlet.id)] || (fallbackRoleId || "none")}
                            onValueChange={(value) => handleOutletRoleChange(String(outlet.id), value)}
                          >
                            <SelectTrigger id={`outlet-role-${outlet.id}`} className="mt-1">
                              <SelectValue placeholder="Use default role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Use no role</SelectItem>
                              {roles.map((role) => (
                                <SelectItem key={`outlet-${outlet.id}-role-${role.id}`} value={String(role.id)}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedOutletIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedOutletIds.length} outlet{selectedOutletIds.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Changing the role will update the staff member&apos;s permissions. Changing the outlets will limit their access to those specific locations.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isLoading}>
            {isLoading ? "Updating..." : "Update Assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
