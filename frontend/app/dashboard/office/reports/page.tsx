"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  Users, 
  Package, 
  Receipt, 
  FileText,
  Calendar,
  Clock,
  ArrowRightLeft,
  ClipboardList,
  Wallet
} from "lucide-react"
import { DataExchangeModal } from "@/components/modals/data-exchange-modal"
import { dataExchangeConfigs } from "@/lib/utils/data-exchange-config"
import { OptionCard, type OptionCardProps } from "@/components/shared/option-card"
import { useI18n } from "@/contexts/i18n-context"

interface ReportCard extends Omit<OptionCardProps, "iconSize"> {
  titleKey: string
}

export default function OfficeReportsPage() {
  const { t } = useI18n()
  const [exportingReport, setExportingReport] = useState<string | null>(null)

  const reportCards: ReportCard[] = [
    {
      id: "sales",
      title: "Sales Report",
      titleKey: "reports.menu.sales",
      icon: TrendingUp,
      href: "/dashboard/office/reports/sales",
    },
    {
      id: "inventory-valuation",
      title: "Stock Valuation",
      titleKey: "reports.menu.stock_valuation",
      icon: ClipboardList,
      href: "/dashboard/reports/inventory-valuation",
    },
    {
      id: "customers",
      title: "Customer Report",
      titleKey: "reports.menu.customers",
      icon: Users,
      href: "/dashboard/office/reports/customers",
    },
    {
      id: "products",
      title: "Products Report",
      titleKey: "reports.menu.products",
      icon: Package,
      href: "/dashboard/office/reports/products",
    },
    {
      id: "stock-movement",
      title: "Stock Movement",
      titleKey: "reports.menu.stock_movement",
      icon: ArrowRightLeft,
      href: "/dashboard/office/reports/stock-movement",
    },
    {
      id: "profit-loss",
      title: "Profit & Loss",
      titleKey: "reports.menu.profit_loss",
      icon: Wallet,
      href: "/dashboard/office/reports/profit-loss",
    },
    {
      id: "expenses",
      title: "Expenses ",
      titleKey: "reports.menu.expenses",
      icon: Receipt,
      href: "/dashboard/office/reports/expenses",
    },
    {
      id: "shift-reports",
      title: "Shift Reports",
      titleKey: "reports.menu.shift_reports",
      icon: Clock,
      href: "/dashboard/office/shift-management",
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
        {/* Report Cards Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4">{t("reports.available_reports")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
