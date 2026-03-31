"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RefreshCw, RotateCw, Search, ShieldAlert } from "lucide-react"
import { syncAdminService, type SyncHealthMetrics, type SyncRejectedEvent } from "@/lib/services/syncAdminService"

export default function AdminSyncMonitorPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isRequeuing, setIsRequeuing] = useState(false)
  const [metrics, setMetrics] = useState<SyncHealthMetrics | null>(null)
  const [events, setEvents] = useState<SyncRejectedEvent[]>([])
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [tenantInput, setTenantInput] = useState("")
  const [tenantFilter, setTenantFilter] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalCount, setTotalCount] = useState(0)

  const loadData = useCallback(async (options?: { pageOverride?: number; pageSizeOverride?: number; tenantOverride?: string }) => {
    const nextPage = options?.pageOverride ?? page
    const nextPageSize = options?.pageSizeOverride ?? pageSize
    const nextTenant = options?.tenantOverride ?? tenantFilter
    const offset = (nextPage - 1) * nextPageSize

    setIsLoading(true)
    try {
      const [healthResponse, rejectedResponse] = await Promise.all([
        syncAdminService.getHealth(nextTenant || undefined),
        syncAdminService.getRejectedEvents({
          tenantId: nextTenant || undefined,
          limit: nextPageSize,
          offset,
        }),
      ])

      setMetrics(healthResponse.metrics)
      setEvents(Array.isArray(rejectedResponse.results) ? rejectedResponse.results : [])
      setTotalCount(Number(rejectedResponse.count || 0))
    } catch (error) {
      console.error("Failed to load sync monitor data:", error)
      setMetrics(null)
      setEvents([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, tenantFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setSelectedIds([])
  }, [events])

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return events
    return events.filter((event) => {
      return (
        String(event.client_event_id || "").toLowerCase().includes(query) ||
        String(event.event_type || "").toLowerCase().includes(query) ||
        String(event.tenant_name || "").toLowerCase().includes(query) ||
        String(event.outlet_name || "").toLowerCase().includes(query) ||
        String(event.detail || "").toLowerCase().includes(query)
      )
    })
  }, [events, search])

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredEvents.map((event) => event.id)
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)))
      return
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])))
  }

  const handleRequeue = async () => {
    if (selectedIds.length === 0) return
    setIsRequeuing(true)
    try {
      await syncAdminService.requeueEvents(selectedIds)
      setSelectedIds([])
      await loadData()
    } catch (error) {
      console.error("Failed to requeue events:", error)
    } finally {
      setIsRequeuing(false)
    }
  }

  const allFilteredSelected =
    filteredEvents.length > 0 && filteredEvents.every((event) => selectedIds.includes(event.id))

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const pageStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const pageEnd = Math.min(page * pageSize, totalCount)
  const canPrev = page > 1
  const canNext = page < totalPages

  const applyTenantFilter = async () => {
    const nextTenant = tenantInput.trim()
    setTenantFilter(nextTenant)
    setPage(1)
    await loadData({ pageOverride: 1, tenantOverride: nextTenant })
  }

  const clearTenantFilter = async () => {
    setTenantInput("")
    setTenantFilter("")
    setPage(1)
    await loadData({ pageOverride: 1, tenantOverride: "" })
  }

  const handlePageSizeChange = async (value: string) => {
    const nextSize = Number(value)
    if (!Number.isFinite(nextSize) || nextSize <= 0) return
    setPageSize(nextSize)
    setPage(1)
    await loadData({ pageOverride: 1, pageSizeOverride: nextSize })
  }

  const goToPrevPage = async () => {
    if (!canPrev) return
    const nextPage = page - 1
    setPage(nextPage)
    await loadData({ pageOverride: nextPage })
  }

  const goToNextPage = async () => {
    if (!canNext) return
    const nextPage = page + 1
    setPage(nextPage)
    await loadData({ pageOverride: nextPage })
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Sync Monitor"
        description="Monitor rejected offline sync events and requeue failed items"
      >
        <div className="grid gap-4 md:grid-cols-4 mb-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Accepted</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{metrics?.accepted_events ?? 0}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Rejected</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-red-700">{metrics?.rejected_events ?? 0}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Duplicates</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{metrics?.duplicate_events ?? 0}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Latest Cursor</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{metrics?.latest_cursor ?? 0}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-700" />
                Rejected Sync Events
              </CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  value={tenantInput}
                  onChange={(event) => setTenantInput(event.target.value)}
                  placeholder="Tenant ID"
                  className="w-[170px]"
                />
                <Button variant="outline" onClick={applyTenantFilter} disabled={isLoading}>
                  Apply Tenant
                </Button>
                <Button variant="ghost" onClick={clearTenantFilter} disabled={isLoading || !tenantFilter}>
                  Clear
                </Button>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search rejected events"
                    className="pl-8 w-[260px]"
                  />
                </div>
                <Button variant="outline" onClick={() => void loadData()} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button onClick={handleRequeue} disabled={isRequeuing || selectedIds.length === 0}>
                  <RotateCw className={`h-4 w-4 mr-2 ${isRequeuing ? "animate-spin" : ""}`} />
                  Requeue Selected ({selectedIds.length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="text-sm text-muted-foreground">
                {tenantFilter ? `Tenant: ${tenantFilter} • ` : ""}
                Showing {pageStart}-{pageEnd} of {totalCount}
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="page-size" className="text-sm text-muted-foreground">Page Size</label>
                <select
                  id="page-size"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={String(pageSize)}
                  onChange={(event) => void handlePageSizeChange(event.target.value)}
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
                <Button variant="outline" onClick={goToPrevPage} disabled={isLoading || !canPrev}>Previous</Button>
                <div className="text-sm text-muted-foreground min-w-[70px] text-center">Page {page} / {totalPages}</div>
                <Button variant="outline" onClick={goToNextPage} disabled={isLoading || !canNext}>Next</Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      title="Select all filtered"
                    />
                  </TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Retries</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Processed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      {isLoading ? "Loading rejected events..." : "No rejected sync events."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(event.id)}
                          onChange={() => toggleSelection(event.id)}
                          title={`Select event ${event.id}`}
                        />
                      </TableCell>
                      <TableCell>{event.id}</TableCell>
                      <TableCell>{event.tenant_name || event.tenant_id}</TableCell>
                      <TableCell>{event.outlet_name || event.outlet_id || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{event.event_type}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-red-100 text-red-900 border-red-300">
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{event.retry_count}</TableCell>
                      <TableCell className="max-w-[340px] truncate" title={event.detail}>{event.detail}</TableCell>
                      <TableCell>{new Date(event.processed_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageLayout>
    </DashboardLayout>
  )
}
