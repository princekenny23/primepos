"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Clock, User, Activity } from "lucide-react"
import { useState } from "react"
import { DatePickerWithRange } from "@/components/dashboard/date-range-filter"

export default function ActivityLogPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [userFilter, setUserFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
  })

  // Mock activity log data
  const activities = [
    {
      id: "1",
      type: "sale",
      action: "Sale Created",
      user: "John Manager",
      details: "Sale #1001 - $125.50",
      timestamp: "2024-01-15T10:30:00",
      outlet: "Downtown Branch",
    },
    {
      id: "2",
      type: "product",
      action: "Product Updated",
      user: "Jane Cashier",
      details: "Product A - Price changed to $29.99",
      timestamp: "2024-01-15T09:15:00",
      outlet: "Mall Location",
    },
    {
      id: "3",
      type: "stock",
      action: "Stock Adjusted",
      user: "Bob Supervisor",
      details: "Product B - Quantity: +50 units",
      timestamp: "2024-01-15T08:45:00",
      outlet: "Downtown Branch",
    },
    {
      id: "4",
      type: "customer",
      action: "Customer Added",
      user: "Alice Staff",
      details: "New customer: John Doe",
      timestamp: "2024-01-14T16:20:00",
      outlet: "Airport Kiosk",
    },
    {
      id: "5",
      type: "staff",
      action: "Staff Updated",
      user: "Charlie Admin",
      details: "Updated role for Jane Cashier",
      timestamp: "2024-01-14T14:10:00",
      outlet: "All Outlets",
    },
    {
      id: "6",
      type: "settings",
      action: "Settings Changed",
      user: "Charlie Admin",
      details: "Updated tax rate to 10%",
      timestamp: "2024-01-14T12:00:00",
      outlet: "All Outlets",
    },
  ]

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = 
      activity.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.details.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = typeFilter === "all" || activity.type === typeFilter
    const matchesUser = userFilter === "all" || activity.user === userFilter

    return matchesSearch && matchesType && matchesUser
  })

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "sale":
        return "💰"
      case "product":
        return "📦"
      case "stock":
        return "📊"
      case "customer":
        return "👤"
      case "staff":
        return "👥"
      case "settings":
        return "⚙️"
      default:
        return "📝"
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case "sale":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
      case "product":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
      case "stock":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
      case "customer":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200"
      case "staff":
        return "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200"
      case "settings":
        return "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-200"
      default:
        return ""
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Activity Log</h1>
          <p className="text-muted-foreground">Track all system activities and changes</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activities.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activities.filter(a => {
                  const today = new Date()
                  const activityDate = new Date(a.timestamp)
                  return activityDate.toDateString() === today.toDateString()
                }).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activities.filter(a => {
                  const weekAgo = new Date()
                  weekAgo.setDate(weekAgo.getDate() - 7)
                  return new Date(a.timestamp) >= weekAgo
                }).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(activities.map(a => a.user)).size}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="sale">Sales</SelectItem>
                  <SelectItem value="product">Products</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="customer">Customers</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                </SelectContent>
              </Select>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="User" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {Array.from(new Set(activities.map(a => a.user))).map(user => (
                    <SelectItem key={user} value={user}>{user}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Activity Log Table */}
        <Card>
          <CardHeader>
            <CardTitle>Activity History</CardTitle>
            <CardDescription>
              {filteredActivities.length} activit{filteredActivities.length !== 1 ? "ies" : "y"} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Outlet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(activity.timestamp).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getActivityColor(activity.type)}>
                        <span className="mr-1">{getActivityIcon(activity.type)}</span>
                        {activity.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{activity.action}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {activity.user}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{activity.details}</TableCell>
                    <TableCell>{activity.outlet}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

