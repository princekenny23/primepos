"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StartShiftForm } from "@/components/pos/start-shift-form"
import { ShoppingCart } from "lucide-react"

export default function StartShiftPage() {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8">
        <div className="w-full max-w-2xl space-y-8">
          {/* Header Section */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">REGISTER CLOSED</h1>
              <p className="text-muted-foreground mt-2">
                Please start your day shift to begin selling
              </p>
            </div>
          </div>

          {/* Form Card */}
          <Card>
            <CardHeader>
              <CardTitle>Start Day Shift</CardTitle>
              <CardDescription>
                Fill in the details below to start your shift and begin processing sales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StartShiftForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}


