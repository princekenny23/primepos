"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  Users, 
  Package, 
  Receipt, 
  DollarSign, 
  Store,
  BarChart3,
  FileText,
  Calendar
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ExportReportModal } from "@/components/modals/export-report-modal"
import { cn } from "@/lib/utils"

interface ReportCard {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  bgColor: string
  iconColor: string
  textColor: string
  stats?: {
    label: string
    value: string
  }
}

const reportCards: ReportCard[] = [
  {
    id: "sales",
    title: "Sales Report",
    description: "Analyze sales performance, trends, and top-selling products",
    icon: TrendingUp,
    href: "/dashboard/reports/sales",
    bgColor: "bg-blue-900",
    iconColor: "text-white",
    textColor: "text-white",
    stats: {
      label: "This Month",
      value: "MWK 45,231"
    }
  },
  {
    id: "customers",
    title: "Customer Report",
    description: "Customer behavior, loyalty, and lifetime value insights",
    icon: Users,
    href: "/dashboard/reports/customers",
    bgColor: "bg-gray-100",
    iconColor: "text-gray-700",
    textColor: "text-foreground",
    stats: {
      label: "Active Customers",
      value: "573"
    }
  },
  {
    id: "inventory",
    title: "Inventory & Stock",
    description: "Stock levels, movement, and product performance",
    icon: Package,
    href: "/dashboard/reports/inventory",
    bgColor: "bg-blue-900",
    iconColor: "text-white",
    textColor: "text-white",
    stats: {
      label: "Total Products",
      value: "1,234"
    }
  },
  {
    id: "tax",
    title: "Tax Report",
    description: "Tax calculations, compliance, and tax summaries",
    icon: Receipt,
    href: "/dashboard/reports/tax",
    bgColor: "bg-gray-100",
    iconColor: "text-gray-700",
    textColor: "text-foreground",
    stats: {
      label: "This Month",
      value: "MWK 2,345"
    }
  },
  {
    id: "financial",
    title: "Financial Report",
    description: "Profit & loss, expenses, and comprehensive financial analysis",
    icon: DollarSign,
    href: "/dashboard/reports/financial",
    bgColor: "bg-blue-900",
    iconColor: "text-white",
    textColor: "text-white",
    stats: {
      label: "Net Profit",
      value: "MWK 12,456"
    }
  },
  {
    id: "multi-outlet",
    title: "Multi-Outlet Report",
    description: "Compare performance across all outlets and locations",
    icon: Store,
    href: "/dashboard/reports/multi-outlet",
    bgColor: "bg-gray-100",
    iconColor: "text-gray-700",
    textColor: "text-foreground",
    stats: {
      label: "Active Outlets",
      value: "5"
    }
  },
]

export default function ReportsPage() {
  const [exportingReport, setExportingReport] = useState<string | null>(null)

  const handleQuickExport = (reportId: string, reportTitle: string) => {
    setExportingReport(reportId)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive business insights and analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Date Range
            </Button>
            <Button variant="outline" size="sm">
              <FileText className="mr-2 h-4 w-4" />
              Saved Reports
            </Button>
          </div>
        </div>

        {/* Quick Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">MWK 89,456</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">+12.5%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">+8.2%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">573</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">+5.1%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Products Sold</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8,901</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">+15.3%</span> from last month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Report Cards Grid - Office Style */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Available Reports</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportCards.map((report) => {
              const Icon = report.icon
              const isFullColor = report.bgColor.includes("900")
              
              return (
                <Link
                  key={report.id}
                  href={report.href}
                  className="group block"
                >
                  <div
                    className={cn(
                      "relative h-52 rounded-xl shadow-md transition-all duration-200 hover:shadow-xl hover:scale-[1.02] cursor-pointer overflow-hidden",
                      report.bgColor
                    )}
                  >
                    {/* Icon Section - Centered */}
                    <div className={cn(
                      "absolute top-8 left-1/2 transform -translate-x-1/2",
                      isFullColor ? "opacity-100" : "opacity-90"
                    )}>
                      <Icon className={cn("h-12 w-12", report.iconColor)} />
                    </div>

                    {/* Title Section */}
                    <div className={cn(
                      "absolute bottom-0 left-0 right-0 p-5 rounded-b-xl",
                      isFullColor 
                        ? report.bgColor 
                        : "bg-white dark:bg-gray-900"
                    )}>
                      <h3 className={cn(
                        "font-semibold text-lg text-center",
                        isFullColor ? report.textColor : "text-foreground"
                      )}>
                        {report.title}
                      </h3>
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {exportingReport && (
        <ExportReportModal
          open={!!exportingReport}
          onOpenChange={(open) => !open && setExportingReport(null)}
          reportType={reportCards.find(r => r.id === exportingReport)?.title || "Report"}
        />
      )}
    </DashboardLayout>
  )
}
