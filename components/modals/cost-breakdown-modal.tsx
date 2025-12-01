"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DollarSign, TrendingUp } from "lucide-react"

interface CostBreakdownModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  drink?: any
}

export function CostBreakdownModal({ open, onOpenChange, drink }: CostBreakdownModalProps) {
  if (!drink) return null

  // Mock cost breakdown
  const costBreakdown = [
    { item: "Bottle Cost", amount: 25.00, percentage: 100 },
    { item: "Per Shot Cost", amount: 1.56, percentage: 6.25 },
    { item: "Selling Price", amount: 8.00, percentage: 32 },
    { item: "Profit per Shot", amount: 6.44, percentage: 25.75 },
  ]

  const bottleToShot = drink.bottleToShot || 16
  const totalProfit = costBreakdown[3].amount * bottleToShot

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Breakdown - {drink.name}
          </DialogTitle>
          <DialogDescription>
            Detailed cost analysis and profit margins
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Drink Information</p>
            <p className="font-medium">{drink.name} ({drink.size})</p>
            <p className="text-sm text-muted-foreground">
              Bottle to Shot Ratio: {bottleToShot}:1
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costBreakdown.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{item.item}</TableCell>
                  <TableCell className="font-semibold">
                    ${item.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{item.percentage}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-200">
                  Total Profit per Bottle
                </span>
              </div>
              <span className="font-bold text-lg text-green-600">
                ${totalProfit.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              Based on {bottleToShot} shots per bottle
            </p>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Profit margin: {((costBreakdown[3].amount / costBreakdown[2].amount) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

