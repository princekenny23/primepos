"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload, Building2, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { useTenant } from "@/contexts/tenant-context"
import { tenantService } from "@/lib/services/tenantService"
import { useAuthStore } from "@/stores/authStore"
import { useBusinessStore } from "@/stores/businessStore"
import type { BusinessType, POSType } from "@/lib/types"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LogoUploadModal } from "@/components/modals/logo-upload-modal"

export function BusinessInfoTab() {
  const { toast } = useToast()
  const { currentTenant } = useTenant()
  const { user } = useAuthStore()
  const { setCurrentBusiness } = useBusinessStore()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [showLogoModal, setShowLogoModal] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    type: BusinessType | ""
    posType: POSType
    email: string
    phone: string
    address: string
    currency: string
    currencySymbol: string
    taxId: string
    timezone: string
  }>({
    name: "",
    type: "" as BusinessType | "",
    posType: "standard" as POSType,
    email: "",
    phone: "",
    address: "",
    currency: "MWK",
    currencySymbol: "MK",
    taxId: "",
    timezone: "Africa/Blantyre",
  })
  
  // Check if user is admin
  const isAdmin = user?.role === "admin" || user?.is_saas_admin

  useEffect(() => {
    const loadBusinessInfo = async () => {
      if (!currentTenant) return
      
      setIsLoading(true)
      try {
        const tenant = await tenantService.get(currentTenant.id)
        setFormData({
          name: tenant.name || "",
          type: tenant.type || "",
          posType: tenant.posType || "standard",
          email: tenant.email || "",
          phone: tenant.phone || "",
          address: tenant.address || "",
          currency: tenant.currency || "MWK",
          currencySymbol: tenant.currencySymbol || "MK",
          taxId: (tenant.settings as any)?.taxId || "",
          timezone: (tenant.settings as any)?.timezone || "Africa/Blantyre",
        })
        setLogoUrl((tenant as any)?.logo || null)
      } catch (error) {
        console.error("Failed to load business info:", error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadBusinessInfo()
  }, [currentTenant])

  const handleSave = async () => {
    if (!currentTenant) return
    
    setIsSaving(true)
    try {
      // Store timezone and taxId in settings JSONField
      const tenant = await tenantService.get(currentTenant.id)
      await tenantService.update(currentTenant.id, {
        name: formData.name,
        type: formData.type || undefined,
        posType: formData.posType,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        currency: formData.currency,
        currencySymbol: formData.currencySymbol,
        settings: {
          ...tenant.settings,
          timezone: formData.timezone,
          ...(formData.taxId && { taxId: formData.taxId }),
        },
      })
      
      // Reload business data to reflect changes
      await setCurrentBusiness(currentTenant.id)
      
      toast({
        title: "Settings Saved",
        description: "Business information has been updated successfully. The POS interface will update on next navigation.",
      })
    } catch (error: any) {
      console.error("Failed to save business info:", error)
      toast({
        title: "Error",
        description: error.data?.detail || "Failed to save business information",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Information</CardTitle>
        <CardDescription>Update your business details and preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading business information...</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="business-name">Business Name *</Label>
              <Input 
                id="business-name" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-type">Business Type *</Label>
              <Select 
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as BusinessType })}
                required
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

            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="pos-type">POS Type *</Label>
                <Select 
                  value={formData.posType}
                  onValueChange={(value) => setFormData({ ...formData, posType: value as POSType })}
                  required
                >
                  <SelectTrigger id="pos-type">
                    <SelectValue placeholder="Select POS type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard POS</SelectItem>
                    <SelectItem value="single_product">Single-Product POS</SelectItem>
                  </SelectContent>
                </Select>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Changing POS type will affect how the POS interface is displayed. 
                    Standard POS: Multiple products with cart-based checkout. 
                    Single-Product POS: One product with fast quantity-first checkout.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {!isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="pos-type-display">POS Type</Label>
                <Input 
                  id="pos-type-display" 
                  value={formData.posType === "standard" ? "Standard POS" : "Single-Product POS"}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Only administrators can change the POS type. Contact your admin to modify this setting.
                </p>
              </div>
            )}

        <div className="space-y-2">
          <Label>Business Logo</Label>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Business Logo"
                  width={320}
                  height={133}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <Building2 className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowLogoModal(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Logo
              </Button>
              <p className="text-xs text-gray-600">
                Recommended: 200x200px, PNG or JPG
              </p>
            </div>
          </div>
        </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Select 
                  value={formData.currency} 
                  onValueChange={(value) => {
                    const symbols: Record<string, string> = {
                      MWK: "MK",
                      USD: "$",
                      EUR: "€",
                      GBP: "£",
                      ZAR: "R",
                      KES: "KSh",
                      UGX: "USh",
                      TZS: "TSh",
                    }
                    setFormData({ 
                      ...formData, 
                      currency: value,
                      currencySymbol: symbols[value] || "MK"
                    })
                  }}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MWK">MWK (MK)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="ZAR">ZAR (R)</SelectItem>
                    <SelectItem value="KES">KES (KSh)</SelectItem>
                    <SelectItem value="UGX">UGX (USh)</SelectItem>
                    <SelectItem value="TZS">TZS (TSh)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency-symbol">Currency Symbol</Label>
                <Input 
                  id="currency-symbol" 
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  placeholder="MK"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone *</Label>
                <Select value={formData.timezone} onValueChange={(value) => setFormData({ ...formData, timezone: value })}>
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Africa/Blantyre">Blantyre (CAT)</SelectItem>
                    <SelectItem value="Africa/Lilongwe">Lilongwe (CAT)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    <SelectItem value="Europe/London">London (GMT)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax-id">Tax ID / Registration Number</Label>
                <Input 
                  id="tax-id" 
                  type="text" 
                  placeholder="Optional"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Business Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Business Phone</Label>
              <Input 
                id="phone" 
                type="tel" 
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Business Address</Label>
              <Input 
                id="address" 
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </>
        )}
      </CardContent>

      {/* Logo Upload Modal */}
      <LogoUploadModal
        open={showLogoModal}
        onOpenChange={setShowLogoModal}
        tenantId={currentTenant?.id || ""}
        currentLogo={logoUrl || undefined}
        onSuccess={(newLogoUrl) => {
          setLogoUrl(newLogoUrl)
          toast({
            title: "Logo Updated",
            description: "Your business logo has been updated successfully.",
          })
        }}
      />
    </Card>
  )
}

