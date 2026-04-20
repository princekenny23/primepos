"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useBusinessStore } from "@/stores/businessStore"
import { tenantService } from "@/lib/services/tenantService"
import {
  User, Lock, Eye, EyeOff,
  LayoutDashboard, ShoppingBag, Monitor, Package, Building2, Settings as SettingsIcon, CircleDot, Store, Bell
} from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const login = useAuthStore((state) => state.login)
  const setCurrentBusiness = useBusinessStore((state) => state.setCurrentBusiness)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const getPostLoginRoute = (businessType: string | undefined, isAdminUser: boolean): string => {
    if (!isAdminUser) return "/dashboard/pos"
    if (businessType === "restaurant") return "/dashboard/restaurant/dashboard"
    if (businessType === "bar") return "/dashboard/bar/dashboard"
    return "/dashboard"
  }

  const setSelectedOutlet = (outletId: string) => {
    const store = useBusinessStore.getState()
    store.setCurrentOutlet(String(outletId))
    if (typeof window !== "undefined") {
      localStorage.setItem("currentOutletId", String(outletId))
    }
  }

  const selectPostLoginOutlet = (outletIds: string[]) => {
    const store = useBusinessStore.getState()
    const allOutlets = (store.outlets || []).filter((outlet) => outlet.isActive !== false)
    if (allOutlets.length === 0) {
      return
    }

    const normalizedAssignedOutletIds = Array.isArray(outletIds)
      ? outletIds.map((id) => String(id)).filter(Boolean)
      : []

    const savedOutletId = typeof window !== "undefined" ? localStorage.getItem("currentOutletId") : null
    const savedOutlet = savedOutletId
      ? allOutlets.find((outlet) => String(outlet.id) === String(savedOutletId))
      : null

    if (normalizedAssignedOutletIds.length > 0) {
      const assignedOutlets = allOutlets.filter((outlet) => normalizedAssignedOutletIds.includes(String(outlet.id)))
      const preferredAssignedOutlet =
        (savedOutlet && normalizedAssignedOutletIds.includes(String(savedOutlet.id)) ? savedOutlet : null) ||
        assignedOutlets[0]

      if (preferredAssignedOutlet) {
        setSelectedOutlet(preferredAssignedOutlet.id)
      }
      return
    }

    if (savedOutlet) {
      setSelectedOutlet(savedOutlet.id)
      return
    }

    setSelectedOutlet(allOutlets[0].id)
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const identifier = formData.get("identifier") as string
    const password = formData.get("password") as string
    
    if (!identifier || !password) {
      setError("Please enter username/email and password")
      setIsLoading(false)
      return
    }
    
    console.log("Starting login process...")
    const result = await login(identifier, password)
    console.log("Login result:", { success: result.success, hasUser: !!result.user, error: result.error })
    
    if (result.success && result.user) {
      console.log("Login successful, checking user type...")
      // Check if user is SaaS admin from backend response
      const isSaaSAdmin = result.user.is_saas_admin === true
      const isAdminUser = isSaaSAdmin || Boolean(result.user.permissions?.can_dashboard || result.user.permissions?.can_settings)
      console.log("Is SaaS Admin:", isSaaSAdmin)
      
      if (isSaaSAdmin) {
        // SaaS admin - go to admin dashboard
        console.log("Redirecting to admin dashboard...")
        router.push("/admin")
        return
      }
      
      // Regular user with tenant - set their tenant as current business and redirect to dashboard
      if (result.user.tenant) {
        // Check if tenant is an object (not just ID)
        const tenant = typeof result.user.tenant === 'object' 
          ? result.user.tenant 
          : { id: result.user.tenant, name: undefined, type: undefined }
        
        console.log("User has tenant, setting as current business:", {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantType: tenant.type
        })
        
        // Set the tenant as current business in the store
        // This will trigger tenant context initialization and load outlets
        try {
          await setCurrentBusiness(String(tenant.id))

          const nextRoute = getPostLoginRoute(tenant.type, isAdminUser)
          selectPostLoginOutlet(result.user.outletIds || [])

          router.push(nextRoute)
          return
        } catch (error) {
          console.error("Failed to set current business:", error)
          setError("Failed to load your business. Please try again.")
          setIsLoading(false)
          return
        }
      }
      
      // Non-SaaS user with no tenant in login payload: attempt tenant recovery
      try {
        const currentTenant = await tenantService.getCurrent()
        await setCurrentBusiness(String(currentTenant.id))

        const nextRoute = getPostLoginRoute(currentTenant.type, isAdminUser)
        selectPostLoginOutlet(result.user.outletIds || [])

        router.push(nextRoute)
        return
      } catch (error) {
        console.error("Tenant recovery failed:", error)
      }

      // Final fallback: Check if any businesses exist
      try {
        const businesses = await tenantService.list()
        if (businesses.length === 0) {
          // No businesses exist, go to onboarding
          router.push("/onboarding/setup-business")
        } else {
          // Businesses exist, go to dashboard (business selection can happen there)
          router.push("/dashboard")
        }
      } catch (error) {
        console.error("Failed to load businesses:", error)
        // On error, go to onboarding
        router.push("/onboarding/setup-business")
      }
    } else {
      setError(result.error || "Login failed. Please try again.")
      setIsLoading(false)
    }
  }

  const bgNavItems = [
    { icon: CircleDot,       label: "Core" },
    { icon: LayoutDashboard, label: "Dash" },
    { icon: ShoppingBag,     label: "Sales" },
    { icon: Monitor,         label: "POS" },
    { icon: Package,         label: "Inventory" },
    { icon: Building2,       label: "Office" },
    { icon: SettingsIcon,    label: "Settings" },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gray-100">
      {/* Real app shell — sidebar + topnav, non-interactive */}
      <div className="absolute inset-0 pointer-events-none select-none">
        {/* Sidebar — matches real: w-20 bg-blue-900 */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-blue-900 flex flex-col z-10">
          {/* Logo */}
          <div className="px-2 py-3 flex items-center justify-center">
            <img src="/icon.jpg" alt="PrimePOS" className="h-10 w-10 rounded-md object-cover" />
          </div>
          {/* Nav items */}
          <nav className="flex-1 p-2 space-y-1 overflow-hidden border-r border-blue-800">
            {bgNavItems.map((item, i) => (
              <div
                key={i}
                className={`flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-lg min-h-[72px] ${
                  i === 0 ? "bg-white text-blue-900" : "text-blue-100"
                }`}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="text-[10px] leading-tight text-center">{item.label}</span>
              </div>
            ))}
          </nav>
        </div>

        {/* Topnav — matches real: bg-blue-900 text-white h-14 left-20 */}
        <div className="absolute top-0 left-20 right-0 h-14 bg-blue-900 border-b border-blue-800 flex items-center px-6 gap-4 z-10">
          <div className="text-sm font-medium text-white opacity-70">PrimePOS</div>
          <div className="flex items-center gap-2 text-blue-200 text-sm opacity-70">
            <Store className="h-4 w-4" />
            <span>Main Outlet</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 border border-blue-600 rounded-full px-3 py-1 text-xs text-white opacity-60">
              <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
              PA Connected
            </div>
            <Bell className="h-5 w-5 text-blue-200 opacity-60" />
            <div className="h-8 w-8 rounded-full bg-blue-700 flex items-center justify-center opacity-70">
              <User className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Very subtle overlay so modal stands out */}
      <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]" />

      {/* Login modal */}
      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        <div className="rounded-2xl bg-blue-900 shadow-2xl border border-blue-800 overflow-hidden">
          {/* Header band */}
          <div className="px-8 pt-8 pb-6 text-center">
            <img
              src="/icon.jpg"
              alt="PrimePOS"
              className="h-14 w-14 rounded-xl mx-auto mb-4 object-cover shadow-md ring-2 ring-white/20"
            />
            <h1 className="text-2xl font-bold text-white">Welcome to PrimePOS</h1>
            <p className="text-blue-200 text-sm mt-1">Smart tools for smart businesses</p>
          </div>

          {/* Form area */}
          <div className="bg-white px-8 py-7 rounded-t-2xl">
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-gray-700 text-sm font-medium">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="identifier"
                    name="identifier"
                    type="text"
                    placeholder="Enter your username"
                    required
                    disabled={isLoading}
                    className="pl-10 bg-white border-gray-200 focus:border-blue-900 focus:ring-blue-900/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    required
                    disabled={isLoading}
                    className="pl-10 pr-10 bg-white border-gray-200 focus:border-blue-900 focus:ring-blue-900/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-900 hover:bg-blue-950 text-white h-11 text-base font-semibold rounded-xl mt-1"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Login"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

