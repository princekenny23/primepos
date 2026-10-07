"use client"

import { usePathname } from "next/navigation"
import { PageLoading } from "@/components/ui/page-loading"

export function RouteLoading() {
  const pathname = usePathname() || ""
  const label = pathname.includes("stock-taking")
    ? "Stock-taking…"
    : pathname.includes("products")
      ? "Loading products…"
      : pathname.includes("/pos")
        ? "Loading POS…"
        : pathname.includes("dashboard")
          ? "Loading dashboard…"
          : "Loading page…"

  return <PageLoading label={label} className="min-h-screen" />
}