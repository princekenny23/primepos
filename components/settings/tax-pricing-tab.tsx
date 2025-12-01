"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Percent } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

export function TaxPricingTab() {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [enableVAT, setEnableVAT] = useState(true)
  const [enableServiceCharge, setEnableServiceCharge] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      toast({
        title: "Settings Saved",
        description: "Tax and pricing settings have been updated successfully.",
      })
    }, 1000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax & Pricing</CardTitle>
        <CardDescription>Configure tax rates and pricing rules</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-vat"
              checked={enableVAT}
              onCheckedChange={(checked) => setEnableVAT(checked as boolean)}
            />
            <Label htmlFor="enable-vat" className="cursor-pointer">
              Enable VAT (Value Added Tax)
            </Label>
          </div>

          {enableVAT && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="vat-rate">VAT Rate (%)</Label>
              <div className="relative">
                <Input
                  id="vat-rate"
                  type="number"
                  step="0.01"
                  defaultValue="10.00"
                  className="pl-8"
                />
                <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                VAT will be automatically calculated and added to all sales
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-service-charge"
              checked={enableServiceCharge}
              onCheckedChange={(checked) => setEnableServiceCharge(checked as boolean)}
            />
            <Label htmlFor="enable-service-charge" className="cursor-pointer">
              Enable Service Charge
            </Label>
          </div>

          {enableServiceCharge && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="service-charge-rate">Service Charge Rate (%)</Label>
              <div className="relative">
                <Input
                  id="service-charge-rate"
                  type="number"
                  step="0.01"
                  defaultValue="5.00"
                  className="pl-8"
                />
                <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Service charge will be added to applicable transactions
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax-inclusive">Price Display</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="tax-inclusive"
                name="price-display"
                defaultChecked
                className="h-4 w-4"
              />
              <Label htmlFor="tax-inclusive" className="cursor-pointer">
                Tax Inclusive (Prices include tax)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="tax-exclusive"
                name="price-display"
                className="h-4 w-4"
              />
              <Label htmlFor="tax-exclusive" className="cursor-pointer">
                Tax Exclusive (Tax added at checkout)
              </Label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

