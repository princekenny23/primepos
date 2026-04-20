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
import { Badge } from "@/components/ui/badge"
import { User, Mail, Phone, Shield, Building2, Calendar } from "lucide-react"
import type { User as UserType } from "@/lib/types"

interface ViewUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserType | null
}

export function ViewUserModal({ open, onOpenChange, user }: ViewUserModalProps) {
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Details
          </DialogTitle>
          <DialogDescription>
            Complete information about this user account
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Full Name
              </p>
              <p className="font-medium">{user.name || "N/A"}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </p>
              <p className="font-medium">{user.email || "N/A"}</p>
            </div>

            {user.phone && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone
                </p>
                <p className="font-medium">{user.phone}</p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Role
              </p>
              <div className="flex flex-col gap-1">
                <Badge variant="outline" className="mt-1 w-fit">
                  {user.staff_role?.name || user.effective_role || user.role || "staff"}
                </Badge>
                {user.staff_role?.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {user.staff_role.description}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Business
              </p>
              <p className="font-medium">{user.businessId ? "Assigned" : "Unassigned"}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created
              </p>
              <p className="font-medium">
                {user.createdAt 
                  ? new Date(user.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : "N/A"}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Status</p>
            <div className="flex items-center gap-2">
              <Badge 
                variant={user.is_saas_admin ? "default" : "secondary"}
                className={
                  user.is_saas_admin 
                    ? "bg-purple-100 text-purple-800" 
                    : "bg-green-100 text-green-800"
                }
              >
                {user.is_saas_admin ? "SaaS Admin" : "Active"}
              </Badge>
              {Boolean(user.permissions?.can_settings) && (
                <Badge variant="outline">Administrator</Badge>
              )}
            </div>
          </div>

          {/* Permissions */}
          {user.permissions && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-3">Permissions</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(user.permissions).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-sm capitalize">
                      {key.replace('can_', '').replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Info */}
          {user.tenant && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Business Information</p>
              <p className="font-medium">
                {typeof user.tenant === 'object' ? user.tenant.name : "N/A"}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

