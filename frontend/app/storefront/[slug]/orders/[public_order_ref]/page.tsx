"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { storefrontService, type StorefrontOrder } from "@/lib/services/storefrontService"

const STATUS_STEPS = ["pending", "confirmed", "cancelled"] as const

function getStepState(currentStatus: string, step: (typeof STATUS_STEPS)[number]) {
  if (currentStatus === "cancelled") {
    return step === "cancelled" ? "current" : "disabled"
  }
  if (step === "pending") return "done"
  if (step === "confirmed") {
    return currentStatus === "confirmed" ? "current" : "upcoming"
  }
  return "upcoming"
}

export default function StorefrontOrderTrackingPage({
  params,
}: {
  params: { slug: string; public_order_ref: string }
}) {
  const { slug, public_order_ref } = params
  const [isLoading, setIsLoading] = useState(true)
  const [order, setOrder] = useState<StorefrontOrder | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const loadOrder = async () => {
      setIsLoading(true)
      setError("")
      try {
        const response = await storefrontService.getOrder(slug, public_order_ref)
        setOrder(response)
      } catch (err: any) {
        setError(err?.message || "Failed to load order")
      } finally {
        setIsLoading(false)
      }
    }
    loadOrder()
  }, [slug, public_order_ref])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Order Tracking</h1>
          <Link href={`/storefront/${slug}`} className="text-sm font-medium text-teal-700 hover:underline">
            Back to Store
          </Link>
        </div>

        {isLoading && <p className="rounded-lg border bg-white p-6 text-sm">Loading order...</p>}

        {!isLoading && error && <p className="rounded-lg border bg-white p-6 text-sm text-red-600">{error}</p>}

        {!isLoading && order && (
          <section className="rounded-lg border bg-white p-6">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Reference</p>
            <p className="mt-1 text-lg font-semibold">{order.public_order_ref}</p>

            <div className="mt-5 rounded-md border bg-slate-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status Timeline</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {STATUS_STEPS.map((step) => {
                  const state = getStepState(order.status, step)
                  const styles =
                    state === "done"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : state === "current"
                      ? "border-teal-200 bg-teal-50 text-teal-700"
                      : state === "disabled"
                      ? "border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-200 bg-white text-slate-500"
                  return (
                    <div key={step} className={`rounded-md border px-3 py-2 text-sm font-semibold capitalize ${styles}`}>
                      {step}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Customer</p>
                <p className="text-sm font-medium">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="text-sm font-medium">{order.customer_phone || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <p className="text-sm font-semibold capitalize">{order.status}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Channel</p>
                <p className="text-sm font-medium capitalize">{order.channel}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Receipt</p>
                <p className="text-sm font-medium">{order.receipt_number || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-sm font-semibold">{order.total}</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
