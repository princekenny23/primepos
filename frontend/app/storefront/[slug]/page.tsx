"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { storefrontService, type StorefrontProduct } from "@/lib/services/storefrontService"

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

const DEFAULT_THEME: Record<string, string> = {
  primary: "#0f766e",
  primary_foreground: "#ffffff",
  secondary: "#f1f5f9",
  accent: "#e2e8f0",
  background: "#ffffff",
  foreground: "#0f172a",
  card: "#ffffff",
  border: "#e2e8f0",
  ring: "#14b8a6",
}

function resolveStorefrontImageUrl(rawUrl?: string): string {
  if (!rawUrl) return ""
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("data:")) return rawUrl
  if (rawUrl.startsWith("//")) return `https:${rawUrl}`
  if (rawUrl.startsWith("/")) {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"
    const origin = base.replace(/\/api\/v\d+\/?$/, "")
    return `${origin}${rawUrl}`
  }
  return rawUrl
}

function buildWhatsAppUrl(storeWhatsApp: string, message: string) {
  const digits = storeWhatsApp.replace(/\D/g, "")
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${digits}?text=${encoded}`
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
      <main className="min-h-screen" style={{ backgroundColor: DEFAULT_THEME.background, color: DEFAULT_THEME.foreground }}>
        <div className="mx-auto max-w-6xl px-4 py-12">Loading storefront home...</div>
      </main>
    )
  }

  if (error || !config) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: DEFAULT_THEME.background, color: DEFAULT_THEME.foreground }}>
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="mb-2 text-2xl font-bold">Storefront unavailable</h1>
          <p>{error || "This storefront could not be loaded."}</p>
        </div>
      </main>
    )
  }

  const heroTitle = config?.seo_settings?.hero_title?.trim() || `${config.name} Store`
  const heroSubtitle =
    config?.seo_settings?.hero_subtitle?.trim() ||
    "Fresh products, great pricing, and simple WhatsApp ordering from one storefront."

  const contactPhone = config?.seo_settings?.contact_phone?.trim() || ""
  const whatsappCtaText = config?.seo_settings?.whatsapp_cta?.trim() || "Chat on WhatsApp"

  return (
    <main className="min-h-screen" style={{ backgroundColor: theme.background, color: theme.foreground }}>
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ borderColor: theme.border, backgroundColor: `${theme.card}ee` }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">{config.name}</p>
          <nav className="flex items-center gap-2 text-sm font-medium">
            <Link href={`/storefront/${slug}`} className="rounded-md px-3 py-1.5 text-white" style={{ backgroundColor: theme.primary }}>
              Home
            </Link>
            <Link href={`/storefront/${slug}/about`} className="rounded-md px-3 py-1.5" style={{ backgroundColor: theme.accent }}>
              About
            </Link>
            <Link href={`/storefront/${slug}/shop`} className="rounded-md px-3 py-1.5" style={{ backgroundColor: theme.accent }}>
              Shop
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b" style={{ borderColor: theme.border, background: `linear-gradient(120deg, ${theme.primary} 0%, ${theme.ring} 100%)`, color: theme.primary_foreground }}>
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] opacity-80">Welcome</p>
          <h1 className="text-4xl font-black leading-tight">{heroTitle}</h1>
          <p className="mt-3 max-w-2xl text-sm opacity-90">{heroSubtitle}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/storefront/${slug}/shop`} className="rounded-md px-4 py-2 text-sm font-semibold" style={{ backgroundColor: theme.primary_foreground, color: theme.primary }}>
              Start Shopping
            </Link>
            {config.whatsapp_number && (
              <a
                href={buildWhatsAppUrl(config.whatsapp_number, `Hi ${config.name}, I want to order from your storefront.`)}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: theme.primary_foreground, color: theme.primary_foreground }}
              >
                {whatsappCtaText}
              </a>
            )}
          </div>
          {contactPhone && <p className="mt-4 text-xs opacity-85">Contact: {contactPhone}</p>}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">New Stock</h2>
          <Link href={`/storefront/${slug}/shop`} className="text-sm font-semibold" style={{ color: theme.primary }}>
            View all
          </Link>
        </div>

        {newStockProducts.length === 0 ? (
          <div className="rounded-lg border p-8 text-center" style={{ borderColor: theme.border, backgroundColor: theme.card }}>
            <p className="text-sm">No new stock available right now.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {newStockProducts.map((product) => (
              <article key={product.id} className="rounded-lg border p-4" style={{ borderColor: theme.border, backgroundColor: theme.card }}>
                {product.image_url ? (
                  <div className="mb-3 overflow-hidden rounded-md border" style={{ borderColor: theme.border }}>
                    <img src={resolveStorefrontImageUrl(product.image_url)} alt={product.name} className="h-40 w-full object-cover" loading="lazy" />
                  </div>
                ) : (
                  <div className="mb-3 flex h-40 items-center justify-center rounded-md border text-sm opacity-70" style={{ borderColor: theme.border, backgroundColor: theme.secondary }}>
                    No image
                  </div>
                )}

                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-snug">{product.name}</h3>
                  {product.is_new_stock && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}>
                      New
                    </span>
                  )}
                </div>

                <p className="mb-3 line-clamp-2 text-xs opacity-80">{product.description || "Freshly available in stock."}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{config.currency} {product.display_price}</span>
                  <Link href={`/storefront/${slug}/products/${product.id}`} className="rounded-md border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: theme.border }}>
                    View
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="mb-4 text-lg font-bold">Browse by Category</h2>
        <div className="flex flex-wrap gap-2">
          {categories.slice(0, 8).map((category) => (
            <Link
              key={category.id}
              href={`/storefront/${slug}/shop?category_id=${category.id}`}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: theme.border, backgroundColor: theme.card }}
            >
              {category.name}
            </Link>
          ))}
          {categories.length === 0 && (
            <p className="text-sm opacity-70">No categories configured yet.</p>
          )}
        </div>
      </section>
    </main>
  )
}
