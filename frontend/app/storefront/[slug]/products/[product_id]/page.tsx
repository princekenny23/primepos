"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { storefrontService, type StorefrontProduct } from "@/lib/services/storefrontService"
import {
  DEFAULT_PAGE_VISIBILITY,
  DEFAULT_THEME,
  StorefrontHeader,
  StorefrontImage,
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

export default function StorefrontProductDetailPage({
  params,
}: {
  params: { slug: string; product_id: string }
}) {
  const slug = params.slug
  const productId = Number(params.product_id)
  const [isLoading, setIsLoading] = useState(true)
  const [product, setProduct] = useState<StorefrontProduct | null>(null)
  const [config, setConfig] = useState<StorefrontConfig | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const loadProduct = async () => {
      if (Number.isNaN(productId)) {
        setError("Invalid product.")
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setError("")
      try {
        const [cfg, response] = await Promise.all([
          storefrontService.getConfig(slug),
          storefrontService.getProduct(slug, productId),
        ])
        setConfig(cfg)
        setProduct(response)
      } catch (err: any) {
        setError(err?.message || "Failed to load product")
      } finally {
        setIsLoading(false)
      }
    }
    loadProduct()
  }, [slug, productId])

  const theme = useMemo(
    () => ({
      ...DEFAULT_THEME,
      ...(config?.theme_settings || {}),
    }),
    [config]
  )

  const currency = config?.currency || ""
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
            <p className="text-custom-xs font-semibold uppercase tracking-[0.16em] text-body">Product detail</p>
            <h1 className="mt-2 text-custom-2xl font-semibold text-dark sm:text-custom-4xl">Product overview</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/storefront/${slug}`} className="rounded-[6px] border border-gray-3 bg-white px-4 py-2 text-custom-sm font-semibold text-dark transition hover:border-blue hover:text-blue">
              Back to store
            </Link>
            <Link href={`/storefront/${slug}/shop`} className="rounded-[6px] bg-blue px-4 py-2 text-custom-sm font-semibold text-white transition hover:bg-blue-dark">
              Open shop
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-[10px] border border-gray-3 bg-white p-8 text-custom-sm text-body shadow-1">Loading product...</div>
        ) : null}

        {!isLoading && error ? (
          <div className="rounded-[10px] border border-red-200 bg-white p-8 text-custom-sm font-medium text-red-600 shadow-1">{error}</div>
        ) : null}

        {!isLoading && product ? (
          <section className="grid gap-8 rounded-[10px] border border-gray-3 bg-white p-6 shadow-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:p-8">
            <StorefrontImage src={product.image_url} alt={product.name} theme={theme} className="aspect-[4/3] w-full" fallbackLabel="No image available" />

            <div className="flex flex-col justify-between">
              <div>
                <p className="text-custom-xs font-semibold uppercase tracking-[0.14em] text-body">{product.category_name || "Product"}</p>
                <h2 className="mt-3 text-custom-2xl font-semibold text-dark sm:text-custom-4xl">{product.name}</h2>
                <p className="mt-5 text-custom-sm leading-7 text-body">{product.description || "No description available."}</p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[8px] border border-gray-3 bg-gray-1 p-5">
                    <p className="text-custom-xs font-semibold uppercase tracking-[0.14em] text-body">Price</p>
                    <p className="mt-3 text-custom-xl font-semibold text-dark">{currency} {product.display_price}</p>
                  </div>
                  <div className="rounded-[8px] border border-gray-3 bg-gray-1 p-5">
                    <p className="text-custom-xs font-semibold uppercase tracking-[0.14em] text-body">Stock</p>
                    <p className="mt-3 text-custom-xl font-semibold text-dark">{product.stock} {product.unit}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 rounded-[10px] border border-gray-3 bg-dark p-5 text-white shadow-2">
                <p className="text-custom-xs font-semibold uppercase tracking-[0.16em] text-white/70">Next step</p>
                <p className="mt-3 text-custom-lg font-semibold">Add this product from the shop page cart flow.</p>
                <p className="mt-2 text-custom-sm leading-7 text-white/80">Continue through the same quick-view and WhatsApp-ready checkout path on the shop page.</p>
                <Link href={`/storefront/${slug}/shop`} className="mt-5 inline-flex rounded-[6px] bg-white px-5 py-3 text-custom-sm font-semibold text-dark transition hover:bg-gray-1">
                  Browse in shop
                </Link>
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </StorefrontShell>
  )
}
