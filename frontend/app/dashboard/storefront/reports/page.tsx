"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageCard } from "@/components/layouts/page-card"
import { PageHeader } from "@/components/layouts/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { api } from "@/lib/api"
import { storefrontService, type StorefrontAdmin, type StorefrontAnalytics, type StorefrontOrder } from "@/lib/services/storefrontService"
import { BarChart3, Boxes, Loader2, RefreshCw, ShoppingCart } from "lucide-react"

type BestSoldItem = {
  name: string
  quantity: number
  sales: number
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseAmount(raw: string) {
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function toStartOfDayIso(dateInput: string) {
  return new Date(`${dateInput}T00:00:00`).toISOString()
}

function toEndOfDayIso(dateInput: string) {
  return new Date(`${dateInput}T23:59:59.999`).toISOString()
}

function normalizeSaleItems(sale: any): Array<{ name: string; quantity: number; lineTotal: number }> {
  const rawItems = sale?.items || sale?.sale_items || sale?.lines || []
  if (!Array.isArray(rawItems)) return []

  return rawItems
    .map((item: any) => {
      const name =
        item?.product_name ||
        item?.name ||
        item?.product?.name ||
        item?.variation_name ||
        "Unknown Item"
      const quantity = Number(item?.quantity || item?.qty || 0)
      const lineTotal = Number(item?.total || item?.line_total || (item?.price || 0) * quantity)
      return {
        name,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        lineTotal: Number.isFinite(lineTotal) ? lineTotal : 0,
      }
    })
    .filter((item) => item.quantity > 0)
}

export default function StorefrontReportsPage() {
  const { toast } = useToast()
  const [sites, setSites] = useState<StorefrontAdmin[]>([])
  const [analytics, setAnalytics] = useState<StorefrontAnalytics | null>(null)
  const [orders, setOrders] = useState<StorefrontOrder[]>([])
  const [stockValue, setStockValue] = useState(0)
  const [bestSoldItems, setBestSoldItems] = useState<BestSoldItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const today = new Date()
  const defaultFrom = new Date(today)
  defaultFrom.setDate(defaultFrom.getDate() - 29)

  const [dateFrom, setDateFrom] = useState(toDateInputValue(defaultFrom))
  const [dateTo, setDateTo] = useState(toDateInputValue(today))

  const loadReport = async () => {
    if (!dateFrom || !dateTo) return
    if (dateFrom > dateTo) {
      toast({
        title: "Invalid date range",
        description: "From date must be earlier than To date.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const siteList = await storefrontService.listStorefronts()
      setSites(siteList)

      const [allOrders, analyticsList, productLists] = await Promise.all([
        storefrontService.listOrders(),
        Promise.all(siteList.map((site) => storefrontService.getAnalytics(site.id).catch(() => null as StorefrontAnalytics | null))),
        Promise.all(siteList.map((site) => storefrontService.getProducts(site.slug).catch(() => [] as any[]))),
      ])

      const fromIso = toStartOfDayIso(dateFrom)
      const toIso = toEndOfDayIso(dateTo)
      const filteredOrders = allOrders.filter((order) => order.created_at >= fromIso && order.created_at <= toIso)

      const mergedAnalytics = analyticsList.reduce<StorefrontAnalytics>(
        (acc, item) => {
          if (!item) return acc
          acc.events.storefront_view = (acc.events.storefront_view || 0) + (item.events?.storefront_view || 0)
          acc.events.product_view = (acc.events.product_view || 0) + (item.events?.product_view || item.events?.view_product || 0)
          acc.events.storefront_add_to_cart = (acc.events.storefront_add_to_cart || 0) + (item.events?.storefront_add_to_cart || item.events?.add_to_cart || 0)
          acc.order_counts = {
            created: (acc.order_counts?.created || 0) + (item.order_counts?.created || item.orders?.total || 0),
            pending: (acc.order_counts?.pending || 0) + (item.order_counts?.pending || item.orders?.pending || 0),
            confirmed: (acc.order_counts?.confirmed || 0) + (item.order_counts?.confirmed || item.orders?.confirmed || 0),
            cancelled: (acc.order_counts?.cancelled || 0) + (item.order_counts?.cancelled || item.orders?.cancelled || 0),
          }
          return acc
        },
        { period_days: 30, events: {}, order_counts: { created: 0, pending: 0, confirmed: 0, cancelled: 0 } }
      )

      const computedStockValue = productLists.flat().reduce((sum, product: any) => {
        const price = Number(product?.display_price || product?.retail_price || 0)
        const stock = Number(product?.stock || 0)
        if (!Number.isFinite(price) || !Number.isFinite(stock)) return sum
        return sum + (price * stock)
      }, 0)

      const saleIds = [...new Set(filteredOrders.map((order) => order.sale_id).filter((id) => Number.isFinite(id)))]
      const salesDetails = await Promise.all(
        saleIds.map((saleId) => api.get<any>(`/sales/${saleId}/`).catch(() => null))
      )

      const bestSoldMap = new Map<string, BestSoldItem>()
      salesDetails.forEach((sale) => {
        if (!sale) return
        const items = normalizeSaleItems(sale)
        items.forEach((item) => {
          const existing = bestSoldMap.get(item.name)
          if (!existing) {
            bestSoldMap.set(item.name, { name: item.name, quantity: item.quantity, sales: item.lineTotal })
          } else {
            existing.quantity += item.quantity
            existing.sales += item.lineTotal
          }
        })
      })

      const rankedBestSold = [...bestSoldMap.values()]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10)

      setOrders(filteredOrders)
      setAnalytics(mergedAnalytics)
      setStockValue(computedStockValue)
      setBestSoldItems(rankedBestSold)
    } catch (err: any) {
      toast({
        title: "Failed to load storefront reports",
        description: err?.message || "Could not load report data.",
        variant: "destructive",
      })
      setOrders([])
      setAnalytics(null)
      setStockValue(0)
      setBestSoldItems([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [])

  const totals = useMemo(() => {
    const totalSales = orders.reduce((sum, order) => sum + parseAmount(order.total), 0)
    const totalOrders = orders.length
    const views = analytics?.events?.storefront_view || 0
    return {
      totalSales,
      totalOrders,
      views,
    }
  }, [analytics, orders])

  const salesMovement = useMemo(() => {
    const map = new Map<string, number>()
    orders.forEach((order) => {
      const day = order.created_at.slice(0, 10)
      map.set(day, (map.get(day) || 0) + parseAmount(order.total))
    })

    const rows = [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({ date, amount }))

    const maxAmount = rows.reduce((max, row) => Math.max(max, row.amount), 0)
    return { rows, maxAmount }
  }, [orders])

  return (
    <DashboardLayout>
      <PageCard className="mt-6">
        <PageHeader title="Storefront Reports" />

        <div className="mb-5 mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="date-from">From</Label>
            <Input id="date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="date-to">To</Label>
            <Input id="date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex items-end justify-end">
            <Button variant="outline" onClick={loadReport} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Orders</p>
              <p className="mt-1 text-2xl font-semibold">{totals.totalOrders}</p>
              <ShoppingCart className="mt-2 h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Sales</p>
              <p className="mt-1 text-2xl font-semibold">{formatMoney(totals.totalSales)}</p>
              <BarChart3 className="mt-2 h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Stock Value</p>
              <p className="mt-1 text-2xl font-semibold">{formatMoney(stockValue)}</p>
              <Boxes className="mt-2 h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Storefront Views</p>
              <p className="mt-1 text-2xl font-semibold">{totals.views}</p>
              <p className="mt-2 text-xs text-muted-foreground">Across {sites.length} site(s)</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-semibold">Sales Movement</h3>
          {salesMovement.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales data in selected date range.</p>
          ) : (
            <div className="space-y-2">
              {salesMovement.rows.map((row) => (
                <div key={row.date} className="grid grid-cols-[90px_1fr_120px] items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{row.date}</span>
                  <div className="h-3 rounded bg-muted">
                    <div
                      className="h-3 rounded bg-primary"
                      style={{ width: `${salesMovement.maxAmount > 0 ? (row.amount / salesMovement.maxAmount) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-right font-medium">{formatMoney(row.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <h3 className="mb-3 text-sm font-semibold">Best Sold Items</h3>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Loading best sold items...
            </div>
          ) : bestSoldItems.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No sold item data for selected date range.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Item</th>
                  <th className="px-3 py-2 text-right font-medium">Qty Sold</th>
                  <th className="px-3 py-2 text-right font-medium">Sales</th>
                </tr>
              </thead>
              <tbody>
                {bestSoldItems.map((item) => (
                  <tr key={item.name} className="border-b hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatMoney(item.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </PageCard>
    </DashboardLayout>
  )
}
