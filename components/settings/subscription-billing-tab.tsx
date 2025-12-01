"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Calendar, ArrowUp } from "lucide-react"
import { useState } from "react"
import { ConfirmSubscriptionUpgradeModal } from "@/components/modals/confirm-subscription-upgrade-modal"

export function SubscriptionBillingTab() {
  const [showUpgrade, setShowUpgrade] = useState(false)

  const currentPlan = {
    name: "Professional",
    price: 99,
    period: "month",
    features: [
      "Up to 5 Outlets",
      "Unlimited Products",
      "Advanced Reports",
      "Email Support",
    ],
    nextBilling: "2024-02-15",
  }

  const plans = [
    { name: "Starter", price: 49, period: "month", outlets: 1 },
    { name: "Professional", price: 99, period: "month", outlets: 5, current: true },
    { name: "Enterprise", price: 199, period: "month", outlets: "Unlimited" },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your active subscription details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">{currentPlan.name}</h3>
              <p className="text-muted-foreground">
                ${currentPlan.price}/{currentPlan.period}
              </p>
            </div>
            <Badge variant="default">Active</Badge>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Plan Features:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {currentPlan.features.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Next billing date:</span>
            <span className="font-medium">
              {new Date(currentPlan.nextBilling).toLocaleDateString()}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Payment method:</span>
            <span className="font-medium">•••• •••• •••• 4242</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>Upgrade or change your subscription plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`p-4 border rounded-lg ${
                  plan.current ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{plan.name}</h4>
                  {plan.current && <Badge>Current</Badge>}
                </div>
                <p className="text-2xl font-bold mb-1">
                  ${plan.price}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{plan.period}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {plan.outlets} Outlet{plan.outlets !== "Unlimited" && plan.outlets !== 1 ? "s" : ""}
                </p>
                {!plan.current && (
                  <Button
                    className="w-full"
                    variant={plan.name === "Enterprise" ? "default" : "outline"}
                    onClick={() => setShowUpgrade(true)}
                  >
                    <ArrowUp className="mr-2 h-4 w-4" />
                    {plan.name === "Enterprise" ? "Upgrade" : "Switch Plan"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ConfirmSubscriptionUpgradeModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
      />
    </div>
  )
}

