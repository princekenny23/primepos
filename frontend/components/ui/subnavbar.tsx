"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { generateBreadcrumbs } from "@/lib/breadcrumbs"
import { useI18n } from "@/contexts/i18n-context"

interface SubNavbarProps {
  title?: string
  backHref?: string
  onBack?: () => void
  className?: string
  showBackButton?: boolean
}

export function SubNavbar({ 
  title, 
  backHref, 
  onBack, 
  className,
  showBackButton = true 
}: SubNavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useI18n()
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  
  // Auto-generate title from breadcrumbs if not provided
  const breadcrumbs = generateBreadcrumbs(pathname)
  const displayTitle = title || breadcrumbs[breadcrumbs.length - 1]?.label || "Page"
  
  const handleBack = () => {
    if (onBack) {
      onBack()
    } else if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    
    // Dispatch refresh events that client pages/components can subscribe to.
    window.dispatchEvent(new CustomEvent("system-refresh"))
    window.dispatchEvent(
      new CustomEvent("subnav-refresh", {
        detail: {
          pathname,
          timestamp: Date.now(),
        },
      })
    )
    
    // Also trigger a router refresh to update any server-side data
    router.refresh()
    
    // Visual feedback - keep spinning for a moment
    setTimeout(() => {
      setIsRefreshing(false)
    }, 800)
  }

  // Don't show on dashboard pages or admin home
  const isDashboardPage = pathname === "/dashboard" || 
    pathname === "/dashboard/restaurant/dashboard" ||
    pathname === "/dashboard/bar/dashboard" ||
    pathname?.match(/^\/dashboard\/(restaurant|bar)\/dashboard$/)
  
  if (isDashboardPage || pathname === "/admin") {
    return null
  }

  return (
    <div 
      className={cn(
        "bg-[#1e3a8a] border-b border-[#1e3a8a] -mx-4 lg:-mx-6 px-4 lg:px-6",
        className
      )}
    >
      <div className="flex items-center justify-between py-2 h-10">
        {/* Left side back button */}
        {showBackButton ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            title={t("common.actions.back")}
            className="text-white hover:bg-blue-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <div className="w-10"></div>
        )}
        
        {/* Centered page name */}
        <div className="flex-1 flex justify-center">
          <h1 className="text-base font-semibold text-white">{displayTitle}</h1>
        </div>
        
        {/* Right side refresh button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title={t("common.actions.refresh")}
          className="text-white hover:bg-blue-800 hover:text-white"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
      </div>
    </div>
  )
}
