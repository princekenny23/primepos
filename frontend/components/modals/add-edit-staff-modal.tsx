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
import { User, Shield, MapPin } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { staffService, roleService, type Staff, type Role } from "@/lib/services/staffService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { api } from "@/lib/api"

interface AddEditStaffModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff?: Staff | null
  onSuccess?: () => void
  assignedStaffMembers?: Staff[]
}

export function AddEditStaffModal({ open, onOpenChange, staff, onSuccess, assignedStaffMembers = [] }: AddEditStaffModalProps) {
  const { toast } = useToast()
  const { currentBusiness } = useBusinessStore()
  const { outlets } = useTenant()
  const [isLoading, setIsLoading] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [formData, setFormData] = useState({
    user_ids: [] as string[],
    role_id: "",
    outlet_ids: [] as string[],
  })

  const loadRoles = useCallback(async () => {
    if (!currentBusiness) return
    try {
      const response = await roleService.list({ tenant: currentBusiness.id, is_active: true })
      setRoles(response.results || [])
    } catch (error) {
      console.error("Failed to load roles:", error)
    }
  }, [currentBusiness])

  const loadAvailableUsers = useCallback(async () => {
    if (!currentBusiness) {
      setAvailableUsers([])
      return
    }

    try {
      const tenantResponse = await api.get<any>(`/tenants/${currentBusiness.id}/`)
      const tenantUsers = tenantResponse?.users || []
      
      // Get IDs of already-assigned staff to filter them out
      const assignedUserIds = new Set(assignedStaffMembers.map((s) => String(s.user?.id)))
      
      const users = tenantUsers
        .filter((tenantUser: any) => !assignedUserIds.has(String(tenantUser.id)))
        .map((tenantUser: any) => ({
          id: String(tenantUser.id),
          name: tenantUser.name || tenantUser.username || tenantUser.email?.split("@")[0] || "Unnamed User",
          email: tenantUser.email || "",
        }))
      setAvailableUsers(users)
    } catch (error) {
      console.error("Failed to load available users:", error)
      setAvailableUsers([])
    }
  }, [currentBusiness, assignedStaffMembers])

  useEffect(() => {
    if (open) {
      loadRoles()
      loadAvailableUsers()

      if (staff) {
        const outletIds =
          staff.outlets?.map((outlet: any) => (typeof outlet === "object" ? String(outlet.id) : String(outlet))) || []

        setFormData({
          user_ids: staff.user?.id ? [String(staff.user.id)] : [],
          role_id: staff.role?.id ? String(staff.role.id) : "",
          outlet_ids: outletIds,
        })
      } else {
        setFormData({
          user_ids: [],
          role_id: "",
          outlet_ids: [],
        })
      }
    }
  }, [open, staff, loadRoles, loadAvailableUsers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentBusiness) {
      toast({
        title: "Error",
        description: "No business selected.",
        variant: "destructive",
      })
      return
    }

    if (!staff && formData.user_ids.length === 0) {
      toast({
        title: "Validation Error",
        description: "Select at least one existing user to assign.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const roleId = formData.role_id && formData.role_id.trim() ? parseInt(formData.role_id, 10) : null
      const normalizedOutletIds = formData.outlet_ids
        .filter((id) => id && id !== "")
        .map((id) => parseInt(String(id), 10))
        .filter((id) => !isNaN(id))

      const outletRoles = normalizedOutletIds.map((outletId) => ({
        outlet_id: outletId,
        role_id: roleId,
      }))

      if (staff) {
        const updateData: any = {
          role_id: roleId,
          outlet_roles: outletRoles,
        }

        await staffService.update(staff.id, updateData)
        toast({
          title: "Staff Updated",
          description: "Staff member has been updated successfully.",
        })
      } else {
        const selectedUserIds = Array.from(
          new Set(
            formData.user_ids
              .map((id) => parseInt(String(id), 10))
              .filter((id) => !isNaN(id))
          )
        )

        await Promise.all(
          selectedUserIds.map((userId) => {
            const payload: any = { user_id: userId }
            if (roleId !== null) payload.role_id = roleId
            if (outletRoles.length > 0) payload.outlet_roles = outletRoles
            return staffService.create(payload)
          })
        )

        toast({
          title: "Staff Assigned",
          description: `${selectedUserIds.length} user${selectedUserIds.length !== 1 ? "s" : ""} assigned successfully.`,
        })
      }

      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error("Failed to save staff:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save staff assignment.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOutletToggle = (outletId: string) => {
    setFormData((prev) => ({
      ...prev,
      outlet_ids: prev.outlet_ids.includes(outletId)
        ? prev.outlet_ids.filter((id) => id !== outletId)
        : [...prev.outlet_ids, outletId],
    }))
  }

  const handleUserToggle = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      user_ids: prev.user_ids.includes(userId)
        ? prev.user_ids.filter((id) => id !== userId)
        : [...prev.user_ids, userId],
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{staff ? "Edit Staff Assignment" : "Assign Staff"}</DialogTitle>
          <DialogDescription>
            {staff
              ? "Update role and outlet assignments for this staff member"
              : "Assign existing office users to staff in bulk with role and outlet access"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            {!staff && (
              <div className="space-y-2 md:col-span-2">
                <Label>Select Users *</Label>
                <div className="border rounded-md p-4 max-h-[10.5rem] overflow-y-auto">
                  {availableUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No users available for this business.</p>
                  ) : (
                    <div className="space-y-2">
                      {availableUsers.map((availableUser) => (
                        <div key={availableUser.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            aria-label={`Assign user ${availableUser.name}`}
                            checked={formData.user_ids.includes(String(availableUser.id))}
                            onChange={() => handleUserToggle(String(availableUser.id))}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>{availableUser.name}</span>
                            <span className="text-xs text-muted-foreground">({availableUser.email})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {formData.user_ids.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formData.user_ids.length} user{formData.user_ids.length !== 1 ? "s" : ""} selected
                  </p>
                )}
              </div>
            )}

            {staff && (
              <div className="space-y-2 md:col-span-2 rounded border p-3 bg-muted/40">
                <p className="text-sm font-medium">Assigned User</p>
                <p className="text-sm text-muted-foreground">
                  {staff.user?.name || "Unknown User"}
                  {staff.user?.email ? ` (${staff.user.email})` : ""}
                </p>
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="role_id">Role Assignment</Label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Select
                  value={formData.role_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, role_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="pl-10">
                    <SelectValue placeholder="Select role for this assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No role assigned</SelectItem>
                    {roles.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No roles available. Create roles first.</div>
                    ) : (
                      roles.map((role) => (
                        <SelectItem key={role.id} value={String(role.id)}>
                          {role.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Outlet Assignment</Label>
              <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
                {outlets.filter((outlet) => outlet.isActive).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active outlets available</p>
                ) : (
                  <div className="space-y-2">
                    {outlets
                      .filter((outlet) => outlet.isActive)
                      .map((outlet) => (
                        <div key={outlet.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            aria-label={`Assign to outlet ${outlet.name}`}
                            checked={formData.outlet_ids.includes(String(outlet.id))}
                            onChange={() => handleOutletToggle(String(outlet.id))}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span>{outlet.name}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              {formData.outlet_ids.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formData.outlet_ids.length} outlet{formData.outlet_ids.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (staff ? "Updating..." : "Assigning...") : staff ? "Update Assignment" : "Assign Selected Users"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
