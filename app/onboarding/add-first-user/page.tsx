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
import { UserPlus, ArrowLeft, CheckCircle2 } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import { SuccessModal } from "@/components/modals/success-modal"

export default function AddFirstUserPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // In production, this would call API to create user
    setTimeout(() => {
      setIsLoading(false)
      setShowSuccess(true)
    }, 1000)
  }

  const handleSuccessClose = () => {
    setShowSuccess(false)
    router.push("/dashboard")
  }

  return (
    <AuthLayout>
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <UserPlus className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl">Add Your First User</CardTitle>
          </div>
          <CardDescription>
            Create an admin account to manage your business
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">First Name *</Label>
                <Input 
                  id="first-name" 
                  type="text" 
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last Name *</Label>
                <Input 
                  id="last-name" 
                  type="text" 
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="admin@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input 
                id="phone" 
                type="tel" 
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Create a strong password"
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters long
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password *</Label>
              <Input 
                id="confirm-password" 
                type="password" 
                placeholder="Confirm your password"
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select required>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="flex gap-4 w-full">
              <Link href="/onboarding/setup-outlet" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? "Creating Account..." : "Complete Setup"}
                <CheckCircle2 className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Step 3 of 3 - User Setup
            </p>
          </CardFooter>
        </form>
      </Card>

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

