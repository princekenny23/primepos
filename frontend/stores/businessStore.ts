// Zustand Store for Business Management
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { Business, Outlet } from "@/lib/types"
import { Till } from "@/lib/services/tillService"
import { tenantService } from "@/lib/services/tenantService"
import { outletService } from "@/lib/services/outletService"
import { tillService } from "@/lib/services/tillService"
import { useRealAPI } from "@/lib/utils/api-config"

let inFlightBusinessRequest: Promise<void> | null = null
let inFlightBusinessId: string | null = null

interface BusinessState {
  currentBusiness: Business | null
  currentOutlet: Outlet | null
  currentTill: Till | null
  businesses: Business[]
  outlets: Outlet[]
  tills: Till[]
  isLoading: boolean
  setCurrentBusiness: (businessId: string) => Promise<void>
  setCurrentOutlet: (outletId: string) => void
  setCurrentTill: (tillId: string) => void
  loadBusinesses: () => Promise<void>
  loadOutlets: (businessId: string) => Promise<void>
  loadTills: (outletId: string) => Promise<void>
  clearCurrent: () => void
}

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set, get) => ({
      currentBusiness: null as Business | null,
      currentOutlet: null as Outlet | null,
      currentTill: null as Till | null,
      businesses: [] as Business[],
      outlets: [] as Outlet[],
      tills: [] as Till[],
      isLoading: false,
      
      setCurrentBusiness: async (businessId: string): Promise<void> => {
        const normalizedBusinessId = String(businessId)

        if (inFlightBusinessRequest && inFlightBusinessId === normalizedBusinessId) {
          return inFlightBusinessRequest
        }

        try {
          const request = (async () => {
            set({ isLoading: true })
            const business = await tenantService.get(normalizedBusinessId)
            set({ currentBusiness: business, currentOutlet: null, currentTill: null })
            await get().loadOutlets(normalizedBusinessId)

            const outlets = get().outlets
            if (outlets.length > 0 && !get().currentOutlet) {
              set({ currentOutlet: outlets[0] })
              // Load tills for the first outlet
              await get().loadTills(outlets[0].id)
            }
          })()

          inFlightBusinessRequest = request
          inFlightBusinessId = normalizedBusinessId
          await request
        } catch (error) {
          console.error("Failed to set current business:", error)
          throw error
        } finally {
          if (inFlightBusinessId === normalizedBusinessId) {
            inFlightBusinessRequest = null
            inFlightBusinessId = null
          }
          set({ isLoading: false })
        }
      },
      
      setCurrentOutlet: (outletId: string) => {
        const normalizedOutletId = String(outletId)
        const outlet = get().outlets.find((o) => String(o.id) === normalizedOutletId)
        if (outlet) {
          set({ currentOutlet: outlet, currentTill: null })
          if (typeof window !== "undefined") {
            localStorage.setItem("currentOutletId", String(outlet.id))
            window.dispatchEvent(
              new CustomEvent("outlet-changed", {
                detail: {
                  outletId: String(outlet.id),
                  outletName: outlet.name,
                  outlet,
                },
              })
            )
          }
          // Load tills for this outlet
          get().loadTills(String(outlet.id))
        }
      },

      setCurrentTill: (tillId: string) => {
        const normalizedTillId = String(tillId)
        const till = get().tills.find((t) => String(t.id) === normalizedTillId)
        if (till) {
          set({ currentTill: till })
        }
      },
      
      loadBusinesses: async () => {
        try {
          set({ isLoading: true })
          const businesses = await tenantService.list()
          set({ businesses })
        } catch (error) {
          console.error("Failed to load businesses:", error)
        } finally {
          set({ isLoading: false })
        }
      },
      
      loadOutlets: async (businessId: string) => {
        try {
          const outlets = await outletService.list()
          const tenantOutlets = outlets.filter((outlet: any) => {
            const outletTenantId = outlet.tenant 
              ? (typeof outlet.tenant === 'object' ? String(outlet.tenant.id) : String(outlet.tenant))
              : String(outlet.businessId || "")
            return outletTenantId === String(businessId)
          })
          set({ outlets: tenantOutlets, tills: [] })

          if (tenantOutlets.length > 0) {
            const current = get().currentOutlet
            const storedOutletId =
              typeof window !== "undefined" ? localStorage.getItem("currentOutletId") : null

            const currentMatch = current
              ? tenantOutlets.find((o: any) => String(o.id) === String(current.id))
              : null

            const storedMatch = storedOutletId
              ? tenantOutlets.find((o: any) => String(o.id) === String(storedOutletId))
              : null

            const preferredOutlet =
              storedMatch ||
              currentMatch ||
              tenantOutlets.find((o: any) => o.isActive) ||
              tenantOutlets[0]

            if (!current || String(current.id) !== String(preferredOutlet.id)) {
              set({ currentOutlet: preferredOutlet, currentTill: null })
              await get().loadTills(preferredOutlet.id)
            }
          } else {
            set({ currentOutlet: null, currentTill: null })
          }
        } catch (error) {
          console.error("Failed to load outlets:", error)
          set({ outlets: [], tills: [] })
        }
      },

      loadTills: async (outletId: string) => {
        try {
          if (!outletId) {
            set({ tills: [], currentTill: null })
            return
          }

          const response = await tillService.list({ outlet: outletId, is_active: true })
          const tills = response.results || []
          set({ tills })
          
          // Auto-select first till if none selected
          const current = get().currentTill
          if (!current && tills.length > 0) {
            set({ currentTill: tills[0] })
          } else if (current && !tills.find(t => String(t.id) === String(current.id))) {
            // Clear till if it no longer exists in outlet
            set({ currentTill: null })
          }
        } catch (error) {
          console.error("Failed to load tills:", error)
          set({ tills: [], currentTill: null })
        }
      },
      
      clearCurrent: () => {
        set({ currentBusiness: null, currentOutlet: null, currentTill: null, outlets: [], tills: [] })
      },
    }),
    {
      name: "primepos-business",
      storage: createJSONStorage(() => localStorage),
    }
  )
)

