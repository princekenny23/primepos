"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useBusinessStore } from "@/stores/businessStore"
import { tenantService } from "@/lib/services/tenantService"
import { outletService } from "@/lib/services/outletService"
import { useRealAPI } from "@/lib/utils/api-config"

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
  switchOutlet: (outletId: string) => Promise<void>
  isLoading: boolean
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: ReactNode }) {
  const { currentBusiness, currentOutlet: businessOutlet, outlets: businessOutlets, loadOutlets } = useBusinessStore()
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null)
  const [currentOutlet, setCurrentOutletState] = useState<Outlet | null>(null)
  
  // Wrapper to set outlet and update localStorage
  const setCurrentOutlet = (outlet: Outlet | null) => {
    setCurrentOutletState(outlet)
    if (typeof window !== "undefined") {
      if (outlet) {
        localStorage.setItem("currentOutletId", String(outlet.id))
      } else {
        localStorage.removeItem("currentOutletId")
      }
    }
  }
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const useReal = useRealAPI()

  // Initialize tenant and outlets on mount
  useEffect(() => {
    // Prevent infinite loop - only run when currentBusiness changes
    if (!currentBusiness) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    const initializeTenant = async () => {
      setIsLoading(true)
      
      if (useReal && currentBusiness) {
        try {
          // Load tenant data
          const tenantData = await tenantService.get(currentBusiness.id)
          if (!isMounted) return
          
          setCurrentTenant({
            id: tenantData.id,
            name: tenantData.name,
            businessType: tenantData.type,
            email: tenantData.email || "",
            phone: tenantData.phone || "",
            address: tenantData.address || "",
          })
          
          // Get outlets from tenant data (tenant serializer includes outlets)
          // This is the most reliable source as it's directly from the tenant
          let tenantOutlets = tenantData.outlets || []
          const tenantId = String(tenantData.id)
          
          console.log("Tenant Context - Loading outlets for tenant:", {
            tenantId,
            tenantName: tenantData.name,
            outletsFromTenant: tenantOutlets.length,
            outletIds: tenantOutlets.map((o: any) => o.id),
            fullTenantData: tenantData // Debug: log full response
          })
          
          // If no outlets from tenant data, try loading from outlet service
          if (tenantOutlets.length === 0) {
            console.warn("No outlets in tenant data, trying outlet service...")
            try {
              const outletService = (await import("@/lib/services/outletService")).outletService
              const allOutlets = await outletService.list()
              const filteredOutlets = allOutlets.filter((outlet: any) => {
                const outletTenantId = outlet.tenant 
                  ? (typeof outlet.tenant === 'object' ? String(outlet.tenant.id) : String(outlet.tenant))
                  : String(outlet.businessId || "")
                return outletTenantId === tenantId
              })
              console.log("Loaded outlets from outlet service:", {
                total: allOutlets.length,
                filtered: filteredOutlets.length,
                tenantId
              })
              if (filteredOutlets.length > 0) {
                // Transform outlets from outlet service to match tenant data format
                tenantOutlets = filteredOutlets.map((o: any) => ({
                  id: o.id,
                  tenant: tenantId,
                  name: o.name,
                  address: o.address || "",
                  phone: o.phone || "",
                  email: o.email || "",
                  is_active: o.isActive !== undefined ? o.isActive : true,
                  settings: o.settings || {},
                }))
                console.log("Using outlets from outlet service:", tenantOutlets.length)
              }
            } catch (error) {
              console.error("Failed to load outlets from outlet service:", error)
            }
          }
          
          // Transform outlets from tenant data to our format
          const loadedOutlets = tenantOutlets.map((o: any) => {
            const outletId = String(o.id)
            const outletTenantId = o.tenant 
              ? (typeof o.tenant === 'object' ? String(o.tenant.id) : String(o.tenant))
              : tenantId
            
            // Verify outlet belongs to this tenant
            if (outletTenantId !== tenantId) {
              console.warn("Outlet does not belong to tenant:", {
                outletId,
                outletTenantId,
                expectedTenantId: tenantId
              })
            }
            
            return {
              id: outletId,
              tenantId: tenantId, // Always use the tenant ID from tenant data
              name: o.name,
              address: o.address || "",
              phone: o.phone || "",
              email: o.email || "",
              isActive: o.is_active !== undefined ? o.is_active : (o.isActive !== undefined ? o.isActive : true),
              settings: o.settings || {},
            }
          })
          
          console.log("Tenant Context - Transformed outlets:", {
            count: loadedOutlets.length,
            outlets: loadedOutlets.map(o => ({ id: o.id, name: o.name, tenantId: o.tenantId }))
          })
          
          setOutlets(loadedOutlets)
          
          // Also update business store with filtered outlets
          const store = useBusinessStore.getState()
          if (loadedOutlets.length > 0) {
            // Update store with tenant's outlets
            useBusinessStore.setState({ outlets: loadedOutlets.map(o => ({
              id: o.id,
              businessId: o.tenantId,
              name: o.name,
              address: o.address,
              phone: o.phone,
              isActive: o.isActive,
              settings: o.settings,
              createdAt: new Date().toISOString(),
            })) })
          }
          
          // Set current outlet - use first active outlet or first outlet
          if (loadedOutlets.length > 0) {
            // Always use first active outlet or first outlet from this tenant
            // Don't rely on store outlet as it might be from a different tenant
            const defaultOutlet = loadedOutlets.find(o => o.isActive) || loadedOutlets[0]
            setCurrentOutlet(defaultOutlet)
            
            console.log("Tenant Context - Set current outlet:", {
              outletId: defaultOutlet.id,
              outletName: defaultOutlet.name,
              tenantId: defaultOutlet.tenantId,
              isActive: defaultOutlet.isActive
            })
            
            // Update store with correct outlet
            useBusinessStore.setState({ currentOutlet: {
              id: defaultOutlet.id,
              businessId: defaultOutlet.tenantId,
              name: defaultOutlet.name,
              address: defaultOutlet.address,
              phone: defaultOutlet.phone,
              isActive: defaultOutlet.isActive,
              settings: defaultOutlet.settings,
              createdAt: new Date().toISOString(),
            } })
          } else {
            console.warn("Tenant Context - No outlets found for tenant:", tenantId)
            setCurrentOutlet(null) // Explicitly set to null if no outlets
          }
        } catch (error) {
          console.error("Error initializing tenant:", error)
        }
      } else {
        // Simulation mode - use business store data
        const store = useBusinessStore.getState()
        setCurrentTenant({
          id: currentBusiness.id,
          name: currentBusiness.name,
          businessType: currentBusiness.type,
          email: currentBusiness.email || "",
          phone: currentBusiness.phone || "",
          address: currentBusiness.address || "",
        })
        
        const loadedOutlets = store.outlets.map(o => ({
          id: o.id,
          tenantId: o.businessId,
          name: o.name,
          address: o.address || "",
          phone: o.phone || "",
          email: o.email || "",
          isActive: o.isActive,
          settings: o.settings,
        }))
        setOutlets(loadedOutlets)
        
        if (store.currentOutlet) {
          setCurrentOutlet({
            id: store.currentOutlet.id,
            tenantId: store.currentOutlet.businessId,
            name: store.currentOutlet.name,
            address: store.currentOutlet.address || "",
            phone: store.currentOutlet.phone || "",
            email: store.currentOutlet.email || "",
            isActive: store.currentOutlet.isActive,
            settings: store.currentOutlet.settings,
          })
        } else if (loadedOutlets.length > 0) {
          const defaultOutlet = loadedOutlets.find(o => o.isActive) || loadedOutlets[0]
          setCurrentOutlet(defaultOutlet)
        }
      }
      
      if (isMounted) {
        setIsLoading(false)
      }
    }

    initializeTenant()
    
    return () => {
      isMounted = false
    }
  }, [currentBusiness?.id, useReal]) // Only depend on business ID, not the whole object or outlets

  const switchOutlet = async (outletId: string): Promise<void> => {
    const outlet = outlets.find((o) => String(o.id) === String(outletId))
    
    if (!outlet) {
      throw new Error(`Outlet with ID ${outletId} not found`)
    }
    
    if (!outlet.isActive) {
      throw new Error(`Cannot switch to inactive outlet: ${outlet.name}`)
    }
    
    // Update tenant context
    setCurrentOutlet(outlet)
    
    // Also update business store to keep them in sync
    useBusinessStore.setState({ 
      currentOutlet: {
        id: outlet.id,
        businessId: outlet.tenantId,
        name: outlet.name,
        address: outlet.address,
        phone: outlet.phone,
        isActive: outlet.isActive,
        settings: outlet.settings,
        createdAt: new Date().toISOString(),
      }
    })
    
    console.log("Switched outlet:", {
      outletId: outlet.id,
      outletName: outlet.name,
      tenantId: outlet.tenantId
    })
    
    // Store outlet ID in localStorage for API client
    if (typeof window !== "undefined") {
      localStorage.setItem("currentOutletId", String(outlet.id))
      
      // Dispatch custom event to notify all components of outlet change
      window.dispatchEvent(new CustomEvent("outlet-changed", {
        detail: {
          outletId: outlet.id,
          outletName: outlet.name,
          outlet: outlet
        }
      }))
    }
  }
  
  // Listen for outlet updates to refresh the list
  useEffect(() => {
    const handleOutletsUpdated = async () => {
      if (currentBusiness?.id && loadOutlets) {
        try {
          await loadOutlets(currentBusiness.id)
          const updatedOutlets = useBusinessStore.getState().outlets
          const transformedOutlets = updatedOutlets.map((o: any) => ({
            id: o.id,
            tenantId: o.businessId,
            name: o.name,
            address: o.address || "",
            phone: o.phone || "",
            email: o.email || "",
            isActive: o.isActive,
            settings: o.settings || {},
          }))
          setOutlets(transformedOutlets)
          
          // Update current outlet if it exists in the updated list
          if (currentOutlet) {
            const updatedCurrent = transformedOutlets.find((o: any) => o.id === currentOutlet.id)
            if (updatedCurrent) {
              setCurrentOutlet(updatedCurrent)
            }
          }
        } catch (error) {
          console.error("Failed to refresh outlets after update:", error)
        }
      }
    }
    
    if (typeof window !== "undefined") {
      window.addEventListener("outlets-updated", handleOutletsUpdated)
    }
    
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("outlets-updated", handleOutletsUpdated)
      }
    }
  }, [currentBusiness?.id, currentOutlet?.id, loadOutlets, setOutlets, setCurrentOutlet])

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

