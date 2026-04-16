"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Building2, Users, DollarSign, Calendar, Mail, Phone, Copy, Check } from "lucide-react"
import { useState } from "react"

interface ViewTenantDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant?: any
}

export function ViewTenantDetailsModal({ open, onOpenChange, tenant }: ViewTenantDetailsModalProps) {
  const [copied, setCopied] = useState(false)
  if (!tenant) return null

  const tenantLoginUrl = (() => {
    if (tenant.domain && String(tenant.domain).trim()) {
      return `https://${String(tenant.domain).trim().toLowerCase()}`
    }
    const baseDomain = process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN?.trim().toLowerCase()
    if (tenant.subdomain && baseDomain) {
      return `https://${String(tenant.subdomain).trim().toLowerCase()}.${baseDomain}`
    }
    return "Not configured"
  })()

  const handleCopy = async () => {
    if (tenantLoginUrl === "Not configured") return
    try {
      await navigator.clipboard.writeText(tenantLoginUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.error("Failed to copy tenant URL:", error)
    }
  }

  // Transform tenant data with safe defaults
  const tenantDetails = {
    ...tenant,
    phone: tenant.phone || "N/A",
    address: tenant.address || "N/A",
    taxId: tenant.tax_id || "N/A",
    registrationDate: tenant.created_at || tenant.createdAt || tenant.joined || "",
    subscriptionEnd: tenant.subscription_end || null,
    plan: tenant.plan || "N/A",
    status: tenant.is_active ? "Active" : "Suspended",
    revenue: tenant.revenue || 0,
    outlets: tenant.outlets || [],
    users: tenant.users || [],
  }

  const registrationDateObj = tenantDetails.registrationDate ? new Date(tenantDetails.registrationDate) : null
  const registrationDateLabel = registrationDateObj && !Number.isNaN(registrationDateObj.getTime())
    ? registrationDateObj.toLocaleDateString()
    : "N/A"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Tenant Details - {tenant.name}
          </DialogTitle>
          <DialogDescription>
            Complete information about this tenant
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Basic Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Business Name</p>
                <p className="font-medium">{tenantDetails.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  {tenantDetails.email}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  {tenantDetails.phone}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{tenantDetails.address}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Tax ID</p>
                <p className="font-medium">{tenantDetails.taxId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={tenantDetails.status === "Active" ? "default" : "destructive"}>
                  {tenantDetails.status}
                </Badge>
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className="text-sm text-muted-foreground">Login URL</p>
                {tenantLoginUrl === "Not configured" ? (
                  <p className="font-medium text-muted-foreground">Not configured</p>
                ) : (
                  <div className="flex items-start gap-2">
                    <a
                      href={tenantLoginUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary underline underline-offset-2 break-all"
                    >
                      {tenantLoginUrl}
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={handleCopy}
                      title={copied ? "Copied" : "Copy URL"}
                    >
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Subscription Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Subscription</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Plan</p>
                <Badge variant="outline">{tenantDetails.plan}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Registration Date</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {registrationDateLabel}
                </p>
              </div>
              {tenantDetails.subscriptionEnd && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Subscription End</p>
                  <p className="font-medium">
                    {new Date(tenantDetails.subscriptionEnd).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="font-medium flex items-center gap-2">
                  <DollarSign className="h-3 w-3" />
                  MWK {(tenantDetails.revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Outlets */}
          {tenantDetails.outlets && tenantDetails.outlets.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Outlets</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantDetails.outlets.map((outlet: any) => (
                    <TableRow key={outlet.id}>
                      <TableCell className="font-medium">{outlet.name}</TableCell>
                      <TableCell>{outlet.location || outlet.address || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={outlet.status === "Active" || outlet.is_active ? "default" : "secondary"}>
                          {outlet.status || (outlet.is_active ? "Active" : "Inactive")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Users */}
          {tenantDetails.users && tenantDetails.users.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Users</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantDetails.users.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {(!tenantDetails.outlets || tenantDetails.outlets.length === 0) && 
           (!tenantDetails.users || tenantDetails.users.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No additional details available</p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

