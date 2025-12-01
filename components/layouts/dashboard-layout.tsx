"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  Settings,
  Store,
  Menu,
  X,
  Search,
  User,
  LogOut,
  History,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useTenant } from "@/contexts/tenant-context"
import { useRole } from "@/contexts/role-context"
import { NotificationBell } from "@/components/dashboard/notification-bell"
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb"
import { RoleSwitcher } from "@/components/dashboard/role-switcher"
import { useShift } from "@/contexts/shift-context"
import { format } from "date-fns"
import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface DashboardLayoutProps {
  children: React.ReactNode
}

// Full navigation menu (for Admin)
const fullNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { name: "Sales", href: "/dashboard/sales", icon: ShoppingCart, permission: "sales" },
  { name: "POS", href: "/dashboard/pos", icon: ShoppingCart, permission: "pos" },
  { name: "Products", href: "/dashboard/products", icon: Package, permission: "products" },
  { name: "Inventory", href: "/dashboard/inventory", icon: Package, permission: "inventory" },
  { name: "Outlets", href: "/dashboard/outlets", icon: Store, permission: "outlets" },
  { name: "Reports", href: "/dashboard/reports", icon: BarChart3, permission: "reports" },
  { name: "Shift History", href: "/dashboard/shift-history", icon: History, permission: "pos" },
  { name: "CRM", href: "/dashboard/customers", icon: Users, permission: "crm" },
  { name: "Staff", href: "/dashboard/staff", icon: Users, permission: "staff" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, permission: "settings" },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { currentTenant, currentOutlet, outlets, switchOutlet, isLoading } = useTenant()
  const { hasPermission, role } = useRole()
  const { activeShift } = useShift()

  // Filter navigation based on user role
  const navigation = fullNavigation.filter((item) => hasPermission(item.permission))

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-20 bg-card border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary text-primary-foreground text-lg font-bold">
                P
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-8 w-8"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-lg text-xs font-medium transition-colors min-h-[72px]",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  title={item.name}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="text-[10px] leading-tight text-center">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* User Section */}
          <div className="p-2 border-t">
            <div className="flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-lg hover:bg-accent transition-colors">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">User</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-20">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-background border-b">
          <div className="flex items-center justify-between px-4 py-3 lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Outlet Selector */}
            {!isLoading && currentOutlet && (
              <div className="flex items-center gap-2 mr-4">
                <Store className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={currentOutlet.id}
                  onValueChange={switchOutlet}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue>
                      <span className="font-medium">{currentOutlet.name}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {outlets
                      .filter((outlet) => outlet.isActive)
                      .map((outlet) => (
                        <SelectItem key={outlet.id} value={outlet.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{outlet.name}</span>
                            <span className="text-xs text-muted-foreground">{outlet.address}</span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex-1 max-w-xl mx-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Shift Status Indicator */}
              {activeShift && (
                <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">
                    Shift: {format(new Date(activeShift.startTime), "HH:mm")}
                  </span>
                </Badge>
              )}
              <RoleSwitcher />
              <NotificationBell />
              <Button variant="ghost" size="icon">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <PageBreadcrumb />
          <div className="space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

