"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Grid, Users, Clock, ArrowLeftRight, Merge } from "lucide-react"
import { useState } from "react"
import { AddEditTableModal } from "@/components/modals/add-edit-table-modal"
import { MergeSplitTablesModal } from "@/components/modals/merge-split-tables-modal"
import { TransferTableModal } from "@/components/modals/transfer-table-modal"

export default function TablesPage() {
  const [showAddTable, setShowAddTable] = useState(false)
  const [showMergeSplit, setShowMergeSplit] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [selectedTable, setSelectedTable] = useState<any>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // Mock tables data
  const tables = [
    { id: "1", number: 1, capacity: 4, status: "Occupied", orderId: "#ORD-001", guests: 3, time: "10:30" },
    { id: "2", number: 2, capacity: 2, status: "Available", orderId: null, guests: 0, time: null },
    { id: "3", number: 3, capacity: 6, status: "Reserved", orderId: null, guests: 0, time: "12:00" },
    { id: "4", number: 4, capacity: 4, status: "Occupied", orderId: "#ORD-002", guests: 4, time: "11:15" },
    { id: "5", number: 5, capacity: 2, status: "Available", orderId: null, guests: 0, time: null },
    { id: "6", number: 6, capacity: 8, status: "Occupied", orderId: "#ORD-003", guests: 6, time: "09:45" },
    { id: "7", number: 7, capacity: 4, status: "Available", orderId: null, guests: 0, time: null },
    { id: "8", number: 8, capacity: 2, status: "Occupied", orderId: "#ORD-004", guests: 2, time: "11:30" },
  ]

  const occupiedCount = tables.filter(t => t.status === "Occupied").length
  const availableCount = tables.filter(t => t.status === "Available").length
  const reservedCount = tables.filter(t => t.status === "Reserved").length

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Occupied":
        return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-red-200 dark:border-red-800"
      case "Reserved":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800"
      case "Available":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 border-green-200 dark:border-green-800"
      default:
        return ""
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Table Management</h1>
            <p className="text-muted-foreground">Manage restaurant tables and seating</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>
              <Grid className="mr-2 h-4 w-4" />
              {viewMode === "grid" ? "List View" : "Grid View"}
            </Button>
            <Button onClick={() => {
              setSelectedTable(null)
              setShowAddTable(true)
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Table
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
              <Grid className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tables.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupied</CardTitle>
              <Users className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{occupiedCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{availableCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reserved</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{reservedCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Table Layout */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Table Layout</CardTitle>
                <CardDescription>Click on a table to manage it</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowMergeSplit(true)}>
                  <Merge className="mr-2 h-4 w-4" />
                  Merge/Split
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowTransfer(true)}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Transfer
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {tables.map((table) => (
                  <div
                    key={table.id}
                    className={`p-4 border-2 rounded-lg cursor-pointer hover:shadow-md transition-all text-center ${
                      getStatusColor(table.status)
                    }`}
                    onClick={() => {
                      setSelectedTable(table)
                      setShowAddTable(true)
                    }}
                  >
                    <div className="font-bold text-lg mb-1">Table {table.number}</div>
                    <div className="text-xs mb-2">
                      <Users className="h-3 w-3 inline mr-1" />
                      {table.capacity} seats
                    </div>
                    {table.status === "Occupied" && (
                      <div className="text-xs space-y-1">
                        <div>{table.guests} guests</div>
                        <div>{table.orderId}</div>
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" />
                          {table.time}
                        </div>
                      </div>
                    )}
                    {table.status === "Reserved" && (
                      <div className="text-xs">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {table.time}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {tables.map((table) => (
                  <div
                    key={table.id}
                    className={`p-4 border rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                      table.status === "Occupied" ? "border-red-200" :
                      table.status === "Reserved" ? "border-yellow-200" :
                      "border-green-200"
                    }`}
                    onClick={() => {
                      setSelectedTable(table)
                      setShowAddTable(true)
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="font-bold text-lg">Table {table.number}</div>
                        <Badge className={getStatusColor(table.status)}>
                          {table.status}
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          Capacity: {table.capacity}
                        </div>
                        {table.status === "Occupied" && (
                          <>
                            <div className="text-sm">
                              {table.guests} guests • {table.orderId}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Since {table.time}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <AddEditTableModal
        open={showAddTable}
        onOpenChange={setShowAddTable}
        table={selectedTable}
      />
      <MergeSplitTablesModal
        open={showMergeSplit}
        onOpenChange={setShowMergeSplit}
      />
      <TransferTableModal
        open={showTransfer}
        onOpenChange={setShowTransfer}
      />
    </DashboardLayout>
  )
}

