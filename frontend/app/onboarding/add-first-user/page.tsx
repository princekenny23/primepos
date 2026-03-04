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
import { UserPlus, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { SuccessModal } from "@/components/modals/success-modal"
import { useBusinessStore } from "@/stores/businessStore"
import { useAuthStore } from "@/stores/authStore"
import { userService } from "@/lib/services/userService"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function AddFirstUserPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { user, refreshUser } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "admin" as "admin" | "manager" | "cashier" | "staff",
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
    
    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }
    
    // Validate password length
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }
    
    if (!currentBusiness) {
      setError("No business found. Please complete business setup first.")
      return
    }
    
    setIsLoading(true)
    
    try {
      // Combine first and last name for backend (which expects single 'name' field)
      const fullName = `${formData.firstName} ${formData.lastName}`.trim()
      
      // Create user via API
      const result = await userService.create({
        email: formData.email,
        name: fullName,
        phone: formData.phone || undefined,
        role: formData.role,
        tenant: currentBusiness.id,
        outlet: currentOutlet?.id, // Assign to current outlet if available
        password: formData.password, // Include password for manual creation
      })

      await refreshUser()
      
      console.log("User created successfully:", result.user.email)
      if (currentOutlet) {
        console.log("User assigned to outlet:", currentOutlet.name)
      }
      
      setIsLoading(false)
      setShowSuccess(true)
    } catch (err: any) {
      console.error("Error creating user:", err)
      setError(err.message || "Failed to create user. Please try again.")
      setIsLoading(false)
    }
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
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">First Name *</Label>
                <Input 
                  id="first-name" 
                  type="text" 
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last Name *</Label>
                <Input 
                  id="last-name" 
                  type="text" 
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
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
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input 
                id="phone" 
                type="tel" 
                placeholder="+265 123 456 789"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Create a strong password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select 
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as typeof formData.role })}
                required
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

