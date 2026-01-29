"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  Users, 
  Package, 
  Receipt, 
  DollarSign, 
  Store,
  FileText,
  Calendar,
  ClipboardList,
  ArrowRightLeft,
  BarChart3,
  Wallet
} from "lucide-react"
import { useState } from "react"
import { DataExchangeModal } from "@/components/modals/data-exchange-modal"
import { dataExchangeConfigs } from "@/lib/utils/data-exchange-config"
import { OptionCard, type OptionCardProps } from "@/components/shared/option-card"
import { useI18n } from "@/contexts/i18n-context"

interface ReportCard extends Omit<OptionCardProps, "iconSize"> {
  stats?: {
    label: string
    value: string
  }
}

export default function ReportsPage() {
  const { t } = useI18n()
  const [exportingReport, setExportingReport] = useState<string | null>(null)

  const reportCards: ReportCard[] = [
    {
      id: "sales",
      title: "Sales Report",
      titleKey: "reports.menu.sales",
      icon: TrendingUp,
      href: "/dashboard/reports/sales",
    },
    {
      id: "inventory-valuation",
      title: "Stock Valuation",
      titleKey: "reports.menu.stock_valuation",
      icon: ClipboardList,
      href: "/dashboard/reports/inventory-valuation",
    },
    {
      id: "stock-movement",
      title: "Stock Movement",
      titleKey: "reports.menu.stock_movement",
      icon: ArrowRightLeft,
      href: "/dashboard/reports/stock-movement",
    },
    {
      id: "products",
      title: "Products Report",
      titleKey: "reports.menu.products",
      icon: Package,
      href: "/dashboard/reports/products",
    },
    {
      id: "customers",
      title: "Customer Report",
      titleKey: "reports.menu.customers",
      icon: Users,
      href: "/dashboard/reports/customers",
    },
    {
      id: "inventory",
      title: "Inventory & Stock",
      titleKey: "reports.menu.inventory",
      icon: BarChart3,
      href: "/dashboard/reports/inventory",
    },
    {
      id: "profit-loss",
      title: "Profit & Loss",
      titleKey: "reports.menu.profit_loss",
      icon: Wallet,
      href: "/dashboard/reports/profit-loss",
    },
    {
      id: "tax",
      title: "Tax Report",
      titleKey: "reports.menu.tax",
      icon: Receipt,
      href: "/dashboard/reports/tax",
    },
    {
      id: "financial",
      title: "Financial Report",
      titleKey: "reports.menu.financial",
      icon: DollarSign,
      href: "/dashboard/reports/financial",
    },
    {
      id: "expenses",
      title: "Expenses Report",
      titleKey: "reports.menu.expenses",
      icon: FileText,
      href: "/dashboard/reports/expenses",
    },
    {
      id: "multi-outlet",
      title: "Multi-Outlet Report",
      titleKey: "reports.menu.multi_outlet",
      icon: Store,
      href: "/dashboard/reports/multi-outlet",
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
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("reports.stats.total_revenue")}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">MWK 89,456</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">+12.5%</span> {t("reports.stats.from_last_month")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("reports.stats.total_transactions")}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">+8.2%</span> {t("reports.stats.from_last_month")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("reports.stats.active_customers")}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">573</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">+5.1%</span> {t("reports.stats.from_last_month")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("reports.stats.products_sold")}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8,901</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">+15.3%</span> {t("reports.stats.from_last_month")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Report Cards Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4">{t("reports.available_reports")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportCards.map((report) => (
              <OptionCard
                key={report.id}
                id={report.id}
                title={report.title}
                titleKey={report.titleKey}
                href={report.href}
                icon={report.icon}
                iconSize="sm"
              />
            ))}
          </div>
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
