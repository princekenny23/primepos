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
import { Building2, ArrowRight } from "lucide-react"
import { useState } from "react"
import { TermsConditionsModal } from "@/components/modals/terms-conditions-modal"

export default function SetupBusinessPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!acceptedTerms) {
      setShowTerms(true)
      return
    }

    setIsLoading(true)
    
    // In production, this would call API to create business
    setTimeout(() => {
      setIsLoading(false)
      router.push("/onboarding/setup-outlet")
    }, 1000)
  }

  return (
    <AuthLayout>
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl">Setup Your Business</CardTitle>
          </div>
          <CardDescription>
            Let's get started by setting up your business profile
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business-name">Business Name *</Label>
              <Input 
                id="business-name" 
                type="text" 
                placeholder="Enter your business name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-type">Business Type *</Label>
              <Select required>
                <SelectTrigger id="business-type">
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail Store</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="pharmacy">Pharmacy</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="bar">Bar/Nightclub</SelectItem>
                  <SelectItem value="cafe">Cafe</SelectItem>
                  <SelectItem value="supermarket">Supermarket</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-email">Business Email *</Label>
              <Input 
                id="business-email" 
                type="email" 
                placeholder="business@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-phone">Business Phone *</Label>
              <Input 
                id="business-phone" 
                type="tel" 
                placeholder="+1 (555) 123-4567"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-address">Business Address *</Label>
              <Input 
                id="business-address" 
                type="text" 
                placeholder="123 Main St, City, State 12345"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax-id">Tax ID / Registration Number</Label>
              <Input 
                id="tax-id" 
                type="text" 
                placeholder="Optional"
              />
            </div>

            <div className="flex items-start gap-2 pt-4">
              <input
                type="checkbox"
                id="accept-terms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1"
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
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating Business..." : "Continue"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Step 1 of 3 - Business Setup
            </p>
          </CardFooter>
        </form>
      </Card>

      <TermsConditionsModal 
        open={showTerms} 
        onOpenChange={setShowTerms}
        onAccept={() => {
          setAcceptedTerms(true)
          setShowTerms(false)
        }}
      />
    </AuthLayout>
  )
}

