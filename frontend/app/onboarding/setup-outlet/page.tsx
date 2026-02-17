"use client"

import { AuthLayout } from "@/components/layouts/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { Store, ArrowRight, ArrowLeft, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useBusinessStore } from "@/stores/businessStore"
import { useAuthStore } from "@/stores/authStore"
import { outletService } from "@/lib/services/outletService"
import { buildOutletSettings, normalizeOutletBusinessType } from "@/lib/utils/outlet-business-type"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SetupOutletPage() {
  const router = useRouter()
  const { currentBusiness, setCurrentOutlet, loadOutlets } = useBusinessStore()
  const { user } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    outletName: "",
    address: "",
    phone: "",
    email: "",
  })

  useEffect(() => {
    // Redirect if no business or user
    if (!user) {
      router.push("/auth/login")
      return
    }
    if (!currentBusiness) {
      router.push("/onboarding/setup-business")
      return
    }
  }, [user, currentBusiness, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!currentBusiness) {
      setError("No business found. Please complete business setup first.")
      return
    }
    
    if (!formData.outletName || !formData.outletName.trim()) {
      setError("Outlet name is required")
      return
    }

    if (!currentBusiness.id) {
      setError("Invalid business ID. Please go back and complete business setup again.")
      return
    }

    setIsLoading(true)
    
    try {
      // Ensure we have a valid business ID (tenant ID)
      const tenantId = String(currentBusiness.id).trim()
      if (!tenantId) {
        throw new Error("Business ID is missing. Please complete business setup first.")
      }

      // Create outlet via API - backend expects 'tenant' field, but we send 'businessId'
      // The outletService will map businessId to tenant
      const outlet = await outletService.create({
        businessId: tenantId,
        name: formData.outletName.trim() || `${currentBusiness.name} - Main`,
        address: formData.address?.trim() || "",
        phone: formData.phone?.trim() || "",
        businessType: normalizeOutletBusinessType(currentBusiness.type),
        settings: buildOutletSettings(currentBusiness.settings, currentBusiness.type),
        isActive: true,
      })
      
      if (!outlet || !outlet.id) {
        throw new Error("Outlet was created but no ID was returned. Please try again.")
      }
      
      // Set as current outlet and reload outlets
      try {
        await loadOutlets(currentBusiness.id)
        setCurrentOutlet(outlet.id)
      } catch (loadError) {
        console.warn("Could not reload outlets, but outlet was created:", loadError)
        // Continue anyway - outlet was created successfully
        setCurrentOutlet(outlet.id)
      }
      
      setIsLoading(false)
      router.push("/onboarding/add-first-user")
    } catch (err: any) {
      console.error("Error creating outlet:", err)
      
      // Extract error message from various error formats
      let errorMessage = "Failed to create outlet. Please try again."
      
      if (err?.message) {
        errorMessage = err.message
      } else if (err?.response?.data) {
        // Handle DRF error format
        const data = err.response.data
        if (typeof data === 'string') {
          errorMessage = data
        } else if (data.detail) {
          errorMessage = data.detail
        } else if (data.errors) {
          // Format validation errors
          const errorList = Object.entries(data.errors).map(([field, errors]: [string, any]) => {
            const errorText = Array.isArray(errors) ? errors.join(', ') : String(errors)
            return `${field}: ${errorText}`
          })
          errorMessage = errorList.join('; ')
        } else if (data.tenant) {
          errorMessage = Array.isArray(data.tenant) ? data.tenant[0] : data.tenant
        }
      } else if (err?.data) {
        // Handle other error formats
        if (err.data.detail) {
          errorMessage = err.data.detail
        } else if (typeof err.data === 'string') {
          errorMessage = err.data
        }
      }
      
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Store className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl">Setup Your First Outlet</CardTitle>
          </div>
          <CardDescription>
            Create your first business location or branch
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {currentBusiness && (
              <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                Creating outlet for: <strong>{currentBusiness.name}</strong>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="outlet-name">Outlet Name *</Label>
              <Input 
                id="outlet-name" 
                type="text" 
                placeholder="e.g., Downtown Branch, Main Store"
                value={formData.outletName}
                onChange={(e) => setFormData({ ...formData, outletName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="outlet-address">Outlet Address</Label>
              <Input 
                id="outlet-address" 
                type="text" 
                placeholder="123 Main Street"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="outlet-phone">Phone Number</Label>
                <Input 
                  id="outlet-phone" 
                  type="tel" 
                  placeholder="+265 123 456 789"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outlet-email">Email</Label>
                <Input 
                  id="outlet-email" 
                  type="email" 
                  placeholder="outlet@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="flex gap-4 w-full">
              <Link href="/onboarding/setup-business" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? "Creating Outlet..." : "Continue"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Step 2 of 3 - Outlet Setup
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  )
}

