"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageCard } from "@/components/layouts/page-card"
import { PageHeader } from "@/components/layouts/page-header"
import { storefrontService, type CatalogRule, type StorefrontAdmin } from "@/lib/services/storefrontService"
import { useToast } from "@/components/ui/use-toast"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { Loader2, Package, Plus } from "lucide-react"

export default function StorefrontCatalogPage() {
  const { toast } = useToast()
  const [sites, setSites] = useState<StorefrontAdmin[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>("")
  const [products, setProducts] = useState<Array<{ id: number; name: string; category_name: string }>>([])
  const [rules, setRules] = useState<CatalogRule[]>([])
  const [isLoadingSites, setIsLoadingSites] = useState(true)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)
  const [updatingProductId, setUpdatingProductId] = useState<number | null>(null)

  const selectedSite = useMemo(
    () => sites.find((site) => String(site.id) === selectedSiteId) || null,
    [sites, selectedSiteId]
  )

  useEffect(() => {
    const loadSites = async () => {
      setIsLoadingSites(true)
      try {
        const data = await storefrontService.listStorefronts()
        setSites(data)
        if (data.length > 0) {
          setSelectedSiteId(String(data[0].id))
        }
      } catch (err: any) {
        toast({ title: "Failed to load storefront sites", description: err.message, variant: "destructive" })
      } finally {
        setIsLoadingSites(false)
      }
    }

    loadSites()
  }, [toast])

  const loadCatalog = async () => {
    if (!selectedSite) {
      setProducts([])
      setRules([])
      return
    }

    setIsLoadingCatalog(true)
    try {
      const [rulesData, productResp] = await Promise.all([
        storefrontService.listRules(selectedSite.id),
        api.get<any>("/products/?page_size=500&is_active=true"),
      ])

      const productList = Array.isArray(productResp) ? productResp : (productResp.results || [])
      setRules(rulesData)
      setProducts(
        productList.map((product: any) => ({
          id: product.id,
          name: product.name,
          category_name: product.category_name || product.category?.name || "Uncategorized",
        }))
      )
    } catch (err: any) {
      toast({ title: "Failed to load catalog", description: err.message, variant: "destructive" })
      setProducts([])
      setRules([])
    } finally {
      setIsLoadingCatalog(false)
    }
  }

  useEffect(() => {
    loadCatalog()
  }, [selectedSiteId])

  const productRuleMap = new Map(
    rules
      .filter((rule) => rule.rule_type === "include" && rule.product != null)
      .map((rule) => [rule.product as number, rule])
  )

  const addToCatalog = async (productId: number) => {
    if (!selectedSite) return
    setUpdatingProductId(productId)
    try {
      const created = await storefrontService.addRule(selectedSite.id, {
        rule_type: "include",
        product: productId,
      })
      setRules((prev) => [...prev, created])
    } catch (err: any) {
      toast({ title: "Failed to add product", description: err.message, variant: "destructive" })
    } finally {
      setUpdatingProductId(null)
    }
  }

  const removeFromCatalog = async (ruleId: number, productId: number) => {
    if (!selectedSite) return
    setUpdatingProductId(productId)
    try {
      await storefrontService.deleteRule(selectedSite.id, ruleId)
      setRules((prev) => prev.filter((rule) => rule.id !== ruleId))
    } catch (err: any) {
      toast({ title: "Failed to remove product", description: err.message, variant: "destructive" })
    } finally {
      setUpdatingProductId(null)
    }
  }

  return (
    <DashboardLayout>
      <PageCard className="mt-6">
        <PageHeader title="Catalog" />

        {isLoadingSites ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
            Loading storefront sites...
          </div>
        ) : sites.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Package className="mx-auto mb-2 h-10 w-10 opacity-40" />
            No storefront sites found.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full sm:max-w-xs space-y-1">
                <Label htmlFor="catalog-site">Site</Label>
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                  <SelectTrigger id="catalog-site">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={String(site.id)}>
                        {site.name} ({site.slug})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" onClick={loadCatalog} disabled={isLoadingCatalog || !selectedSite}>
                {isLoadingCatalog && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Refresh
              </Button>
            </div>

            {isLoadingCatalog ? (
              <div className="py-12 text-center text-muted-foreground">Loading catalog...</div>
            ) : products.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Package className="mx-auto mb-2 h-10 w-10 opacity-40" />
                No products found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Product</th>
                      <th className="px-3 py-2 text-left font-medium">Category</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const activeRule = productRuleMap.get(product.id)
                      const inCatalog = Boolean(activeRule)

                      return (
                        <tr key={product.id} className="border-b">
                          <td className="px-3 py-2 font-medium">{product.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{product.category_name || "-"}</td>
                          <td className="px-3 py-2">
                            <Badge variant={inCatalog ? "default" : "outline"} className="text-xs">
                              {inCatalog ? "In Catalog" : "Not In Catalog"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {inCatalog ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => removeFromCatalog(activeRule!.id, product.id)}
                                disabled={updatingProductId === product.id}
                              >
                                {updatingProductId === product.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                                Remove
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => addToCatalog(product.id)}
                                disabled={updatingProductId === product.id}
                              >
                                {updatingProductId === product.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                                Add
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </PageCard>
    </DashboardLayout>
  )
}
