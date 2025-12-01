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
import { Plus, Search, CreditCard, Clock, DollarSign } from "lucide-react"
import { useState } from "react"
import { OpenTabModal } from "@/components/modals/open-tab-modal"
import { CloseTabModal } from "@/components/modals/close-tab-modal"

export default function TabsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showOpenTab, setShowOpenTab] = useState(false)
  const [showCloseTab, setShowCloseTab] = useState(false)
  const [selectedTab, setSelectedTab] = useState<any>(null)

  // Mock tabs data
  const tabs = [
    {
      id: "1",
      tabNumber: "TAB-001",
      customer: "John Doe",
      opened: "2024-01-15T10:30:00",
      items: 5,
      total: 125.50,
      status: "Open",
      bartender: "Jane Bartender",
    },
    {
      id: "2",
      tabNumber: "TAB-002",
      customer: "Bob Johnson",
      opened: "2024-01-15T11:15:00",
      items: 3,
      total: 67.50,
      status: "Open",
      bartender: "Alice Staff",
    },
    {
      id: "3",
      tabNumber: "TAB-003",
      customer: "Jane Smith",
      opened: "2024-01-15T09:45:00",
      items: 8,
      total: 189.99,
      status: "Closed",
      bartender: "John Waiter",
      closed: "2024-01-15T12:30:00",
    },
  ]

  const filteredTabs = tabs.filter(tab =>
    tab.tabNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tab.customer.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const openTabs = tabs.filter(t => t.status === "Open")
  const totalOpen = openTabs.reduce((sum, t) => sum + t.total, 0)

  const getTimeOpen = (opened: string) => {
    const openedDate = new Date(opened)
    const now = new Date()
    const diff = now.getTime() - openedDate.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bar Tabs</h1>
            <p className="text-muted-foreground">Manage customer tabs and payments</p>
          </div>
          <Button onClick={() => setShowOpenTab(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Open Tab
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Tabs</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openTabs.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Open Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">MWK {totalOpen.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tabs</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tabs.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Tab Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2h 15m</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by tab number or customer..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Tabs</CardTitle>
            <CardDescription>
              {filteredTabs.length} tab{filteredTabs.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tab Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Time Open</TableHead>
                  <TableHead>Bartender</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTabs.map((tab) => (
                  <TableRow key={tab.id}>
                    <TableCell className="font-medium">{tab.tabNumber}</TableCell>
                    <TableCell>{tab.customer}</TableCell>
                    <TableCell>
                      {new Date(tab.opened).toLocaleString()}
                    </TableCell>
                    <TableCell>{tab.items}</TableCell>
                    <TableCell className="font-semibold">
                      MWK {tab.total.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {tab.status === "Open" ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {getTimeOpen(tab.opened)}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {tab.closed && new Date(tab.closed).toLocaleTimeString()}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{tab.bartender}</TableCell>
                    <TableCell>
                      <Badge variant={tab.status === "Open" ? "default" : "secondary"}>
                        {tab.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tab.status === "Open" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTab(tab)
                            setShowCloseTab(true)
                          }}
                        >
                          Close Tab
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm">View</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <OpenTabModal
        open={showOpenTab}
        onOpenChange={setShowOpenTab}
      />
      <CloseTabModal
        open={showCloseTab}
        onOpenChange={setShowCloseTab}
        tab={selectedTab}
      />
    </DashboardLayout>
  )
}

