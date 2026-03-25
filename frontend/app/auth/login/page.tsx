"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useBusinessStore } from "@/stores/businessStore"
import { tenantService } from "@/lib/services/tenantService"
import { User, Lock, Eye, EyeOff } from "lucide-react"
import { Card } from "@/components/ui/card"

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
      const userRole = String(result.user.effective_role || result.user.role || "staff").toLowerCase()
      const isAdminUser = isSaaSAdmin || userRole.includes("admin")
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
          const store = useBusinessStore.getState()
          const allOutlets = (store.outlets || []).filter((outlet) => outlet.isActive !== false)
          const assignedOutletIds = Array.isArray(result.user.outletIds)
            ? result.user.outletIds.map((id: any) => String(id)).filter(Boolean)
            : []

          if (assignedOutletIds.length === 1) {
            const matchedOutlet = allOutlets.find((outlet) => String(outlet.id) === assignedOutletIds[0])
            if (matchedOutlet) {
              setSelectedOutlet(matchedOutlet.id)
              router.push(nextRoute)
              return
            }
          }

          if (assignedOutletIds.length === 0 || assignedOutletIds.length > 1) {
            router.push(`/auth/select-outlet?next=${encodeURIComponent(nextRoute)}`)
            return
          }

          if (assignedOutletIds.length === 1) {
            router.push(`/auth/select-outlet?next=${encodeURIComponent(nextRoute)}`)
            return
          }

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
        const store = useBusinessStore.getState()
        const allOutlets = (store.outlets || []).filter((outlet) => outlet.isActive !== false)
        const assignedOutletIds = Array.isArray(result.user.outletIds)
          ? result.user.outletIds.map((id: any) => String(id)).filter(Boolean)
          : []

        if (assignedOutletIds.length === 1) {
          const matchedOutlet = allOutlets.find((outlet) => String(outlet.id) === assignedOutletIds[0])
          if (matchedOutlet) {
            setSelectedOutlet(matchedOutlet.id)
            router.push(nextRoute)
            return
          }
        }

        if (assignedOutletIds.length === 0 || assignedOutletIds.length > 1) {
          router.push(`/auth/select-outlet?next=${encodeURIComponent(nextRoute)}`)
          return
        }

        router.push(`/auth/select-outlet?next=${encodeURIComponent(nextRoute)}`)
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

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <Card className="w-full max-w-5xl shadow-xl border-0">
        <div className="flex">
          {/* Left Section - Login Form */}
          <div className="flex-1 p-8 bg-white">
            <div className="max-w-md mx-auto">
              {/* Title */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Login</h1>
                <p className="text-gray-600">Powering Smart Business</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                {error && (
                  <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-gray-700">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      id="identifier" 
                      name="identifier" 
                      type="text" 
                      placeholder="Enter your username" 
                      required 
                      disabled={isLoading}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      id="password" 
                      name="password" 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Enter password" 
                      required 
                      disabled={isLoading}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-blue-900 hover:bg-blue-950 text-white h-11 text-base font-medium" 
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Login"}
                </Button>
              </form>
            </div>
          </div>

          {/* Right Section - Branding Info (Blue Background) */}
          <div className="hidden lg:flex flex-1 items-center justify-center p-8 bg-blue-900">
            <div className="max-w-md space-y-6 text-white">
              {/* Logo */}
              <div className="flex justify-center">
                <img
                  src="/icon.jpg"
                  alt="PrimePOS"
                  width={128}
                  height={128}
                  className="h-20 w-20 rounded-2xl object-cover shadow-lg"
                />
              </div>
              
              {/* Description */}
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-white">PrimePOS - Smart Point of Sale for Modern Businesses</h2>
                <p className="text-base text-white/90 leading-relaxed">
                  Track sales, manage inventory, control outlets, and grow your business with ease. PrimePOS gives you a secure system to run your business operations-all in one place.
                </p>
              </div>

            
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

