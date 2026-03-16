"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/authStore"
import { useBusinessStore } from "@/stores/businessStore"
import { Store, MapPin } from "lucide-react"

const sanitizeNextRoute = (value: string | null): string => {
  if (!value || !value.startsWith("/")) return "/dashboard/pos"
  if (value.startsWith("//")) return "/dashboard/pos"
  return value
}

export default function SelectOutletPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextRoute = sanitizeNextRoute(searchParams.get("next"))

  const user = useAuthStore((state) => state.user)
  const currentBusiness = useBusinessStore((state) => state.currentBusiness)
  const outlets = useBusinessStore((state) => state.outlets)
  const setCurrentBusiness = useBusinessStore((state) => state.setCurrentBusiness)
  const setCurrentOutlet = useBusinessStore((state) => state.setCurrentOutlet)

  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const bootstrap = async () => {
      if (!user) {
        router.replace("/auth/login")
        return
      }

      if (user.is_saas_admin) {
        router.replace("/admin")
        return
      }

      const tenantId = user.tenant
        ? typeof user.tenant === "object"
          ? String((user.tenant as any).id || "")
          : String(user.tenant)
        : ""

      if (!tenantId) {
        router.replace("/onboarding/setup-business")
        return
      }

      try {
        if (!currentBusiness || String(currentBusiness.id) !== tenantId) {
          await setCurrentBusiness(tenantId)
        }
      } catch (err) {
        console.error("Failed to initialize business on outlet selection:", err)
        if (isMounted) {
          setError("Failed to load your outlets. Please try logging in again.")
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false)
        }
      }
    }

    bootstrap()

    return () => {
      isMounted = false
    }
  }, [user, currentBusiness, setCurrentBusiness, router])

  const selectableOutlets = useMemo(() => {
    const activeOutlets = (outlets || []).filter((outlet) => outlet.isActive !== false)
    const assignedIds = Array.isArray(user?.outletIds)
      ? user.outletIds.map((id) => String(id)).filter(Boolean)
      : []

    if (assignedIds.length === 0) return activeOutlets

    const allowed = activeOutlets.filter((outlet) => assignedIds.includes(String(outlet.id)))
    return allowed
  }, [outlets, user?.outletIds])

  useEffect(() => {
    if (isBootstrapping) return

    if (selectableOutlets.length === 1) {
      const onlyOutlet = selectableOutlets[0]
      setCurrentOutlet(String(onlyOutlet.id))
      if (typeof window !== "undefined") {
        localStorage.setItem("currentOutletId", String(onlyOutlet.id))
      }
      router.replace(nextRoute)
      return
    }

    if (selectableOutlets.length === 0 && !error) {
      setError("No outlet is currently available for your account. Contact your administrator.")
    }
  }, [isBootstrapping, selectableOutlets, setCurrentOutlet, nextRoute, router, error])

  const handleSelectOutlet = (outletId: string) => {
    setCurrentOutlet(String(outletId))
    if (typeof window !== "undefined") {
      localStorage.setItem("currentOutletId", String(outletId))
    }
    router.push(nextRoute)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Select Outlet</CardTitle>
          <CardDescription>
            Choose the outlet you want to work from before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isBootstrapping && <p className="text-sm text-muted-foreground">Loading outlets...</p>}

          {!isBootstrapping && error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!isBootstrapping && !error && selectableOutlets.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {selectableOutlets.map((outlet) => (
                <div
                  key={outlet.id}
                  className="min-w-[220px] max-w-[220px] rounded-lg border p-4 bg-white flex flex-col items-center text-center gap-3"
                >
                  <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center">
                    <Store className="h-6 w-6" />
                  </div>

                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">{outlet.name}</p>
                    {outlet.address ? (
                      <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {outlet.address}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">No address</p>
                    )}
                  </div>

                  <Button className="w-full" onClick={() => handleSelectOutlet(outlet.id)}>
                    Use Outlet
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!isBootstrapping && (
            <Button variant="outline" className="w-full" onClick={() => router.push("/auth/login")}>Back to login</Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
