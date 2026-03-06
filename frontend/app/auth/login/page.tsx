"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useBusinessStore } from "@/stores/businessStore"
import { tenantService } from "@/lib/services/tenantService"
import { PrimePOSLogo } from "@/components/brand/primepos-logo"
import { Shield, User, Lock } from "lucide-react"
import { Card } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const login = useAuthStore((state) => state.login)
  const setCurrentBusiness = useBusinessStore((state) => state.setCurrentBusiness)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    
    if (!email || !password) {
      setError("Please enter both email and password")
      setIsLoading(false)
      return
    }
    
    console.log("Starting login process...")
    const result = await login(email, password)
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

          // Non-admin users should land directly on POS
          if (!isAdminUser) {
            console.log("Non-admin user detected, redirecting to POS landing...")
            router.push("/dashboard/pos")
            return
          }
          
          // Get the business type from tenant data to determine dashboard route
          const businessType = (tenant.type || "") as "wholesale and retail" | "restaurant" | "bar"
          
          // Redirect to the appropriate dashboard based on business type
          let dashboardRoute: string
          if (businessType === "wholesale and retail") {
            dashboardRoute = "/dashboard"
          } else if (businessType === "restaurant") {
            dashboardRoute = "/dashboard/restaurant/dashboard"
          } else if (businessType === "bar") {
            dashboardRoute = "/dashboard/bar/dashboard"
          } else {
            dashboardRoute = "/dashboard"
          }
          console.log("Redirecting to dashboard:", dashboardRoute)
          router.push(dashboardRoute)
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

        const businessType = (currentTenant.type || "") as "wholesale and retail" | "restaurant" | "bar"
        const dashboardRoute =
          businessType === "restaurant"
            ? "/dashboard/restaurant/dashboard"
            : businessType === "bar"
              ? "/dashboard/bar/dashboard"
              : "/dashboard"

        router.push(isAdminUser ? dashboardRoute : "/dashboard/pos")
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
                <p className="text-gray-600">Access, Engage, Empower</p>
              </div>

              {/* Shield Icon */}
              <div className="flex justify-center mb-6">
                <div className="h-16 w-16 rounded-full bg-blue-900/10 flex items-center justify-center border-2 border-blue-900/30">
                  <Shield className="h-8 w-8 text-blue-900" />
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                {error && (
                  <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700">Useremail</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      id="email" 
                      name="email" 
                      type="email" 
                      placeholder="Enter your email" 
                      required 
                      disabled={isLoading}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-gray-700">Password</Label>
                    <Link href="/auth/forgot-password" className="text-sm text-blue-900 hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      id="password" 
                      name="password" 
                      type="password" 
                      placeholder="Enter password" 
                      required 
                      disabled={isLoading}
                      className="pl-10"
                    />
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
                <PrimePOSLogo variant="full" size="lg" version={1} />
              </div>
              
              {/* Description */}
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-white">PrimePOS – Smart Point of Sale for Modern Businesses</h2>
                <p className="text-base text-white/90 leading-relaxed">
                Track sales, manage inventory, control outlets, and grow your business with ease.
                PrimePOS gives you a secure system to run your business       operations—all in one place.
                </p>
              </div>

            
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

