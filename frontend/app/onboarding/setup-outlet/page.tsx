"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function SetupOutletRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/onboarding?tab=outlet")
  }, [router])

  return null
}
