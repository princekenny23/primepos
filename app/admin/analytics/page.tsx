"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, Users, Building2, DollarSign, CreditCard, Calendar } from "lucide-react"
import { SalesChart } from "@/components/dashboard/sales-chart"

export default function AdminAnalyticsPage() {
  // Mock analytics data
  const totalTenants = 150
  const activeTenants = 142
  const totalRevenue = 125000
  const monthlyRecurringRevenue = 45000
  const averageRevenuePerTenant = 833.33
  const churnRate = 2.5

  // Mock chart data
  const revenueData = [
    { name: "Jan", value: 35000 },
    { name: "Feb", value: 42000 },
    { name: "Mar", value: 38000 },
    { name: "Apr", value: 45000 },
    { name: "May", value: 50000 },
    { name: "Jun", value: 55000 },
  ]

  const tenantGrowthData = [
    { name: "Jan", value: 120 },
    { name: "Feb", value: 125 },
    { name: "Mar", value: 130 },
    { name: "Apr", value: 135 },
    { name: "May", value: 142 },
    { name: "Jun", value: 150 },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Platform Analytics</h1>
          <p className="text-muted-foreground">Comprehensive analytics and insights</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTenants}</div>
              <p className="text-xs text-muted-foreground">
                {activeTenants} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">MWK {totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MRR</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">MWK {monthlyRecurringRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Monthly recurring
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{churnRate}%</div>
              <p className="text-xs text-muted-foreground">
                Monthly
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="tenants">Tenant Growth</TabsTrigger>
            <TabsTrigger value="plans">Plan Distribution</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Monthly revenue over time</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesChart data={revenueData} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tenants" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tenant Growth</CardTitle>
                <CardDescription>Number of tenants over time</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesChart data={tenantGrowthData} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plans" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Plan Distribution</CardTitle>
                <CardDescription>Tenants by subscription plan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Starter</p>
                      <p className="text-sm text-muted-foreground">45 tenants</p>
                    </div>
                    <div className="text-2xl font-bold">30%</div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Professional</p>
                      <p className="text-sm text-muted-foreground">75 tenants</p>
                    </div>
                    <div className="text-2xl font-bold">50%</div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Enterprise</p>
                      <p className="text-sm text-muted-foreground">30 tenants</p>
                    </div>
                    <div className="text-2xl font-bold">20%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

