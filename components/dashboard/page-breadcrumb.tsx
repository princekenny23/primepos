"use client"

import { usePathname } from "next/navigation"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { generateBreadcrumbs } from "@/lib/breadcrumbs"

export function PageBreadcrumb() {
  const pathname = usePathname()
  const breadcrumbs = generateBreadcrumbs(pathname)

  // Don't show breadcrumb on dashboard home
  if (pathname === "/dashboard" || breadcrumbs.length === 0) {
    return null
  }

  return (
    <div className="mb-4">
      <Breadcrumb items={breadcrumbs} />
    </div>
  )
}

