"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { storefrontService, type StorefrontProduct } from "@/lib/services/storefrontService"
import {
  buildWhatsAppUrl,
  DEFAULT_THEME,
  hexToRgba,
  SectionHeading,
  StorefrontHeader,
  StorefrontImage,
  StorefrontShell,
} from "@/app/storefront/_components/storefront-ui"

type StorefrontConfig = {
  name: string
  slug: string
  currency: string
  whatsapp_number?: string
  theme_settings?: Record<string, string>
  seo_settings?: {
    hero_title?: string
    hero_subtitle?: string
    contact_phone?: string
    whatsapp_cta?: string
  }
}

export default function StorefrontEntryPage({ params }: { params: { slug: string } }) {
  const slug = params.slug
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [config, setConfig] = useState<StorefrontConfig | null>(null)
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])
  const [newStockProducts, setNewStockProducts] = useState<StorefrontProduct[]>([])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setError("")
      try {
        const [cfg, cats, newStock] = await Promise.all([
          storefrontService.getConfig(slug),
          storefrontService.getCategories(slug),
          storefrontService.getProducts(slug, {
            sort: "newest",
            in_stock: true,
            limit: 8,
            new_stock_days: 30,
          }),
        ])
        setConfig(cfg)
        setCategories(cats)
        setNewStockProducts(newStock)
      } catch (err: any) {
        setError(err?.message || "Failed to load storefront")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [slug])

  const theme = useMemo(
    () => ({
      ...DEFAULT_THEME,
      ...(config?.theme_settings || {}),
    }),
    [config]
  )

  if (isLoading) {
    return (
      <StorefrontShell theme={DEFAULT_THEME}>
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 text-sm shadow-sm backdrop-blur">
            Loading storefront home...
          </div>
        </div>
      </StorefrontShell>
    )
  }

  if (error || !config) {
    return (
      <StorefrontShell theme={DEFAULT_THEME}>
        <div className="mx-auto max-w-3xl px-4 py-20">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-sm backdrop-blur">
            <h1 className="mb-2 text-2xl font-bold">Storefront unavailable</h1>
            <p>{error || "This storefront could not be loaded."}</p>
          </div>
        </div>
      </StorefrontShell>
    )
  }

  const heroTitle = config?.seo_settings?.hero_title?.trim() || `${config.name} Store`
  const heroSubtitle =
    config?.seo_settings?.hero_subtitle?.trim() ||
    "Fresh products, great pricing, and simple WhatsApp ordering from one storefront."

  const contactPhone = config?.seo_settings?.contact_phone?.trim() || ""
  const whatsappCtaText = config?.seo_settings?.whatsapp_cta?.trim() || "Chat on WhatsApp"

  const featuredCount = newStockProducts.length

  return (
    <StorefrontShell theme={theme}>
      <StorefrontHeader slug={slug} storeName={config.name} theme={theme} active="home" />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14 lg:py-16">
        <div
          className="grid overflow-hidden rounded-[2rem] border p-6 shadow-sm sm:p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:p-10"
          style={{
            borderColor: theme.border,
            background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.ring} 100%)`,
            color: theme.primary_foreground,
            boxShadow: `0 24px 64px ${hexToRgba(theme.primary, 0.24)}`,
          }}
        >
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] opacity-80">Modern storefront</p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">{heroTitle}</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 opacity-90 sm:text-base">{heroSubtitle}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/storefront/${slug}/shop`}
                className="rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                style={{ backgroundColor: theme.primary_foreground, color: theme.primary }}
              >
                Start shopping
              </Link>
              {config.whatsapp_number ? (
                <a
                  href={buildWhatsAppUrl(config.whatsapp_number, `Hi ${config.name}, I want to order from your storefront.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                  style={{ borderColor: hexToRgba(theme.primary_foreground, 0.45), color: theme.primary_foreground }}
                >
                  {whatsappCtaText}
                </a>
              ) : null}
            </div>

            {contactPhone ? <p className="mt-5 text-sm opacity-80">Contact: {contactPhone}</p> : null}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:mt-0 lg:grid-cols-1">
            <div className="rounded-[1.5rem] border p-5 backdrop-blur" style={{ borderColor: hexToRgba(theme.primary_foreground, 0.18), backgroundColor: hexToRgba(theme.primary_foreground, 0.12) }}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-75">Fresh arrivals</p>
              <p className="mt-3 text-3xl font-bold">{featuredCount}</p>
              <p className="mt-2 text-sm opacity-80">New products added in the last 30 days.</p>
            </div>
            <div className="rounded-[1.5rem] border p-5 backdrop-blur" style={{ borderColor: hexToRgba(theme.primary_foreground, 0.18), backgroundColor: hexToRgba(theme.primary_foreground, 0.1) }}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-75">Categories</p>
              <p className="mt-3 text-3xl font-bold">{categories.length}</p>
              <p className="mt-2 text-sm opacity-80">Browse curated sections tailored to this storefront.</p>
            </div>
            <div className="rounded-[1.5rem] border p-5 backdrop-blur" style={{ borderColor: hexToRgba(theme.primary_foreground, 0.18), backgroundColor: hexToRgba(theme.primary_foreground, 0.08) }}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-75">Fast checkout</p>
              <p className="mt-3 text-lg font-semibold">WhatsApp ready</p>
              <p className="mt-2 text-sm opacity-80">Add to cart, confirm details, and send your order in one flow.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-8">
        <SectionHeading
          eyebrow="Explore"
          title="Browse by category"
          description="Jump directly into the sections shoppers care about most."
        />

        <div className="flex flex-wrap gap-3">
          {categories.slice(0, 8).map((category) => (
            <Link
              key={category.id}
              href={`/storefront/${slug}/shop?category_id=${category.id}`}
              className="rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.card, 0.94), color: theme.foreground }}
            >
              {category.name}
            </Link>
          ))}
          {categories.length === 0 ? <p className="text-sm opacity-70">No categories configured yet.</p> : null}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <SectionHeading
          eyebrow="Featured"
          title="New stock, presented with more clarity"
          description="Fresh arrivals are surfaced in a cleaner grid with sharper pricing, stronger hierarchy, and faster paths into the catalog."
          action={
            <Link
              href={`/storefront/${slug}/shop`}
              className="rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.card, 0.88), color: theme.foreground }}
            >
              View all products
            </Link>
          }
        />

        {newStockProducts.length === 0 ? (
          <div className="rounded-[2rem] border p-10 text-center shadow-sm" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.card, 0.92) }}>
            <p className="text-sm font-medium opacity-75">No new stock available right now.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {newStockProducts.map((product: StorefrontProduct) => (
              <article
                key={product.id}
                className="group flex h-full flex-col rounded-[1.75rem] border p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.card, 0.94) }}
              >
                <StorefrontImage src={product.image_url} alt={product.name} theme={theme} className="aspect-[4/3] w-full" />

                <div className="mt-4 flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-50">{product.category_name || "Fresh stock"}</p>
                      <h3 className="mt-2 text-lg font-semibold leading-tight">{product.name}</h3>
                    </div>
                    {product.is_new_stock ? (
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
                        style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}
                      >
                        New
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 line-clamp-3 text-sm leading-6 opacity-75">{product.description || "Freshly available in stock."}</p>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-45">Price</p>
                      <p className="text-2xl font-bold tracking-tight">
                        {config.currency} {product.display_price}
                      </p>
                    </div>
                    <Link
                      href={`/storefront/${slug}/products/${product.id}`}
                      className="rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                      style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.76), color: theme.foreground }}
                    >
                      View item
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </StorefrontShell>
  )
}
