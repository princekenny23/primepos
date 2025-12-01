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
import { Store, ArrowRight, ArrowLeft } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

export default function SetupOutletPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // In production, this would call API to create outlet
    setTimeout(() => {
      setIsLoading(false)
      router.push("/onboarding/add-first-user")
    }, 1000)
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
            <div className="space-y-2">
              <Label htmlFor="outlet-name">Outlet Name *</Label>
              <Input 
                id="outlet-name" 
                type="text" 
                placeholder="e.g., Downtown Branch, Main Store"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="outlet-address">Outlet Address *</Label>
              <Input 
                id="outlet-address" 
                type="text" 
                placeholder="123 Main St, City, State 12345"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="outlet-phone">Phone Number</Label>
                <Input 
                  id="outlet-phone" 
                  type="tel" 
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outlet-email">Email</Label>
                <Input 
                  id="outlet-email" 
                  type="email" 
                  placeholder="outlet@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos-mode">POS Mode *</Label>
              <Select required>
                <SelectTrigger id="pos-mode">
                  <SelectValue placeholder="Select POS mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="express">Express</SelectItem>
                  <SelectItem value="quick">Quick</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the POS mode that best fits your business operations
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone *</Label>
              <Select required>
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
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

