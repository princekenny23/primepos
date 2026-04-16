"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AddFirstUserRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/onboarding?tab=user")
  }, [router])

  return null
}
