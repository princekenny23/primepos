"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { storefrontService, type StorefrontOrder } from "@/lib/services/storefrontService"
import { DEFAULT_THEME, hexToRgba, StorefrontShell } from "@/app/storefront/_components/storefront-ui"

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

  const createdAtLabel = useMemo(() => {
    if (!order?.created_at) return "-"
    const date = new Date(order.created_at)
    if (Number.isNaN(date.getTime())) return order.created_at
    return date.toLocaleString()
  }, [order?.created_at])

  return (
    <StorefrontShell theme={DEFAULT_THEME}>
      <section className="mx-auto max-w-5xl px-4 py-10 sm:py-14 lg:py-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Order tracking</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Track your storefront order</h1>
          </div>
          <Link href={`/storefront/${slug}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-all duration-200 hover:-translate-y-0.5">
            Back to store
          </Link>
        </div>

        {isLoading ? <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 text-sm shadow-sm backdrop-blur">Loading order...</div> : null}

        {!isLoading && error ? (
          <div className="rounded-[2rem] border border-red-200 bg-white/90 p-8 text-sm font-medium text-red-600 shadow-sm backdrop-blur">{error}</div>
        ) : null}

        {!isLoading && order ? (
          <section className="grid gap-6 rounded-[2rem] border border-slate-200/80 bg-white/92 p-6 shadow-sm backdrop-blur lg:grid-cols-[minmax(0,1.05fr)_320px] lg:p-8">
            <div>
              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Reference</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{order.public_order_ref}</p>
                <p className="mt-2 text-sm text-slate-600">Placed on {createdAtLabel}</p>
              </div>

              <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status timeline</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
                      <div key={step} className={`rounded-[1.25rem] border px-4 py-4 text-sm font-semibold capitalize ${styles}`}>
                        {step}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Customer", value: order.customer_name },
                  { label: "Phone", value: order.customer_phone || "-" },
                  { label: "Status", value: order.status },
                  { label: "Channel", value: order.channel },
                  { label: "Receipt", value: order.receipt_number || "-" },
                  { label: "Total", value: order.total },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-lg font-semibold capitalize text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-white" style={{ boxShadow: `0 20px 40px ${hexToRgba("#0f172a", 0.16)}` }}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Order overview</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">Stay updated without support back-and-forth.</h2>
              <p className="mt-4 text-sm leading-7 text-white/75">This page now gives the order reference, progress timeline, and key order details a clearer structure for customers checking status on mobile or desktop.</p>
              <Link href={`/storefront/${slug}/shop`} className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-all duration-200 hover:-translate-y-0.5">
                Continue shopping
              </Link>
            </aside>
          </section>
        ) : null}
      </section>
    </StorefrontShell>
  )
}
