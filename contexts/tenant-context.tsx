"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface Tenant {
  id: string
  name: string
  businessType: string
  email: string
  phone: string
  address: string
}

interface Outlet {
  id: string
  tenantId: string
  name: string
  address: string
  phone: string
  email: string
  isActive: boolean
  settings?: {
    printerSetup?: string
    posMode?: string
    receiptTemplate?: string
  }
}

interface TenantContextType {
  currentTenant: Tenant | null
  currentOutlet: Outlet | null
  outlets: Outlet[]
  setCurrentTenant: (tenant: Tenant | null) => void
  setCurrentOutlet: (outlet: Outlet | null) => void
  setOutlets: (outlets: Outlet[]) => void
  switchOutlet: (outletId: string) => void
  isLoading: boolean
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

// Mock data - will be replaced with API calls
const mockTenant: Tenant = {
  id: "tenant-1",
  name: "Prime Retail Store",
  businessType: "Retail",
  email: "contact@primeretail.com",
  phone: "+1 (555) 123-4567",
  address: "123 Business St, City, State 12345",
}

const mockOutlets: Outlet[] = [
  {
    id: "outlet-1",
    tenantId: "tenant-1",
    name: "Downtown Branch",
    address: "123 Main St, Downtown",
    phone: "+1 (555) 111-1111",
    email: "downtown@primeretail.com",
    isActive: true,
    settings: {
      printerSetup: "Thermal Printer",
      posMode: "Standard",
      receiptTemplate: "Default",
    },
  },
  {
    id: "outlet-2",
    tenantId: "tenant-1",
    name: "Mall Location",
    address: "456 Mall Ave, Shopping District",
    phone: "+1 (555) 222-2222",
    email: "mall@primeretail.com",
    isActive: true,
    settings: {
      printerSetup: "Thermal Printer",
      posMode: "Express",
      receiptTemplate: "Compact",
    },
  },
  {
    id: "outlet-3",
    tenantId: "tenant-1",
    name: "Airport Kiosk",
    address: "789 Airport Blvd, Terminal 2",
    phone: "+1 (555) 333-3333",
    email: "airport@primeretail.com",
    isActive: true,
    settings: {
      printerSetup: "Mobile Printer",
      posMode: "Quick",
      receiptTemplate: "Minimal",
    },
  },
]

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null)
  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(null)
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Initialize tenant and outlets on mount
  useEffect(() => {
    // Simulate API call to fetch tenant data
    const initializeTenant = async () => {
      setIsLoading(true)
      // In production, this would be an API call
      // const tenant = await fetchTenant()
      // const outlets = await fetchOutlets(tenant.id)
      
      setCurrentTenant(mockTenant)
      setOutlets(mockOutlets)
      
      // Set first active outlet as default
      const defaultOutlet = mockOutlets.find(outlet => outlet.isActive) || mockOutlets[0]
      setCurrentOutlet(defaultOutlet)
      
      setIsLoading(false)
    }

    initializeTenant()
  }, [])

  const switchOutlet = (outletId: string) => {
    const outlet = outlets.find((o) => o.id === outletId)
    if (outlet && outlet.isActive) {
      setCurrentOutlet(outlet)
      // In production, you might want to refetch data for the new outlet
      // This could trigger a refresh of dashboard data, sales, inventory, etc.
    }
  }

  const value: TenantContextType = {
    currentTenant,
    currentOutlet,
    outlets,
    setCurrentTenant,
    setCurrentOutlet,
    setOutlets,
    switchOutlet,
    isLoading,
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider")
  }
  return context
}

