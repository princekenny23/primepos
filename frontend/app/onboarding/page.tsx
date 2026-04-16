"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useBusinessStore } from "@/stores/businessStore"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, Store, UserPlus, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react"
import { TermsConditionsModal } from "@/components/modals/terms-conditions-modal"
import { SuccessModal } from "@/components/modals/success-modal"
import { tenantService } from "@/lib/services/tenantService"
import { authService } from "@/lib/services/authService"
import { outletService } from "@/lib/services/outletService"
import { buildOutletSettings, normalizeOutletBusinessType } from "@/lib/utils/outlet-business-type"
import { userService } from "@/lib/services/userService"
import type { BusinessType, POSType } from "@/lib/types"
import { Alert, AlertDescription } from "@/components/ui/alert"

/**
 * Onboarding redirect page
 * Redirects to the multi-page onboarding flow
 */
export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, setUser, refreshUser } = useAuthStore()
  const { currentBusiness, currentOutlet, setCurrentBusiness, loadBusinesses, setCurrentOutlet, loadOutlets } = useBusinessStore()
  const [activeTab, setActiveTab] = useState<"business" | "outlet" | "user">("business")

  const [isCreatingBusiness, setIsCreatingBusiness] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [businessError, setBusinessError] = useState<string | null>(null)

  const [businessFormData, setBusinessFormData] = useState({
    businessName: "",
    businessType: "" as BusinessType | "",
    posType: "standard" as POSType,
    email: "",
    phone: "",
    address: "",
    taxId: "",
    currency: "MWK",
    currencySymbol: "MWK",
  })

  const [isCreatingOutlet, setIsCreatingOutlet] = useState(false)
  const [outletError, setOutletError] = useState<string | null>(null)
  const [outletFormData, setOutletFormData] = useState({
    outletName: "",
    address: "",
    phone: "",
    email: "",
  })

  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [userFormData, setUserFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "admin" as "admin" | "manager" | "cashier" | "staff",
  })
  
  useEffect(() => {
    if (!user) {
      router.push("/auth/login")
    }
  }, [user, router])

  useEffect(() => {
    const tabParam = searchParams.get("tab")
    if (tabParam === "business") {
      setActiveTab("business")
      return
    }
    if (tabParam === "outlet") {
      setActiveTab(currentBusiness ? "outlet" : "business")
      return
    }
    if (tabParam === "user") {
      if (!currentBusiness) {
        setActiveTab("business")
      } else if (!currentOutlet) {
        setActiveTab("outlet")
      } else {
        setActiveTab("user")
      }
    }
  }, [searchParams, currentBusiness, currentOutlet])

  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusinessError(null)

    if (!acceptedTerms) {
      setShowTerms(true)
      return
    }

    if (!businessFormData.businessName || !businessFormData.businessType || !businessFormData.posType) {
      setBusinessError("Please fill in all required fields")
      return
    }

    if (!user) {
      setBusinessError("Please login first")
      return
    }

    setIsCreatingBusiness(true)

    try {
      const business = await tenantService.create({
        name: businessFormData.businessName,
        type: businessFormData.businessType,
        posType: businessFormData.posType,
        currency: businessFormData.currency,
        currencySymbol: businessFormData.currencySymbol,
        phone: businessFormData.phone || "",
        email: businessFormData.email || "",
        address: businessFormData.address || "",
        settings: {
          posMode: businessFormData.businessType === "restaurant" ? "restaurant" :
            businessFormData.businessType === "bar" ? "bar" : "standard",
          receiptTemplate: "standard",
          taxEnabled: false,
          taxRate: 0,
          ...(businessFormData.taxId && { taxId: businessFormData.taxId }),
        } as any,
      })

      try {
        const updatedUser = await authService.getCurrentUser()
        if (updatedUser) {
          setUser(updatedUser)
        }
      } catch (error) {
        console.warn("Could not refresh user data:", error)
      }

      await loadBusinesses()
      await setCurrentBusiness(business.id)
      setActiveTab("outlet")
    } catch (err: any) {
      console.error("Error creating business:", err)
      setBusinessError(err.message || "Failed to create business. Please try again.")
    } finally {
      setIsCreatingBusiness(false)
    }
  }

  const handleOutletSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setOutletError(null)

    if (!currentBusiness) {
      setOutletError("No business found. Please complete business setup first.")
      return
    }

    if (!outletFormData.outletName || !outletFormData.outletName.trim()) {
      setOutletError("Outlet name is required")
      return
    }

    if (!currentBusiness.id) {
      setOutletError("Invalid business ID. Please complete business setup again.")
      return
    }

    setIsCreatingOutlet(true)

    try {
      const tenantId = String(currentBusiness.id).trim()
      if (!tenantId) {
        throw new Error("Business ID is missing. Please complete business setup first.")
      }

      const outlet = await outletService.create({
        businessId: tenantId,
        name: outletFormData.outletName.trim() || `${currentBusiness.name} - Main`,
        address: outletFormData.address?.trim() || "",
        phone: outletFormData.phone?.trim() || "",
        businessType: normalizeOutletBusinessType(currentBusiness.type),
        settings: buildOutletSettings(currentBusiness.settings, currentBusiness.type),
        isActive: true,
      })

      if (!outlet || !outlet.id) {
        throw new Error("Outlet was created but no ID was returned. Please try again.")
      }

      try {
        await loadOutlets(currentBusiness.id)
        setCurrentOutlet(outlet.id)
      } catch (loadError) {
        console.warn("Could not reload outlets, but outlet was created:", loadError)
        setCurrentOutlet(outlet.id)
      }

      setActiveTab("user")
    } catch (err: any) {
      console.error("Error creating outlet:", err)

      let errorMessage = "Failed to create outlet. Please try again."

      if (err?.message) {
        errorMessage = err.message
      } else if (err?.response?.data) {
        const data = err.response.data
        if (typeof data === "string") {
          errorMessage = data
        } else if (data.detail) {
          errorMessage = data.detail
        } else if (data.errors) {
          const errorList = Object.entries(data.errors).map(([field, errors]: [string, any]) => {
            const errorText = Array.isArray(errors) ? errors.join(", ") : String(errors)
            return `${field}: ${errorText}`
          })
          errorMessage = errorList.join("; ")
        } else if (data.tenant) {
          errorMessage = Array.isArray(data.tenant) ? data.tenant[0] : data.tenant
        }
      } else if (err?.data) {
        if (err.data.detail) {
          errorMessage = err.data.detail
        } else if (typeof err.data === "string") {
          errorMessage = err.data
        }
      }

      setOutletError(errorMessage)
    } finally {
      setIsCreatingOutlet(false)
    }
  }

  const handleFirstUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUserError(null)

    if (userFormData.password !== userFormData.confirmPassword) {
      setUserError("Passwords do not match")
      return
    }

    if (userFormData.password.length < 8) {
      setUserError("Password must be at least 8 characters long")
      return
    }

    if (!currentBusiness) {
      setUserError("No business found. Please complete business setup first.")
      return
    }

    setIsCreatingUser(true)

    try {
      const fullName = `${userFormData.firstName} ${userFormData.lastName}`.trim()

      await userService.create({
        email: userFormData.email,
        name: fullName,
        phone: userFormData.phone || undefined,
        role: userFormData.role,
        tenant: currentBusiness.id,
        outlet: currentOutlet?.id,
        password: userFormData.password,
      })

      await refreshUser()
      setShowSuccess(true)
    } catch (err: any) {
      console.error("Error creating user:", err)
      setUserError(err.message || "Failed to create user. Please try again.")
    } finally {
      setIsCreatingUser(false)
    }
  }

  const handleSuccessClose = () => {
    setShowSuccess(false)
    router.push("/dashboard")
  }
  
  if (!user) return null

  return (
    <AuthLayout>
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle className="text-2xl">Complete Account Setup</CardTitle>
          <CardDescription>
            Set up your business, outlet, and first user in one place
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "business" | "outlet" | "user")}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="business">Setup Business</TabsTrigger>
              <TabsTrigger value="outlet" disabled={!currentBusiness}>Setup Outlet</TabsTrigger>
              <TabsTrigger value="user" disabled={!currentBusiness || !currentOutlet}>Add First User</TabsTrigger>
            </TabsList>

            <TabsContent value="business" className="mt-6">
              <form onSubmit={handleBusinessSubmit}>
                <div className="space-y-4">
                  {businessError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{businessError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center gap-3 mb-2">
                    <Building2 className="h-6 w-6 text-primary" />
                    <h3 className="text-lg font-semibold">Setup Your Business</h3>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="business-name">Business Name *</Label>
                    <Input
                      id="business-name"
                      type="text"
                      placeholder="Enter your business name"
                      value={businessFormData.businessName}
                      onChange={(e) => setBusinessFormData({ ...businessFormData, businessName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 col-span-2">
                    <div className="space-y-2">
                      <Label htmlFor="business-type">Business Type *</Label>
                      <Select
                        value={businessFormData.businessType}
                        onValueChange={(value) => setBusinessFormData({ ...businessFormData, businessType: value as BusinessType })}
                      >
                        <SelectTrigger id="business-type">
                          <SelectValue placeholder="Select business type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wholesale and retail">Wholesale and Retail</SelectItem>
                          <SelectItem value="restaurant">Restaurant</SelectItem>
                          <SelectItem value="bar">Bar/Nightclub</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pos-type">POS Type *</Label>
                      <Select
                        value={businessFormData.posType}
                        onValueChange={(value) => setBusinessFormData({ ...businessFormData, posType: value as POSType })}
                      >
                        <SelectTrigger id="pos-type">
                          <SelectValue placeholder="Select POS type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard POS</SelectItem>
                          <SelectItem value="single_product">Single-Product POS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 col-span-2">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency *</Label>
                      <Select
                        value={businessFormData.currency}
                        onValueChange={(value) => {
                          const symbols: Record<string, string> = {
                            MWK: "MWK",
                            USD: "$",
                            EUR: "EUR",
                            GBP: "GBP",
                          }
                          setBusinessFormData({
                            ...businessFormData,
                            currency: value,
                            currencySymbol: symbols[value] || "MWK",
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MWK">MWK - Malawian Kwacha</SelectItem>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tax-id">Tax ID / Registration Number</Label>
                      <Input
                        id="tax-id"
                        type="text"
                        placeholder="Optional"
                        value={businessFormData.taxId}
                        onChange={(e) => setBusinessFormData({ ...businessFormData, taxId: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 col-span-2">
                    <div className="space-y-2">
                      <Label htmlFor="business-email">Business Email</Label>
                      <Input
                        id="business-email"
                        type="email"
                        placeholder="business@example.com"
                        value={businessFormData.email}
                        onChange={(e) => setBusinessFormData({ ...businessFormData, email: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="business-phone">Business Phone</Label>
                      <Input
                        id="business-phone"
                        type="tel"
                        placeholder="+265 123 456 789"
                        value={businessFormData.phone}
                        onChange={(e) => setBusinessFormData({ ...businessFormData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="business-address">Business Address</Label>
                    <Input
                      id="business-address"
                      type="text"
                      placeholder="123 Main Street"
                      value={businessFormData.address}
                      onChange={(e) => setBusinessFormData({ ...businessFormData, address: e.target.value })}
                    />
                  </div>

                  <div className="flex items-start gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="accept-terms"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-1"
                      aria-label="Accept terms and conditions"
                      required
                    />
                    <Label htmlFor="accept-terms" className="text-sm cursor-pointer">
                      I agree to the{" "}
                      <button
                        type="button"
                        onClick={() => setShowTerms(true)}
                        className="text-primary hover:underline"
                      >
                        Terms & Conditions
                      </button>
                      {" "}and{" "}
                      <button
                        type="button"
                        onClick={() => setShowTerms(true)}
                        className="text-primary hover:underline"
                      >
                        Privacy Policy
                      </button>
                    </Label>
                  </div>
                </div>

                <CardFooter className="px-0 pt-6 pb-0">
                  <Button type="submit" className="w-full" disabled={isCreatingBusiness}>
                    {isCreatingBusiness ? "Creating Business..." : "Continue to Outlet"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="outlet" className="mt-6">
              <form onSubmit={handleOutletSubmit}>
                <div className="space-y-4">
                  {outletError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{outletError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center gap-3 mb-2">
                    <Store className="h-6 w-6 text-primary" />
                    <h3 className="text-lg font-semibold">Setup Your First Outlet</h3>
                  </div>

                  {currentBusiness && (
                    <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                      Creating outlet for: <strong>{currentBusiness.name}</strong>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="outlet-name">Outlet Name *</Label>
                      <Input
                        id="outlet-name"
                        type="text"
                        placeholder="e.g., Downtown Branch, Main Store"
                        value={outletFormData.outletName}
                        onChange={(e) => setOutletFormData({ ...outletFormData, outletName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="outlet-address">Outlet Address</Label>
                      <Input
                        id="outlet-address"
                        type="text"
                        placeholder="123 Main Street"
                        value={outletFormData.address}
                        onChange={(e) => setOutletFormData({ ...outletFormData, address: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="outlet-phone">Phone Number</Label>
                      <Input
                        id="outlet-phone"
                        type="tel"
                        placeholder="+265 123 456 789"
                        value={outletFormData.phone}
                        onChange={(e) => setOutletFormData({ ...outletFormData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="outlet-email">Email</Label>
                      <Input
                        id="outlet-email"
                        type="email"
                        placeholder="outlet@example.com"
                        value={outletFormData.email}
                        onChange={(e) => setOutletFormData({ ...outletFormData, email: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <CardFooter className="px-0 pt-6 pb-0">
                  <Button type="submit" className="w-full" disabled={isCreatingOutlet}>
                    {isCreatingOutlet ? "Creating Outlet..." : "Continue to Add User"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="user" className="mt-6">
              <form onSubmit={handleFirstUserSubmit}>
                <div className="space-y-4">
                  {userError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{userError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center gap-3 mb-2">
                    <UserPlus className="h-6 w-6 text-primary" />
                    <h3 className="text-lg font-semibold">Add Your First User</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-name">First Name *</Label>
                      <Input
                        id="first-name"
                        type="text"
                        placeholder="John"
                        value={userFormData.firstName}
                        onChange={(e) => setUserFormData({ ...userFormData, firstName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Last Name *</Label>
                      <Input
                        id="last-name"
                        type="text"
                        placeholder="Doe"
                        value={userFormData.lastName}
                        onChange={(e) => setUserFormData({ ...userFormData, lastName: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@example.com"
                        value={userFormData.email}
                        onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+265 123 456 789"
                        value={userFormData.phone}
                        onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={userFormData.password}
                        onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                        required
                        minLength={8}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password *</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={userFormData.confirmPassword}
                        onChange={(e) => setUserFormData({ ...userFormData, confirmPassword: e.target.value })}
                        required
                        minLength={8}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={userFormData.role}
                      onValueChange={(value) => setUserFormData({ ...userFormData, role: value as typeof userFormData.role })}
                    >
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="cashier">Cashier</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {currentBusiness && (
                    <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                      User will be created for: <strong>{currentBusiness.name}</strong>
                      {currentOutlet && ` - ${currentOutlet.name}`}
                    </div>
                  )}
                </div>

                <CardFooter className="px-0 pt-6 pb-0">
                  <Button type="submit" className="w-full" disabled={isCreatingUser}>
                    {isCreatingUser ? "Creating Account..." : "Complete Setup"}
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <TermsConditionsModal
        open={showTerms}
        onOpenChange={setShowTerms}
        onAccept={() => {
          setAcceptedTerms(true)
          setShowTerms(false)
        }}
      />

      <SuccessModal
        open={showSuccess}
        onOpenChange={setShowSuccess}
        title="Business Created Successfully!"
        description="Your business has been set up and you're ready to start using PrimePOS."
        onClose={handleSuccessClose}
      />
    </AuthLayout>
  )
}

