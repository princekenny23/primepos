"use client"

import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { requestAppRefresh } from "@/lib/utils/page-refresh"

interface PageRefreshButtonProps {
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  showLabel?: boolean
}

export function PageRefreshButton({ 
  variant = "outline", 
  size = "default",
  className = "",
  showLabel = true 
}: PageRefreshButtonProps) {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    requestAppRefresh()
    router.refresh()
    
    // Also trigger a small delay to show the loading state
    setTimeout(() => {
      setIsRefreshing(false)
    }, 500)
  }

  if (size === "icon") {
    return (
      <Button
        variant={variant}
        size="icon"
        onClick={handleRefresh}
        disabled={isRefreshing}
        title="Refresh page"
        className={`bg-white border-white text-[#1e3a8a] hover:bg-blue-50 hover:border-blue-50 ${className}`}
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
      </Button>
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`bg-white border-white text-[#1e3a8a] hover:bg-blue-50 hover:border-blue-50 ${className}`}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
      {showLabel && "Refresh"}
    </Button>
  )
}

