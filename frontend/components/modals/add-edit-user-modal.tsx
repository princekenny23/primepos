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
import { User, Mail, Phone, Eye, EyeOff } from "lucide-react"
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
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  })

  useEffect(() => {
    if (open) {
      if (user) {
        const userName = (user.name || "").trim()
        const nameParts = userName.split(/\s+/).filter(Boolean)
        const firstName = nameParts[0] || ""
        const lastName = nameParts.slice(1).join(" ")

        // Edit mode
        setFormData({
          firstName,
          lastName,
          email: user.email || "",
          phone: "",
          password: "",
          confirmPassword: "",
        })
      } else {
        // Add mode
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
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
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      toast({
        title: "Validation Error",
        description: "First name, last name, and email are required.",
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

    if (!user && formData.password.length < 8) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      })
      return
    }

    const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim()

    setIsLoading(true)

    try {
      if (user) {
        // Update user
        await userService.update(user.id, {
          name: fullName,
          phone: formData.phone || undefined,
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
          email: formData.email.trim(),
          name: fullName,
          phone: formData.phone || undefined,
          tenant: currentBusiness.id,
          outlet: currentOutlet?.id,
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
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
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
            {user ? "Edit User" : "Create User"}
          </DialogTitle>
          <DialogDescription>
            {user ? "Update user information" : "Create a new office user account"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="firstName"
                  className="pl-10"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lastName"
                  className="pl-10"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
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
            {!user && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("settings.users.password_placeholder")}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!user}
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder={t("settings.users.confirm_password_placeholder")}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required={!user}
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
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

