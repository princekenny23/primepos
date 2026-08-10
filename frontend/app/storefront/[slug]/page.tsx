"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { storefrontService, type StorefrontProduct } from "@/lib/services/storefrontService"
import {
  buildWhatsAppUrl,
  DEFAULT_THEME,
  getStorefrontContactHref,
  getStorefrontHeroSurfaceStyle,
  hexToRgba,
  normalizeStorefrontPageVisibility,
  normalizeStorefrontHeroStyle,
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
    whatsapp_cta?: string
    home_hero_style?: string
    footer_about?: string
    facebook_url?: string
    instagram_url?: string
    x_url?: string
    linkedin_url?: string
    youtube_url?: string
    template_key?: string
  }
}

export default function StorefrontEntryPage({ params }: { params: { slug: string } }) {
  const slug = params.slug
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [config, setConfig] = useState<StorefrontConfig | null>(null)
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])
  const [newStockProducts, setNewStockProducts] = useState<StorefrontProduct[]>([])
  const [catalogProducts, setCatalogProducts] = useState<StorefrontProduct[]>([])

  const normalizeProductsPayload = (value: unknown): StorefrontProduct[] => {
    if (Array.isArray(value)) return value as StorefrontProduct[]
    if (value && typeof value === "object") {
      const maybeResults = (value as { results?: unknown }).results
      if (Array.isArray(maybeResults)) {
        return maybeResults as StorefrontProduct[]
      }
    }
    return []
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const [cfg, cats, newStock, catalog] = await Promise.all([
        storefrontService.getConfig(slug),
        storefrontService.getCategories(slug),
        storefrontService.getProducts(slug, {
          sort: "newest",
          in_stock: true,
          limit: 8,
          new_stock_days: 30,
        }),
        storefrontService.getProducts(slug, {
          sort: "name",
          in_stock: true,
          limit: 20,
        }),
      ])
      setConfig(cfg)
      setCategories(cats)
      setNewStockProducts(normalizeProductsPayload(newStock))
      setCatalogProducts(normalizeProductsPayload(catalog))
    } catch (err: any) {
      setError(err?.message || "Failed to load storefront")
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const handleCatalogRefresh = () => {
      void loadData()
    }

    const handleStorageRefresh = (event: StorageEvent) => {
      if (event.key === "primepos-storefront-refresh") {
        handleCatalogRefresh()
      }
    }

    window.addEventListener("storefront:catalog-refresh", handleCatalogRefresh as EventListener)
    window.addEventListener("storage", handleStorageRefresh)

    return () => {
      window.removeEventListener("storefront:catalog-refresh", handleCatalogRefresh as EventListener)
      window.removeEventListener("storage", handleStorageRefresh)
    }
  }, [loadData])

  const theme = useMemo(
    () => ({
      ...DEFAULT_THEME,
      ...(config?.theme_settings || {}),
    }),
    [config]
  )

  const pageVisibility = useMemo(
    () => normalizeStorefrontPageVisibility(config?.seo_settings as Record<string, any> | undefined),
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

  if (!pageVisibility.home) {
    return (
      <StorefrontShell theme={theme}>
        <StorefrontHeader slug={slug} storeName={config.name} theme={theme} active="home" pageVisibility={pageVisibility} />
        <div className="mx-auto max-w-3xl px-4 py-20">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-sm backdrop-blur">
            <h1 className="mb-2 text-2xl font-bold">Home page is currently disabled</h1>
            <p className="text-sm leading-7 opacity-80">This storefront has turned off the home page. You can still browse the enabled pages from the navigation.</p>
          </div>
        </div>
      </StorefrontShell>
    )
  }

  const heroTitle = config?.seo_settings?.hero_title?.trim() || `${config.name} Store`
  const heroSubtitle =
    config?.seo_settings?.hero_subtitle?.trim() ||
    "Fresh products, great pricing, and simple WhatsApp ordering from one storefront."

  const whatsappCtaText = config?.seo_settings?.whatsapp_cta?.trim() || "Chat on WhatsApp"

  const featuredProducts = newStockProducts.slice(0, 10)
  const bestSellerProducts = catalogProducts.slice(4, 10)
  const totalVisibleProducts = catalogProducts.length

  const templateKey = config?.seo_settings?.template_key || "nextcommerce_v1"
  const footerAbout = config?.seo_settings?.footer_about?.trim() || config?.seo_settings?.hero_subtitle?.trim() || ""
  const socialLinks = {
    facebook: config?.seo_settings?.facebook_url,
    instagram: config?.seo_settings?.instagram_url,
    x: config?.seo_settings?.x_url,
    linkedin: config?.seo_settings?.linkedin_url,
    youtube: config?.seo_settings?.youtube_url,
  }
  const homeHeroStyle = normalizeStorefrontHeroStyle(config?.seo_settings?.home_hero_style)
  const isHomeHeroLight = homeHeroStyle === "glass"

  return (
    <StorefrontShell theme={theme} templateKey={templateKey} storeName={config.name} footerSlug={slug} footerAbout={footerAbout} socialLinks={socialLinks}>
      <StorefrontHeader slug={slug} storeName={config.name} theme={theme} active="home" pageVisibility={pageVisibility} />

      <section className="mx-auto w-full max-w-[1170px] px-4 pb-8 pt-8 sm:px-8 xl:px-0">
        <div
          className="overflow-hidden rounded-[10px] p-7.5 sm:p-10"
          style={getStorefrontHeroSurfaceStyle(theme, homeHeroStyle)}
        >
          <p className={`text-custom-sm font-medium uppercase tracking-[0.2em] ${isHomeHeroLight ? "text-dark/70" : "text-white/80"}`}>{config.name} online store</p>
          <h1 className={`mt-4 text-custom-4xl font-bold leading-tight sm:text-[44px] ${isHomeHeroLight ? "text-dark" : "text-white"}`}>{heroTitle}</h1>
          <p className={`mt-4 max-w-[560px] text-custom-sm ${isHomeHeroLight ? "text-body" : "text-white/90"}`}>{heroSubtitle}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/storefront/${slug}/shop`}
              className="rounded-[6px] bg-white px-6 py-3 text-custom-sm font-semibold text-blue transition hover:bg-gray-1"
            >
              Start shopping
            </Link>
            {config.whatsapp_number ? (
              <a
                href={buildWhatsAppUrl(config.whatsapp_number, `Hi ${config.name}, I want to order from your storefront.`)}
                target="_blank"
                rel="noreferrer"
                className={`rounded-[6px] px-6 py-3 text-custom-sm font-semibold transition ${isHomeHeroLight ? "border border-gray-3 text-dark hover:border-blue hover:text-blue" : "border border-white/40 text-white hover:bg-white/10"}`}
              >
                {whatsappCtaText}
              </a>
            ) : (
              <Link
                href={getStorefrontContactHref(slug)}
                className={`rounded-[6px] px-6 py-3 text-custom-sm font-semibold transition ${isHomeHeroLight ? "border border-gray-3 text-dark hover:border-blue hover:text-blue" : "border border-white/40 text-white hover:bg-white/10"}`}
              >
                Contact us
              </Link>
            )}
          </div>

        </div>
      </section>

      <section className="mx-auto w-full max-w-[1170px] px-4 pb-6 sm:px-8 xl:px-0">
        <div className="rounded-[10px] border border-gray-3 bg-white p-5 shadow-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-custom-xl font-semibold text-dark">Browse categories</h2>
            <Link href={`/storefront/${slug}/shop`} className="text-custom-sm font-semibold text-blue hover:underline">
              View all
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {(categories.length > 0 ? categories : [{ id: 0, name: "General" }]).slice(0, 7).map((category, index) => (
              <Link
                key={category.id || `fallback-${index}`}
                href={category.id ? `/storefront/${slug}/shop?category_id=${category.id}` : `/storefront/${slug}/shop`}
                className="group rounded-[10px] border border-gray-3 bg-gray-1 p-3 transition duration-200 hover:-translate-y-0.5 hover:border-blue"
                style={{ animation: `sf-slide-right 520ms ease ${index * 70}ms both` }}
              >
                <div
                  className="mx-auto flex h-[58px] w-[58px] items-center justify-center rounded-full text-base font-semibold"
                  style={{ backgroundColor: hexToRgba(theme.primary, 0.12), color: theme.primary }}
                >
                  {category.name.trim().charAt(0).toUpperCase() || "C"}
                </div>
                <p className="mt-3 text-center text-custom-xs font-semibold text-dark group-hover:text-blue line-clamp-1">{category.name}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1170px] px-4 pb-8 sm:px-8 xl:px-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-custom-2xl font-semibold text-dark">New Arrivals</h2>
        </div>

        {featuredProducts.length === 0 ? (
          <div className="rounded-[10px] border border-gray-3 bg-white p-10 text-center text-custom-sm text-body shadow-1">
            No new stock available right now.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
            {featuredProducts.map((product) => (
              <article key={product.id} className="group rounded-[10px] border border-gray-3 bg-white p-3 shadow-1 transition duration-200 hover:-translate-y-1 hover:shadow-2">
                <StorefrontImage src={product.image_url} alt={product.name} theme={theme} className="aspect-square w-full" />
                <p className="mt-4 text-custom-xs uppercase tracking-[0.14em] text-body">{product.category_name || "Product"}</p>
                <h3 className="mt-2 text-base font-semibold text-dark line-clamp-1">{product.name}</h3>
                <p className="mt-2 line-clamp-2 text-custom-xs text-body">{product.description || "Fresh inventory now available."}</p>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-base font-semibold text-dark">{config.currency} {product.display_price}</p>
                  <Link href={`/storefront/${slug}/products/${product.id}`} className="rounded-[6px] border border-gray-3 px-3 py-2 text-custom-xs font-semibold text-dark transition hover:border-blue hover:text-blue">
                    Details
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto w-full max-w-[1170px] px-4 pb-8 sm:px-8 xl:px-0">
        <div className="grid gap-5 lg:grid-cols-2">
          <Link href={`/storefront/${slug}/shop`} className="group overflow-hidden rounded-[10px] border border-gray-3 bg-white p-6 shadow-1">
            <p className="text-custom-xs font-semibold uppercase tracking-[0.16em] text-body">Catalog</p>
            <h3 className="mt-2 text-custom-2xl font-semibold text-dark">Browse your full product list</h3>
            <p className="mt-2 max-w-[360px] text-custom-sm text-body">Customers can filter products by category, stock availability, and pricing in the shop view.</p>
            <div className="mt-5 rounded-[8px] border border-gray-3 bg-gray-1 p-4 text-custom-sm text-body">
              {totalVisibleProducts > 0 ? `${totalVisibleProducts} products currently available` : "No products published yet"}
            </div>
          </Link>

          <Link href={getStorefrontContactHref(slug)} className="group overflow-hidden rounded-[10px] border border-gray-3 bg-white p-6 shadow-1">
            <p className="text-custom-xs font-semibold uppercase tracking-[0.16em] text-body">Support</p>
            <h3 className="mt-2 text-custom-2xl font-semibold text-dark">Talk to the store team</h3>
            <p className="mt-2 max-w-[360px] text-custom-sm text-body">Use the contact page form or WhatsApp flow to ask questions and confirm orders directly with the tenant team.</p>
            <div className="mt-5 rounded-[8px] border border-gray-3 bg-gray-1 p-4 text-custom-sm text-body">
              Contact details are available on the Contact page.
            </div>
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1170px] px-4 pb-8 sm:px-8 xl:px-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-custom-2xl font-semibold text-dark">Best Seller Picks</h2>
          <Link href={`/storefront/${slug}/shop`} className="text-custom-sm font-semibold text-blue hover:underline">
            Explore catalog
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {bestSellerProducts.map((product) => (
            <article key={product.id} className="flex gap-3 rounded-[10px] border border-gray-3 bg-white p-3 shadow-1 transition duration-200 hover:shadow-2">
              <StorefrontImage src={product.image_url} alt={product.name} theme={theme} className="h-20 w-20 shrink-0" />
              <div className="min-w-0">
                <p className="text-custom-xs text-body line-clamp-1">{product.category_name || "Popular"}</p>
                <h3 className="mt-1 text-custom-sm font-semibold text-dark line-clamp-1">{product.name}</h3>
                <p className="mt-2 text-custom-sm font-semibold text-dark">{config.currency} {product.display_price}</p>
                <Link href={`/storefront/${slug}/products/${product.id}`} className="mt-2 inline-block text-custom-xs font-semibold text-blue hover:underline">
                  View product
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1170px] px-4 pb-12 sm:px-8 xl:px-0">
        <div className="rounded-[10px] border border-gray-3 bg-white p-6 shadow-1 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-custom-xs font-semibold uppercase tracking-[0.16em] text-body">Stay in the loop</p>
              <h3 className="mt-2 text-custom-2xl font-semibold text-dark">Get restock and deal alerts</h3>
              <p className="mt-2 max-w-[520px] text-custom-sm text-body">Follow this storefront for new products and pricing updates before they sell out.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/storefront/${slug}/shop`} className="rounded-[6px] bg-blue px-5 py-3 text-custom-sm font-semibold text-white transition hover:bg-blue-dark">
                Shop now
              </Link>
              <Link href={getStorefrontContactHref(slug)} className="rounded-[6px] border border-gray-3 px-5 py-3 text-custom-sm font-semibold text-dark transition hover:border-blue hover:text-blue">
                Contact store
              </Link>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes sf-slide-right {
          0% {
            opacity: 0;
            transform: translateX(-16px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </StorefrontShell>
  )
}
