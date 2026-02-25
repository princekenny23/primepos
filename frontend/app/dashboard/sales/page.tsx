"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageCard } from "@/components/layouts/page-card"
import { PageHeader } from "@/components/layouts/page-header"
import { FilterableTabs, TabsContent } from "@/components/ui/filterable-tabs"
import TransactionsPage from "./transactions/page"
import ReturnsPage from "./returns/page"
import CreditsPage from "./credits/page"
import DiscountsPage from "./discounts/page"
import VoidsPage from "./voids/page"
import { useI18n } from "@/contexts/i18n-context"
import { useAuthStore } from "@/stores/authStore"
import { isTenantFeatureEnabled } from "@/lib/utils/tenant-permissions"

export default function SalesDashboardPage() {
  const { t } = useI18n()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState("sales")

  const tabs = [
    { value: "sales", label: t("sales.title"), enabled: isTenantFeatureEnabled(user, "allow_sales_create") },
    { value: "returns", label: t("sales.menu.returns"), enabled: isTenantFeatureEnabled(user, "allow_sales_refund") },
    { value: "credits", label: t("sales.credit.title"), enabled: isTenantFeatureEnabled(user, "allow_sales_create") },
    { value: "discounts", label: t("sales.menu.discounts"), enabled: isTenantFeatureEnabled(user, "allow_pos_discounts") },
    { value: "voids", label: "Voids", enabled: isTenantFeatureEnabled(user, "allow_sales_refund") },
  ]

  const visibleTabs = tabs.filter(tab => tab.enabled)

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some(tab => tab.value === activeTab)) {
      setActiveTab(visibleTabs[0].value)
    }
  }, [activeTab, visibleTabs])

  return (
    <DashboardLayout>
      <PageCard className="mt-6">
        <PageHeader title="Sales Management" />

        <FilterableTabs
          tabs={visibleTabs.map(({ value, label }) => ({ value, label }))}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="w-full"
          tabsListClassName="grid w-full h-9 items-center gap-1 rounded-md bg-gray-100 p-1"
        >
          {visibleTabs.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">No sales features enabled for this tenant.</div>
          )}
          <TabsContent value="sales" className="m-0">
            <TransactionsPage />
          </TabsContent>

          <TabsContent value="returns" className="m-0">
            <ReturnsPage />
          </TabsContent>

          <TabsContent value="credits" className="m-0">
            <CreditsPage />
          </TabsContent>

          <TabsContent value="discounts" className="m-0">
            <DiscountsPage />
          </TabsContent>

          <TabsContent value="voids" className="m-0">
            <VoidsPage />
          </TabsContent>
        </FilterableTabs>
      </PageCard>
    </DashboardLayout>
  )
}
