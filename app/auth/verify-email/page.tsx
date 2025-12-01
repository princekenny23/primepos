"use client"

import { AuthLayout } from "@/components/layouts/auth-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Mail, CheckCircle2, AlertCircle } from "lucide-react"
import { useState } from "react"

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleVerify = async () => {
    if (!token) {
      setError("Verification token is missing")
      return
    }

    setIsVerifying(true)
    setError(null)

    // In production, this would call API to verify email
    // Simulate API call
    setTimeout(() => {
      setIsVerifying(false)
      setIsVerified(true)
      // Auto redirect after 3 seconds
      setTimeout(() => {
        router.push("/auth/login?verified=true")
      }, 3000)
    }, 1500)
  }

  if (isVerified) {
    return (
      <AuthLayout>
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle>Email Verified!</CardTitle>
            <CardDescription>
              Your email has been successfully verified. You can now log in to your account.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col space-y-4">
            <Link href="/auth/login" className="w-full">
              <Button className="w-full">Go to Login</Button>
            </Link>
            <p className="text-sm text-muted-foreground text-center">
              Redirecting automatically in a few seconds...
            </p>
          </CardFooter>
        </Card>
      </AuthLayout>
    )
  }

  if (error) {
    return (
      <AuthLayout>
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle>Verification Failed</CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col space-y-4">
            <Button onClick={handleVerify} className="w-full" variant="outline">
              Try Again
            </Button>
            <Link href="/auth/register" className="text-sm text-primary hover:underline">
              Create a new account
            </Link>
          </CardFooter>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Mail className="h-16 w-16 text-primary" />
          </div>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            Click the button below to verify your email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center mb-4">
            We need to verify your email address to complete your registration. 
            This helps us keep your account secure.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button 
            onClick={handleVerify} 
            className="w-full" 
            disabled={isVerifying || !token}
          >
            {isVerifying ? "Verifying..." : "Verify Email"}
          </Button>
          {!token && (
            <p className="text-sm text-destructive text-center">
              Invalid verification link. Please check your email for the correct link.
            </p>
          )}
          <Link href="/auth/login" className="text-sm text-primary hover:underline">
            Already verified? Sign in
          </Link>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}

