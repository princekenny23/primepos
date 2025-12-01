"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BusinessInfoTab } from "@/components/settings/business-info-tab"
import { OutletManagementTab } from "@/components/settings/outlet-management-tab"
import { TaxPricingTab } from "@/components/settings/tax-pricing-tab"
import { PaymentMethodsTab } from "@/components/settings/payment-methods-tab"
import { ReceiptTemplateTab } from "@/components/settings/receipt-template-tab"
import { SubscriptionBillingTab } from "@/components/settings/subscription-billing-tab"
import { IntegrationsTab } from "@/components/settings/integrations-tab"
import { NotificationsTab } from "@/components/settings/notifications-tab"

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your business settings and preferences</p>
        </div>

        <Tabs defaultValue="business" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="outlets">Outlets</TabsTrigger>
            <TabsTrigger value="tax">Tax & Pricing</TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
            <TabsTrigger value="receipt">Receipt</TabsTrigger>
            <TabsTrigger value="subscription">Billing</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <BusinessInfoTab />
          </TabsContent>

          <TabsContent value="outlets">
            <OutletManagementTab />
          </TabsContent>

          <TabsContent value="tax">
            <TaxPricingTab />
          </TabsContent>

          <TabsContent value="payment">
            <PaymentMethodsTab />
          </TabsContent>

          <TabsContent value="receipt">
            <ReceiptTemplateTab />
          </TabsContent>

          <TabsContent value="subscription">
            <SubscriptionBillingTab />
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationsTab />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
