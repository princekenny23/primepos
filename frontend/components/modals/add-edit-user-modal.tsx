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
import { User, Mail, Phone, Shield } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { userService } from "@/lib/services/userService"
import { useBusinessStore } from "@/stores/businessStore"
import type { User as UserType } from "@/lib/types"
import { useI18n } from "@/contexts/i18n-context"

interface AddEditUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: UserType | null
  onSuccess?: () => void
}

export function AddEditUserModal({ open, onOpenChange, user, onSuccess }: AddEditUserModalProps) {
  const { toast } = useToast()
  const { currentBusiness } = useBusinessStore()
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "staff" as "admin" | "manager" | "cashier" | "staff",
    password: "",
    confirmPassword: "",
  })

  useEffect(() => {
    if (open) {
      if (user) {
        // Edit mode
        setFormData({
          name: user.name || "",
          email: user.email || "",
          phone: "",
          role: (user.role as any) || "staff",
          password: "",
          confirmPassword: "",
        })
      } else {
        // Add mode
        setFormData({
          name: "",
          email: "",
          phone: "",
          role: "staff",
          password: "",
          confirmPassword: "",
        })
      }
    }
  }, [open, user])

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
    if (!formData.name || !formData.email) {
      toast({
        title: "Validation Error",
        description: "Name and email are required.",
        variant: "destructive",
      })
      return
    }

    if (!user && !formData.password) {
      toast({
        title: "Validation Error",
        description: "Password is required for new users.",
        variant: "destructive",
      })
      return
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      if (user) {
        // Update user
        await userService.update(user.id, {
          name: formData.name,
          phone: formData.phone || undefined,
          role: formData.role,
          password: formData.password || undefined,
        })

        toast({
          title: "User Updated",
          description: "User has been updated successfully.",
        })

        onOpenChange(false)
        if (onSuccess) {
          onSuccess()
        }
      } else {
        // Create new user
        const response = await userService.create({
          email: formData.email,
          name: formData.name,
          phone: formData.phone || undefined,
          role: formData.role,
          tenant: currentBusiness.id,
          password: formData.password || undefined,
        })

        if (response.temporary_password) {
          toast({
            title: "User Created",
            description: `User created successfully. Temporary password: ${response.temporary_password}`,
          })
        } else {
          toast({
            title: "User Created",
            description: "User has been created successfully.",
          })
        }

        // Reset form
        setFormData({
          name: "",
          email: "",
          phone: "",
          role: "staff",
          password: "",
          confirmPassword: "",
        })

        onOpenChange(false)
        if (onSuccess) {
          onSuccess()
        }
      }
    } catch (error: any) {
      console.error("Failed to save user:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save user. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {user ? "Edit User" : "Add User"}
          </DialogTitle>
          <DialogDescription>
            {user ? "Update user information" : "Create a new user account"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  className="pl-10"
                  placeholder={t("settings.users.name_placeholder")}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
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
                  placeholder={t("settings.users.email_placeholder")}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!user}
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
                  placeholder={t("settings.users.phone_placeholder")}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Select
                  value={formData.role}
                  onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                  required
                >
                  <SelectTrigger className="pl-10">
                    <SelectValue placeholder={t("settings.users.role_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!user && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t("settings.users.password_placeholder")}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!user}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={t("settings.users.confirm_password_placeholder")}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required={!user}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : user ? "Update User" : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

