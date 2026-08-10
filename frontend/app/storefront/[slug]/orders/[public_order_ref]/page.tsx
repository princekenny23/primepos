"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { storefrontService, type StorefrontOrder } from "@/lib/services/storefrontService"
import {
  DEFAULT_PAGE_VISIBILITY,
  DEFAULT_THEME,
  StorefrontHeader,
  StorefrontShell,
} from "@/app/storefront/_components/storefront-ui"

type StorefrontConfig = {
  name: string
  slug: string
  currency: string
  theme_settings?: Record<string, string>
  seo_settings?: {
    footer_about?: string
    facebook_url?: string
    instagram_url?: string
    x_url?: string
    linkedin_url?: string
    youtube_url?: string
    template_key?: string
  }
}

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
  const [config, setConfig] = useState<StorefrontConfig | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const loadOrder = async () => {
      setIsLoading(true)
      setError("")
      try {
        const [cfg, response] = await Promise.all([
          storefrontService.getConfig(slug),
          storefrontService.getOrder(slug, public_order_ref),
        ])
        setConfig(cfg)
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

  const theme = useMemo(
    () => ({
      ...DEFAULT_THEME,
      ...(config?.theme_settings || {}),
    }),
    [config]
  )

  const storeName = config?.name || slug
  const templateKey = config?.seo_settings?.template_key || "nextcommerce_v1"
  const footerAbout = config?.seo_settings?.footer_about?.trim() || ""
  const socialLinks = {
    facebook: config?.seo_settings?.facebook_url,
    instagram: config?.seo_settings?.instagram_url,
    x: config?.seo_settings?.x_url,
    linkedin: config?.seo_settings?.linkedin_url,
    youtube: config?.seo_settings?.youtube_url,
  }

  return (
    <StorefrontShell theme={theme} templateKey={templateKey} storeName={storeName} footerSlug={slug} footerAbout={footerAbout} socialLinks={socialLinks}>
      <StorefrontHeader slug={slug} storeName={storeName} theme={theme} active="shop" pageVisibility={DEFAULT_PAGE_VISIBILITY} />
      <section className="mx-auto w-full max-w-[1170px] px-4 pb-12 pt-8 sm:px-8 xl:px-0">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-custom-xs font-semibold uppercase tracking-[0.16em] text-body">Order tracking</p>
            <h1 className="mt-2 text-custom-2xl font-semibold text-dark sm:text-custom-4xl">Track your storefront order</h1>
          </div>
          <Link href={`/storefront/${slug}`} className="rounded-[6px] border border-gray-3 bg-white px-4 py-2 text-custom-sm font-semibold text-dark transition hover:border-blue hover:text-blue">
            Back to store
          </Link>
        </div>

        {isLoading ? <div className="rounded-[10px] border border-gray-3 bg-white p-8 text-custom-sm text-body shadow-1">Loading order...</div> : null}

        {!isLoading && error ? (
          <div className="rounded-[10px] border border-red-200 bg-white p-8 text-custom-sm font-medium text-red-600 shadow-1">{error}</div>
        ) : null}

        {!isLoading && order ? (
          <section className="grid gap-6 rounded-[10px] border border-gray-3 bg-white p-6 shadow-1 lg:grid-cols-[minmax(0,1.05fr)_320px] lg:p-8">
            <div>
              <div className="rounded-[8px] border border-gray-3 bg-gray-1 p-5">
                <p className="text-custom-xs font-semibold uppercase tracking-[0.16em] text-body">Reference</p>
                <p className="mt-2 text-custom-xl font-semibold text-dark">{order.public_order_ref}</p>
                <p className="mt-2 text-custom-sm text-body">Placed on {createdAtLabel}</p>
              </div>

              <div className="mt-6 rounded-[8px] border border-gray-3 bg-white p-5">
                <p className="text-custom-xs font-semibold uppercase tracking-[0.16em] text-body">Status timeline</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {STATUS_STEPS.map((step) => {
                    const state = getStepState(order.status, step)
                    const styles =
                      state === "done"
                        ? "border-green-200 bg-green-50 text-green-700"
                        : state === "current"
                        ? "border-blue-light-4 bg-blue-light-5 text-blue"
                        : state === "disabled"
                        ? "border-gray-3 bg-gray-2 text-dark-4"
                        : "border-gray-3 bg-white text-dark-3"
                    return (
                      <div key={step} className={`rounded-[8px] border px-4 py-4 text-custom-sm font-semibold capitalize ${styles}`}>
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
                  <div key={item.label} className="rounded-[8px] border border-gray-3 bg-gray-1 p-5">
                    <p className="text-custom-xs font-semibold uppercase tracking-[0.14em] text-body">{item.label}</p>
                    <p className="mt-3 text-custom-lg font-semibold capitalize text-dark">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-[10px] border border-gray-3 bg-dark p-6 text-white shadow-2">
              <p className="text-custom-xs font-semibold uppercase tracking-[0.16em] text-white/70">Order overview</p>
              <h2 className="mt-3 text-custom-xl font-semibold">Stay updated without support back-and-forth.</h2>
              <p className="mt-4 text-custom-sm leading-7 text-white/80">Customers can check order reference, progress timeline, and key details from any device in one clean view.</p>
              <Link href={`/storefront/${slug}/shop`} className="mt-6 inline-flex rounded-[6px] bg-white px-5 py-3 text-custom-sm font-semibold text-dark transition hover:bg-gray-1">
                Continue shopping
              </Link>
            </aside>
          </section>
        ) : null}
      </section>
    </StorefrontShell>
  )
}
