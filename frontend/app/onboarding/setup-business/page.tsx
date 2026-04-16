"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function SetupBusinessRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/onboarding?tab=business")
  }, [router])

  return null
}
