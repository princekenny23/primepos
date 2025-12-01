"use client"

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
import { Plus, CreditCard, Smartphone, DollarSign, Trash2 } from "lucide-react"
import { useState } from "react"
import { AddPaymentMethodModal } from "@/components/modals/add-payment-method-modal"

export function PaymentMethodsTab() {
  const [showAddMethod, setShowAddMethod] = useState(false)

  // Mock payment methods
  const paymentMethods = [
    { id: "1", name: "Cash", type: "Cash", status: "Active", icon: DollarSign },
    { id: "2", name: "Credit/Debit Card", type: "Card", status: "Active", icon: CreditCard },
    { id: "3", name: "Mobile Money", type: "Mobile", status: "Active", icon: Smartphone },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Manage accepted payment methods</CardDescription>
          </div>
          <Button onClick={() => setShowAddMethod(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Payment Method
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Method</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentMethods.map((method) => {
              const Icon = method.icon
              return (
                <TableRow key={method.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{method.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{method.type}</TableCell>
                  <TableCell>
                    <Badge variant={method.status === "Active" ? "default" : "secondary"}>
                      {method.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>

      <AddPaymentMethodModal
        open={showAddMethod}
        onOpenChange={setShowAddMethod}
      />
    </Card>
  )
}

