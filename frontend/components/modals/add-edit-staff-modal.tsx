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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { User, Mail, Phone, Shield, MapPin } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { staffService, roleService, type Staff, type Role } from "@/lib/services/staffService"
import { outletService } from "@/lib/services/outletService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { api } from "@/lib/api"

interface AddEditStaffModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff?: Staff | null
  onSuccess?: () => void
}

export function AddEditStaffModal({ open, onOpenChange, staff, onSuccess }: AddEditStaffModalProps) {
  const { toast } = useToast()
  const { currentBusiness } = useBusinessStore()
  const { outlets } = useTenant()
  const [isLoading, setIsLoading] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [formData, setFormData] = useState({
    user_id: "",
    useExistingUser: false,
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
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
      const users = tenantUsers.map((user: any) => ({
        id: String(user.id),
        name: user.name || user.username || user.email?.split("@")[0] || "Unnamed User",
        email: user.email || "",
      }))
      setAvailableUsers(users)
    } catch (error) {
      console.error("Failed to load available users:", error)
      setAvailableUsers([])
    }
  }, [currentBusiness])

  useEffect(() => {
    if (open) {
      loadRoles()
      loadAvailableUsers()
      if (staff) {
        // Edit mode - extract outlet IDs from outlets array
        const outletIds = staff.outlets?.map((o: any) => {
          // Handle both object format {id, name} and string format
          return typeof o === 'object' ? String(o.id) : String(o)
        }) || []
        
        setFormData({
          user_id: "",
          useExistingUser: false,
          name: staff.user?.name || "",
          email: staff.user?.email || "",
          phone: staff.user?.phone || "",
          password: "",
          confirmPassword: "",
          role_id: staff.role?.id ? String(staff.role.id) : "",
          outlet_ids: outletIds,
        })
      } else {
        // Add mode
        setFormData({
          user_id: "",
          useExistingUser: false,
          name: "",
          email: "",
          phone: "",
          password: "",
          confirmPassword: "",
          role_id: "",
          outlet_ids: [],
        })
      }
    }
  }, [open, staff, currentBusiness, loadRoles, loadAvailableUsers])

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

    // Validation
    if (!formData.name) {
      toast({
        title: "Validation Error",
        description: "Name is required.",
        variant: "destructive",
      })
      return
    }

    if (!staff && !formData.useExistingUser && !formData.email) {
      toast({
        title: "Validation Error",
        description: "Email is required.",
        variant: "destructive",
      })
      return
    }

    if (!staff && !formData.useExistingUser && !formData.password) {
      toast({
        title: "Validation Error",
        description: "Password is required.",
        variant: "destructive",
      })
      return
    }

    if (!staff && !formData.useExistingUser && formData.password !== formData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match.",
        variant: "destructive",
      })
      return
    }

    if (!staff && !formData.useExistingUser && formData.password.length < 8) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      })
      return
    }

    if (!staff && formData.useExistingUser && !formData.user_id) {
      toast({
        title: "Validation Error",
        description: "Please select an existing office user.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      if (staff) {
        // Update existing staff
        const updateData: any = {}
        
        // Only include outlet_ids if there are outlets selected
        if (formData.outlet_ids.length > 0) {
          updateData.outlet_ids = formData.outlet_ids.map(id => parseInt(id))
        } else {
          // If no outlets selected, send empty array to clear outlets
          updateData.outlet_ids = []
        }
        
        // Only include role if one is selected
        if (formData.role_id && formData.role_id.trim()) {
          updateData.role = parseInt(formData.role_id)
        } else {
          // Clear role if none selected
          updateData.role = null
        }
        
        await staffService.update(staff.id, updateData)
        toast({
          title: "Staff Updated",
          description: "Staff member has been updated successfully.",
        })
      } else {
        // Create new staff
        const staffData: any = {}

        if (formData.useExistingUser && formData.user_id) {
          staffData.user_id = parseInt(formData.user_id)
        } else {
          staffData.name = formData.name.trim()
          staffData.email = formData.email.trim()
          staffData.password = formData.password
        }
        
        // Only include phone if provided
        if (!formData.useExistingUser && formData.phone && formData.phone.trim()) {
          staffData.phone = formData.phone.trim()
        }
        
        // Only include outlet_ids if there are outlets selected
        if (formData.outlet_ids && formData.outlet_ids.length > 0) {
          staffData.outlet_ids = formData.outlet_ids
            .filter(id => id && id !== '')
            .map(id => parseInt(String(id)))
            .filter(id => !isNaN(id))
        }
        
        // Only include role if one is selected (not empty string)
        if (formData.role_id && formData.role_id.trim() && formData.role_id !== "none") {
          const roleId = parseInt(formData.role_id)
          if (!isNaN(roleId)) {
            staffData.role = roleId
          }
        }
        
        console.log("Sending staff data:", staffData)
        await staffService.create(staffData)
        toast({
          title: "Staff Created",
          description: "Staff member has been created successfully.",
        })
      }

      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error("Failed to save staff:", error)
      console.error("Error details:", {
        message: error.message,
        status: error.status,
        data: error.data,
        staffData: staff ? "update" : formData
      })
      
      // Extract detailed error message
      let errorMessage = error.message || "Failed to save staff member."
      if (error.data) {
        if (typeof error.data === 'string') {
          errorMessage = error.data
        } else if (error.data.detail) {
          errorMessage = error.data.detail
        } else if (error.data.email) {
          // Handle email error (can be string or array)
          const emailError = error.data.email
          if (Array.isArray(emailError)) {
            errorMessage = emailError[0]
          } else if (typeof emailError === 'string') {
            errorMessage = emailError
          } else if (emailError && typeof emailError === 'object' && 'string' in emailError) {
            // Handle ErrorDetail object format
            errorMessage = emailError.string || emailError
          }
        } else if (error.data.password) {
          errorMessage = Array.isArray(error.data.password) ? error.data.password[0] : error.data.password
        } else if (error.data.non_field_errors) {
          errorMessage = Array.isArray(error.data.non_field_errors) ? error.data.non_field_errors[0] : error.data.non_field_errors
        } else {
          // Try to get first error message from any field
          const firstKey = Object.keys(error.data)[0]
          if (firstKey) {
            const firstError = error.data[firstKey]
            if (Array.isArray(firstError)) {
              errorMessage = firstError[0]
            } else if (typeof firstError === 'string') {
              errorMessage = firstError
            } else if (firstError && typeof firstError === 'object' && 'string' in firstError) {
              // Handle ErrorDetail object format
              errorMessage = firstError.string || String(firstError)
            }
          }
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOutletToggle = (outletId: string) => {
    setFormData(prev => ({
      ...prev,
      outlet_ids: prev.outlet_ids.includes(outletId)
        ? prev.outlet_ids.filter(id => id !== outletId)
        : [...prev.outlet_ids, outletId]
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{staff ? "Edit Staff Member" : "Add New Staff Member"}</DialogTitle>
          <DialogDescription>
            {staff ? "Update staff member information" : "Create a new staff member account"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            {!staff && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="user_source">User Source *</Label>
                <Select
                  value={formData.useExistingUser ? "existing" : "new"}
                  onValueChange={(value) => {
                    const useExisting = value === "existing"
                    setFormData((prev) => ({
                      ...prev,
                      useExistingUser: useExisting,
                      user_id: useExisting ? prev.user_id : "",
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Create New User</SelectItem>
                    <SelectItem value="existing">Select Existing Office User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!staff && formData.useExistingUser && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="user_id">Select User *</Label>
                <Select
                  value={formData.user_id || "none"}
                  onValueChange={(value) => {
                    const selected = value === "none" ? "" : value
                    const selectedUser = availableUsers.find((u) => String(u.id) === selected)
                    setFormData((prev) => ({
                      ...prev,
                      user_id: selected,
                      name: selectedUser?.name || "",
                      email: selectedUser?.email || "",
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an existing office user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a user</SelectItem>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  className="pl-10"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="John Doe"
                  disabled={!!staff || (!!formData.useExistingUser && !staff)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required={!staff}
                  disabled={!!staff || (!!formData.useExistingUser && !staff)}
                  placeholder="john.doe@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  className="pl-10"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+265 991 234 567"
                  disabled={!!staff || (!!formData.useExistingUser && !staff)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role_id">Role</Label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Select
                  value={formData.role_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, role_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="pl-10">
                    <SelectValue placeholder="Select role (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No role assigned</SelectItem>
                    {roles.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No roles available. Create roles first.
                      </div>
                    ) : (
                      roles.map(role => (
                        <SelectItem key={role.id} value={String(role.id)}>
                          {role.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!staff && !formData.useExistingUser && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    placeholder="Minimum 8 characters"
                    minLength={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    placeholder="Confirm password"
                    minLength={8}
                  />
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>Outlets (Optional)</Label>
              <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
                {outlets.filter(o => o.isActive).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active outlets available</p>
                ) : (
                  <div className="space-y-2">
                    {outlets.filter(o => o.isActive).map(outlet => (
                      <div key={outlet.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`outlet-${outlet.id}`}
                          aria-label={`Assign to outlet ${outlet.name}`}
                          checked={formData.outlet_ids.includes(String(outlet.id))}
                          onChange={() => handleOutletToggle(String(outlet.id))}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label
                          htmlFor={`outlet-${outlet.id}`}
                          className="flex items-center gap-2 cursor-pointer flex-1"
                        >
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>{outlet.name}</span>
                        </Label>
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
              {isLoading ? (staff ? "Updating..." : "Creating...") : (staff ? "Update Staff" : "Create Staff")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
