"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign, 
  FileText,
  Calendar,
  ClipboardList,
  Wallet
} from "lucide-react"
import { useEffect, useState } from "react"
import { DataExchangeModal } from "@/components/modals/data-exchange-modal"
import { dataExchangeConfigs } from "@/lib/utils/data-exchange-config"
import { OptionCard, type OptionCardProps } from "@/components/shared/option-card"
import { useI18n } from "@/contexts/i18n-context"
import { customerService } from "@/lib/services/customerService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"

interface ReportCard extends Omit<OptionCardProps, "iconSize"> {
  stats?: {
    label: string
    value: string
  }
}

export default function ReportsPage() {
  const { t } = useI18n()
  const [exportingReport, setExportingReport] = useState<string | null>(null)
  const { currentBusiness } = useBusinessStore()
  const useReal = useRealAPI()
  const [showCustomerReport, setShowCustomerReport] = useState(false)

  useEffect(() => {
    const checkCreditFeature = async () => {
      if (!currentBusiness || !useReal) {
        setShowCustomerReport(false)
        return
      }

      try {
        const response = await customerService.list({ tenant: currentBusiness.id, is_active: true })
        const customers = Array.isArray(response) ? response : response.results || []
        const hasCredit = customers.some((customer) => customer.credit_enabled)
        setShowCustomerReport(hasCredit)
      } catch (error) {
        console.error("Failed to check customer credit feature:", error)
        setShowCustomerReport(false)
      }
    }

    checkCreditFeature()
  }, [currentBusiness, useReal])

  const reportSections: { title: string; items: ReportCard[] }[] = [
    {
      title: "Sales",
      items: [
        {
          id: "daily-sales-summary",
          title: "Daily Sales Summary",
          icon: TrendingUp,
          href: "/dashboard/reports/sales",
        },
      ],
    },
    {
      title: "Cash & Shifts",
      items: [ 
        {
          id: "shift-report",
          title: "Shift Report",
          icon: Calendar,
          href: "/dashboard/office/shift-management/reports",
        },
        {
          id: "cash-summary",
          title: "Cash Summary",
          icon: DollarSign,
          href: "/dashboard/reports/financial",
        },
      ],
    },
    {
      title: "Inventory",
      items: [
        {
          id: "stock-valuation",
          title: "Stock Valuation",
          icon: ClipboardList,
          href: "/dashboard/office/reports/stock-valuation",
        },
      ],
    },
    {
      title: "Profit & Expenses",
      items: [
        {
          id: "profit-loss",
          title: "Profit & Loss",
          icon: Wallet,
          href: "/dashboard/reports/profit-loss",
        },
        {
          id: "expenses",
          title: "Expense Report",
          icon: FileText,
          href: "/dashboard/reports/expenses",
        },
      ],
    },
    {
      title: "Customers",
      items: [
        {
          id: "customers",
          title: "Customer & Credit Report",
          icon: Users,
          href: "/dashboard/reports/customers",
        },
      ],
    },
  ]

  return (
    <DashboardLayout>
      <PageLayout
        title={t("common.navigation.reports")}
        description={t("reports.description")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              {t("common.time.custom")}
            </Button>
            <Button variant="outline" size="sm">
              <FileText className="mr-2 h-4 w-4" />
              {t("reports.saved_reports")}
            </Button>
          </div>
        }
      >
        {/* Quick Stats Overview */}
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground">Overview</h2>
            <p className="text-xs text-muted-foreground">Today at a glance (illustrative)</p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Card className="bg-muted/30 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">{t("reports.stats.total_revenue")}</CardTitle>
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">MWK 89,456</div>
                <p className="text-xs text-muted-foreground">Overview figure</p>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">{t("reports.stats.total_transactions")}</CardTitle>
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">1,234</div>
                <p className="text-xs text-muted-foreground">Overview figure</p>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">{t("reports.stats.active_customers")}</CardTitle>
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">573</div>
                <p className="text-xs text-muted-foreground">Overview figure</p>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">{t("reports.stats.products_sold")}</CardTitle>
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">8,901</div>
                <p className="text-xs text-muted-foreground">Overview figure</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Report Cards Grid */}
        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-semibold">{t("reports.available_reports")}</h2>
            <p className="text-sm text-muted-foreground">Choose the report you want to review</p>
          </div>
          {reportSections
            .filter((section) => section.title !== "Customers" || showCustomerReport)
            .map((section) => (
            <div key={section.title} className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {section.items.map((report) => (
                  <OptionCard
                    key={report.id}
                    id={report.id}
                    title={report.title}
                    href={report.href}
                    icon={report.icon}
                    iconSize="sm"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </PageLayout>

      {/* Export Modal */}
      {exportingReport && (
        <DataExchangeModal
          open={!!exportingReport}
          onOpenChange={(open) => !open && setExportingReport(null)}
          type="export"
          config={dataExchangeConfigs.reports}
        />
      )}
    </DashboardLayout>
  )
}
