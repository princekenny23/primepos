"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Award, Users, TrendingUp, Settings } from "lucide-react"
import { useState } from "react"
import { AdjustLoyaltyPointsModal } from "@/components/modals/adjust-loyalty-points-modal"

export default function LoyaltyPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showAdjustPoints, setShowAdjustPoints] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)

  // Mock loyalty program data
  const loyaltyProgram = {
    enabled: true,
    pointsPerDollar: 1,
    redemptionRate: 100, // points per dollar
    tiers: [
      { name: "Bronze", minPoints: 0, discount: 0 },
      { name: "Silver", minPoints: 500, discount: 5 },
      { name: "Gold", minPoints: 1000, discount: 10 },
      { name: "Platinum", minPoints: 2500, discount: 15 },
    ],
  }

  // Mock customers with loyalty points
  const customers = [
    { id: "1", name: "John Doe", email: "john@example.com", points: 1250, tier: "Gold", totalSpent: 4523.50 },
    { id: "2", name: "Jane Smith", email: "jane@example.com", points: 890, tier: "Silver", totalSpent: 3210.75 },
    { id: "3", name: "Bob Johnson", email: "bob@example.com", points: 2340, tier: "Platinum", totalSpent: 6789.25 },
    { id: "4", name: "Alice Williams", email: "alice@example.com", points: 450, tier: "Bronze", totalSpent: 1234.00 },
  ]

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPoints = customers.reduce((sum, c) => sum + c.points, 0)
  const activeMembers = customers.length

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "Platinum":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200"
      case "Gold":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
      case "Silver":
        return "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-200"
      default:
        return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Loyalty Program</h1>
            <p className="text-muted-foreground">Manage customer loyalty points and rewards</p>
          </div>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Program Settings
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeMembers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Points</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPoints.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points Per Dollar</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loyaltyProgram.pointsPerDollar}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Redemption Rate</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loyaltyProgram.redemptionRate} pts = $1
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Program Info */}
        <Card>
          <CardHeader>
            <CardTitle>Loyalty Tiers</CardTitle>
            <CardDescription>Customer tiers and benefits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {loyaltyProgram.tiers.map((tier, idx) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">{tier.name}</h4>
                  <p className="text-sm text-muted-foreground mb-1">
                    Min Points: {tier.minPoints.toLocaleString()}
                  </p>
                  <p className="text-sm font-medium">
                    Discount: {tier.discount}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer name or email..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Loyalty Members</CardTitle>
            <CardDescription>
              {filteredCustomers.length} member{filteredCustomers.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-yellow-500" />
                        <span className="font-semibold">{customer.points.toLocaleString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTierColor(customer.tier)}>
                        {customer.tier}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      MWK {customer.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setShowAdjustPoints(true)
                        }}
                      >
                        Adjust Points
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <AdjustLoyaltyPointsModal
        open={showAdjustPoints}
        onOpenChange={setShowAdjustPoints}
        customer={selectedCustomer}
      />
    </DashboardLayout>
  )
}

