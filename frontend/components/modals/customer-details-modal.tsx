"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { customerService, type Customer } from "@/lib/services/customerService"
import { useBusinessStore } from "@/stores/businessStore"
import { Award, Calendar, Mail, MapPin, Phone, Store, Wallet } from "lucide-react"

interface CustomerDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
}

export function CustomerDetailsModal({ open, onOpenChange, customer }: CustomerDetailsModalProps) {
  const { currentBusiness, outlets } = useBusinessStore()
  const [customerDetails, setCustomerDetails] = useState<Customer | null>(customer)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open || !customer?.id) {
      if (!open) {
        setCustomerDetails(customer)
      }
      return
    }

    let isMounted = true

    const loadCustomerDetails = async () => {
      setIsLoading(true)
      try {
        const response = await customerService.get(customer.id)
        if (isMounted) {
          setCustomerDetails(response)
        }
      } catch (error) {
        console.error("Failed to load customer details:", error)
        if (isMounted) {
          setCustomerDetails(customer)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadCustomerDetails()

    return () => {
      isMounted = false
    }
  }, [open, customer])

  const details = customerDetails || customer

  const outletName = useMemo(() => {
    if (!details) return "N/A"
    const outletId = String(details.outlet_id || details.outlet || "")
    if (!outletId) return "N/A"
    return outlets.find((outlet) => outlet.id === outletId)?.name || outletId
  }, [details, outlets])

  if (!details) return null

  const currencySymbol = currentBusiness?.currencySymbol || "MWK"
  const loyaltyPoints = details.loyalty_points || details.points || 0
  const totalSpent = Number(details.total_spent || 0)
  const creditLimit = Number(details.credit_limit || 0)
  const outstandingBalance = Number(details.outstanding_balance || 0)
  const availableCredit = Number(details.available_credit || 0)
  const memberSince = details.created_at ? new Date(details.created_at).toLocaleDateString() : "N/A"
  const lastVisit = details.last_visit ? new Date(details.last_visit).toLocaleDateString() : "Never"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{details.name}</DialogTitle>
          <DialogDescription>Full customer details</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Full Name</p>
                <p className="font-medium">{details.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {details.email || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="flex items-center gap-2 font-medium">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {details.phone || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Address</p>
                <p className="flex items-start gap-2 font-medium">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span>{details.address || "N/A"}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Membership & Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Primary Outlet</p>
                <p className="flex items-center gap-2 font-medium">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  {outletName}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Member Since</p>
                <p className="flex items-center gap-2 font-medium">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {memberSince}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Visit</p>
                <p className="flex items-center gap-2 font-medium">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {lastVisit}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Loyalty Points</p>
                <p className="flex items-center gap-2 font-medium">
                  <Award className="h-4 w-4 text-yellow-500" />
                  {loyaltyPoints.toLocaleString("en-US")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Lifetime Value</p>
                <p className="font-semibold">
                  {currencySymbol} {totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Credit Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Credit Access</p>
                <div className="mt-1">
                  {details.credit_enabled ? (
                    <Badge variant={details.credit_status === "active" ? "default" : "secondary"}>
                      {details.credit_status || "active"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Disabled</Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Credit Limit</p>
                <p className="font-medium">
                  {currencySymbol} {creditLimit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Outstanding Balance</p>
                <p className="font-medium text-orange-600">
                  {currencySymbol} {outstandingBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Available Credit</p>
                <p className="font-medium">
                  {currencySymbol} {availableCredit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Payment Terms</p>
                <p className="font-medium">{details.payment_terms_days || 0} days</p>
              </div>
              <div>
                <p className="text-muted-foreground">Notes</p>
                <p className="flex items-start gap-2 font-medium">
                  <Wallet className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span>{details.credit_notes || "No credit notes"}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <div className="mr-auto text-sm text-muted-foreground">
            {isLoading ? "Refreshing customer details..." : "Latest saved customer details"}
          </div>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}