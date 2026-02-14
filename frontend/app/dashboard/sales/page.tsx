"use client"

import { useState } from "react"
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

export default function SalesDashboardPage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState("sales")

  const tabs = [
    { value: "sales", label: t("sales.title") },
    { value: "returns", label: t("sales.menu.returns") },
    { value: "credits", label: t("sales.credit.title") },
    { value: "discounts", label: t("sales.menu.discounts") },
    { value: "voids", label: "Voids" },
  ]

  return (
    <DashboardLayout>
      <PageCard className="mt-6">
        <PageHeader title="Sales Management" />

        <FilterableTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="w-full"
          tabsListClassName="grid w-full h-9 items-center gap-1 rounded-md bg-gray-100 p-1"
        >
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
