"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DateRangeFilter } from "@/components/dashboard/date-range-filter"
import { Button } from "@/components/ui/button"
import { Download, Printer, Settings } from "lucide-react"
import { useState } from "react"

interface ReportFiltersProps {
  onExport?: () => void
  onPrint?: () => void
  onSettings?: () => void
}

export function ReportFilters({ onExport, onPrint, onSettings }: ReportFiltersProps) {
  const [dateRange, setDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date(),
  })
  const [outlet, setOutlet] = useState<string>("all")
  const [staff, setStaff] = useState<string>("all")
  const [category, setCategory] = useState<string>("all")
  const [paymentMethod, setPaymentMethod] = useState<string>("all")

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Date Range</label>
            <DateRangeFilter
              onRangeChange={setDateRange}
            />
          </div>

          <div className="w-[180px]">
            <label className="text-sm font-medium mb-2 block">Outlet</label>
            <Select value={outlet} onValueChange={setOutlet}>
              <SelectTrigger>
                <SelectValue placeholder="All Outlets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outlets</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-[180px]">
            <label className="text-sm font-medium mb-2 block">Staff</label>
            <Select value={staff} onValueChange={setStaff}>
              <SelectTrigger>
                <SelectValue placeholder="All Staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-[180px]">
            <label className="text-sm font-medium mb-2 block">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-[180px]">
            <label className="text-sm font-medium mb-2 block">Payment Method</label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            {onExport && (
              <Button variant="outline" onClick={onExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}
            {onPrint && (
              <Button variant="outline" onClick={onPrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            )}
            {onSettings && (
              <Button variant="outline" onClick={onSettings}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

