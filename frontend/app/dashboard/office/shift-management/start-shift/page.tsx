"use client"

import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StartShiftForm } from "@/components/pos/start-shift-form"
import { CheckCircle2, Store, Calendar, CreditCard, DollarSign, Info } from "lucide-react"
import { PageRefreshButton } from "@/components/dashboard/page-refresh-button"

export default function StartShiftPage() {
  const router = useRouter()

  const handleSuccess = () => {
    router.push("/dashboard/office/shift-management")
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Start Shift"
        description="Start a new shift for any outlet and till in your business"
        actions={<PageRefreshButton />}
      >

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Form Column - Takes 2 columns */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Start Day Shift</CardTitle>
                <CardDescription>
                  Fill in the details below to start your shift. You can select any outlet and till in your business.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StartShiftForm onSuccess={handleSuccess} redirectTo="shift-management" />
              </CardContent>
            </Card>
          </div>

          {/* Step Guide Column - Takes 1 column */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Start Guide</CardTitle>
                <CardDescription>
                  Follow these steps to start your shift
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {/* Step 1 */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                        1
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium text-sm">Select Outlet</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Choose the outlet where you&apos;ll be working today.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                        2
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium text-sm">Set Date</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select the operating date for this shift. Cannot be in the future.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                        3
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium text-sm">Choose Till</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Pick an available till. Tills already in use won&apos;t be selectable.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                        4
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium text-sm">Enter Cash Amounts</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Enter your opening cash balance. Floating cash is optional.
                      </p>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                        5
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium text-sm">Start Shift</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Review all details and click &quot;Start Shift&quot; to begin.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tips Section */}
                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Tips</h4>
                      <ul className="text-xs text-muted-foreground space-y-1.5">
                        <li className="flex items-start gap-2">
                          <span className="mt-1">•</span>
                          <span>Ensure the till is physically available before selecting it</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-1">•</span>
                          <span>Count your opening cash carefully for accurate records</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-1">•</span>
                          <span>Add notes if you need to record any special information</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-1">•</span>
                          <span>You can only have one active shift per till at a time</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageLayout>
    </DashboardLayout>
  )
}

