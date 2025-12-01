"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, DollarSign, Users, CheckCircle } from "lucide-react"
import { useState } from "react"
import { EditPlanModal } from "@/components/modals/edit-plan-modal"

export default function AdminPlansPage() {
  const [showEditPlan, setShowEditPlan] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<any>(null)

  // Mock plans data
  const plans = [
    {
      id: "1",
      name: "Starter",
      price: 49.00,
      billingCycle: "Monthly",
      features: ["Up to 2 outlets", "5 users", "Basic reports", "Email support"],
      tenants: 45,
      status: "Active",
    },
    {
      id: "2",
      name: "Professional",
      price: 99.00,
      billingCycle: "Monthly",
      features: ["Up to 5 outlets", "15 users", "Advanced reports", "Priority support", "API access"],
      tenants: 75,
      status: "Active",
    },
    {
      id: "3",
      name: "Enterprise",
      price: 299.00,
      billingCycle: "Monthly",
      features: ["Unlimited outlets", "Unlimited users", "Custom reports", "24/7 support", "API access", "Custom integrations"],
      tenants: 30,
      status: "Active",
    },
    {
      id: "4",
      name: "Trial",
      price: 0.00,
      billingCycle: "14 days",
      features: ["1 outlet", "2 users", "Basic features"],
      tenants: 12,
      status: "Active",
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Subscription Plans</h1>
            <p className="text-muted-foreground">Manage subscription plans and pricing</p>
          </div>
          <Button onClick={() => {
            setSelectedPlan(null)
            setShowEditPlan(true)
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Plan
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plans.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {plans.filter(p => p.status === "Active").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {plans.reduce((sum, p) => sum + p.tenants, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plans Table */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  <Badge variant={plan.status === "Active" ? "default" : "secondary"}>
                    {plan.status}
                  </Badge>
                </div>
                <CardDescription>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-bold">MWK {plan.price.toFixed(2)}</span>
                    <span className="text-sm text-muted-foreground">/{plan.billingCycle}</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Features:</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      {plan.tenants} tenant{plan.tenants !== 1 ? "s" : ""} on this plan
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelectedPlan(plan)
                      setShowEditPlan(true)
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Modals */}
      <EditPlanModal
        open={showEditPlan}
        onOpenChange={setShowEditPlan}
        plan={selectedPlan}
      />
    </DashboardLayout>
  )
}

