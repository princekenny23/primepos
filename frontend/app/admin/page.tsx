"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/authStore"
import { tenantService } from "@/lib/services/tenantService"
import { adminService } from "@/lib/services/adminService"
import { api } from "@/lib/api"
import { Building2, Plus, Users, DollarSign, Store, TrendingUp, Loader2 } from "lucide-react"
import { useBusinessStore } from "@/stores/businessStore"
import Link from "next/link"
import type { Business } from "@/lib/types"

export default function AdminDashboard() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()
  const { setCurrentBusiness } = useBusinessStore()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [adminStats, setAdminStats] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login")
      return
    }
    
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]) // Only reload when auth status changes, not on modal close
  
  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Load tenants/businesses - always use real API for admin
      // Check if we have auth token, if not, show error
      const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
      if (!token) {
        setError("Please login to view tenants. Make sure you're logged in.")
        setIsLoading(false)
        return
      }
      
      // Always use real API - bypass useRealAPI() check for admin
      const tenantsData = await tenantService.list()
      // Handle paginated response
      const tenants = Array.isArray(tenantsData) 
        ? tenantsData 
        : ((tenantsData as any)?.results || [])
      setBusinesses(tenants)
      
      // Load platform analytics
      try {
        const stats = await adminService.getAnalytics()
        setAdminStats({
          totalBusinesses: stats.total_tenants,
          totalOutlets: stats.total_outlets,
          totalUsers: stats.total_users,
          totalRevenue: stats.total_revenue,
          businessesByType: stats.type_distribution.reduce((acc: any, item: any) => {
            acc[item.type] = item.count
            return acc
          }, { retail: 0, restaurant: 0, bar: 0 }),
          platformGrowth: [] // Will be empty initially
        })
      } catch (statsError) {
        console.error("Failed to load analytics:", statsError)
        // Set default stats if analytics fails
        setAdminStats({
          totalBusinesses: tenantsData.length,
          totalOutlets: 0,
          totalUsers: 0,
          totalRevenue: 0,
          businessesByType: { retail: 0, restaurant: 0, bar: 0 },
          platformGrowth: []
        })
      }
    } catch (error: any) {
      console.error("Failed to load data:", error)
      setError(error.message || "Failed to load data")
      setBusinesses([])
    } finally {
      setIsLoading(false)
    }
  }
  
  if (!isAuthenticated) {
    return null
  }
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }
  
  const filteredBusinesses = businesses.filter(business =>
    business.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    business.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    business.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">SaaS Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage all businesses on the platform
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/sync">
                <TrendingUp className="mr-2 h-4 w-4" />
                Sync Monitor
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/tenants">
                <Users className="mr-2 h-4 w-4" />
                Manage Tenants
              </Link>
            </Button>
            <Button asChild>
              <Link href="/onboarding/setup-business">
                <Plus className="mr-2 h-4 w-4" />
                Create Business
              </Link>
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="text-destructive">{error}</div>
            </CardContent>
          </Card>
        )}

        {/* Platform Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Businesses</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminStats?.totalBusinesses || businesses.length}</div>
              <p className="text-xs text-muted-foreground">
                Active businesses on platform
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Outlets</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminStats?.totalOutlets || 0}</div>
              <p className="text-xs text-muted-foreground">
                Across all businesses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminStats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                Platform users
              </p>
            </CardContent>
          </Card>

        </div>

        {/* Business Type Distribution */}
        {adminStats && (
          <Card>
            <CardHeader>
              <CardTitle>Businesses by Type</CardTitle>
              <CardDescription>Distribution across industries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-sm font-medium">Retail</span>
                  </div>
                  <span className="text-lg font-bold">{adminStats.businessesByType?.retail || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-sm font-medium">Restaurant</span>
                  </div>
                  <span className="text-lg font-bold">{adminStats.businessesByType?.restaurant || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-purple-500" />
                    <span className="text-sm font-medium">Bar</span>
                  </div>
                  <span className="text-lg font-bold">{adminStats.businessesByType?.bar || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Businesses Grid */}
        {filteredBusinesses.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredBusinesses.map((business) => (
              <Card 
                key={business.id}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                onClick={async () => {
                  // Set current business and redirect to its dashboard (Square POS-like)
                  try {
                    await setCurrentBusiness(business.id)
                    // Redirect immediately to the correct dashboard based on business type
                    if (business.type === "wholesale and retail") {
                      router.push("/dashboard")
                    } else if (business.type === "restaurant") {
                      router.push("/dashboard/restaurant/dashboard")
                    } else if (business.type === "bar") {
                      router.push("/dashboard/bar/dashboard")
                    } else {
                      router.push("/dashboard")
                    }
                  } catch (error) {
                    console.error("Failed to set business:", error)
                  }
                }}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{business.name}</CardTitle>
                        <CardDescription className="capitalize">{business.type || 'N/A'}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {business.type || 'N/A'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {business.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium">{business.email}</span>
                      </div>
                    )}
                    {business.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Phone:</span>
                        <span className="font-medium">{business.phone}</span>
                      </div>
                    )}
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(business.createdAt || Date.now()).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">
                  {searchTerm ? "No businesses found matching your search" : "No businesses yet"}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first tenant to get started
                </p>
                {!searchTerm && (
                  <Button asChild>
                    <Link href="/onboarding/setup-business">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Business
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}

