"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageCard } from "@/components/layouts/page-card"
import { PageHeader } from "@/components/layouts/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ExternalLink, Settings2, Globe } from "lucide-react"
import { storefrontService, type StorefrontAdmin } from "@/lib/services/storefrontService"
import { useToast } from "@/components/ui/use-toast"

export default function StorefrontSitesPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [sites, setSites] = useState<StorefrontAdmin[]>([])

  useEffect(() => {
    const loadSites = async () => {
      setIsLoading(true)
      try {
        const data = await storefrontService.listStorefronts()
        setSites(data)
      } catch (err: any) {
        toast({ title: "Failed to load sites", description: err.message, variant: "destructive" })
      } finally {
        setIsLoading(false)
      }
    }

    loadSites()
  }, [toast])

  return (
    <DashboardLayout>
      <PageCard className="mt-6">
        <PageHeader title="Storefront Sites" />

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin opacity-40" />
            <p className="text-sm">Loading sites...</p>
          </div>
        ) : sites.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Globe className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">No sites yet</p>
            <p className="mt-1 text-sm">Create your first storefront in settings.</p>
            <div className="mt-4">
              <Button asChild>
                <Link href="/dashboard/storefront/settings">Open Settings</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Site Name</th>
                  <th className="px-3 py-2 text-left font-medium">Slug</th>
                  <th className="px-3 py-2 text-left font-medium">Outlet</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site.id} className="border-b hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">{site.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{site.slug}</td>
                    <td className="px-3 py-2 text-muted-foreground">{site.outlet_name || "-"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={site.is_active ? "default" : "outline"}>
                        {site.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="icon" variant="outline" title="Edit site settings" aria-label="Edit site settings">
                          <Link href={`/dashboard/storefront/settings?site=${site.id}&tab=general`}>
                            <Settings2 className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild size="icon" title="View public site" aria-label="View public site">
                          <Link href={`/storefront/${site.slug}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>
    </DashboardLayout>
  )
}
