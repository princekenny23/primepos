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
import { User, UserPlus, Search, Mail, Phone } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { customerService, type Customer } from "@/lib/services/customerService"
import { useBusinessStore } from "@/stores/businessStore"
import { AddEditCustomerModal } from "./add-edit-customer-modal"
import { cn } from "@/lib/utils"
import { useI18n } from "@/contexts/i18n-context"

interface CustomerSelectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (customer: Customer) => void
  selectedCustomer?: Customer | null
}

export function CustomerSelectModal({ 
  open, 
  onOpenChange, 
  onSelect,
  selectedCustomer 
}: CustomerSelectModalProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  const { currentBusiness } = useBusinessStore()
  const [searchTerm, setSearchTerm] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [useReal] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('useRealAPI') === 'true'
    }
    return false
  })

  const loadCustomers = useCallback(async () => {
    if (!currentBusiness || !open) return
    
    setIsLoading(true)
    try {
      const response = await customerService.list({
        search: searchTerm || undefined,
        is_active: true,
      })
      setCustomers(Array.isArray(response) ? response : response.results || [])
    } catch (error) {
      console.error("Failed to load customers:", error)
      setCustomers([])
      toast({
        title: "Error",
        description: "Failed to load customers. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, searchTerm, open, toast])

  useEffect(() => {
    if (open) {
      loadCustomers()
    } else {
      setSearchTerm("")
      setCustomers([])
    }
  }, [open, loadCustomers])

  // Debounce search
  useEffect(() => {
    if (!open) return
    
    const timer = setTimeout(() => {
      loadCustomers()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, open, loadCustomers])

  const handleSelectCustomer = (customer: Customer) => {
    onSelect(customer)
    onOpenChange(false)
  }

  const handleCreateSuccess = () => {
    setShowAddCustomer(false)
    loadCustomers()
  }

  const filteredCustomers = customers.filter(customer =>
    !searchTerm || 
    customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm)
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("customers.select_customer")}
            </DialogTitle>
            <DialogDescription>
              {t("customers.search_or_create")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("customers.search_placeholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddCustomer(true)}
              className="whitespace-nowrap"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {t("customers.new_customer")}
            </Button>
          </div>

          <div className="flex-1 min-h-0 mt-4 overflow-y-auto pr-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">{t("common.messages.loading")}</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <User className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  {searchTerm ? t("customers.no_customers_found") : t("customers.no_customers_yet")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {searchTerm 
                    ? t("customers.try_different_search")
                    : t("customers.create_first_customer")
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2 pr-2">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => handleSelectCustomer(customer)}
                    className={cn(
                      "w-full text-left p-4 rounded-lg border transition-colors",
                      "hover:bg-accent hover:border-accent-foreground/20",
                      selectedCustomer?.id === customer.id
                        ? "bg-accent border-accent-foreground/20"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{customer.name}</p>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                          {customer.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </span>
                          )}
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </span>
                          )}
                        </div>
                        {customer.loyalty_points !== undefined && customer.loyalty_points > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {customer.loyalty_points} {t("customers.loyalty_points")}
                          </p>
                        )}
                      </div>
                      {selectedCustomer?.id === customer.id && (
                        <div className="ml-4 flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.actions.cancel")}
            </Button>
            {selectedCustomer && (
              <Button 
                type="button" 
                onClick={() => {
                  onSelect(selectedCustomer)
                  onOpenChange(false)
                }}
              >
                {t("customers.select_customer")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddEditCustomerModal
        open={showAddCustomer}
        onOpenChange={setShowAddCustomer}
        onSuccess={handleCreateSuccess}
      />
    </>
  )
}

