"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

const sanitizeNextRoute = (value: string | null): string => {
  if (!value || !value.startsWith("/")) return "/dashboard/pos"
  if (value.startsWith("//")) return "/dashboard/pos"
  return value
}

function SelectOutletRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextRoute = sanitizeNextRoute(searchParams.get("next"))

  useEffect(() => {
    router.replace(nextRoute)
  }, [router, nextRoute])

  return null
}

export default function SelectOutletPage() {
  return (
    <Suspense fallback={null}>
      <SelectOutletRedirect />
    </Suspense>
  )
}
