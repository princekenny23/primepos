"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { storefrontService } from "@/lib/services/storefrontService"
import {
  DEFAULT_THEME,
  getStorefrontHeroSurfaceStyle,
  getStorefrontContactHref,
  normalizeStorefrontPageVisibility,
  normalizeStorefrontHeroStyle,
  StorefrontHeader,
  StorefrontShell,
} from "@/app/storefront/_components/storefront-ui"

type StorefrontConfig = {
  name: string
  slug: string
  currency: string
  theme_settings?: Record<string, string>
  seo_settings?: {
    about_title?: string
    about_description?: string
    about_hero_style?: string
    footer_about?: string
    contact_phone?: string
    facebook_url?: string
    instagram_url?: string
    x_url?: string
    linkedin_url?: string
    youtube_url?: string
    template_key?: string
  }
}

export default function StorefrontAboutPage({ params }: { params: { slug: string } }) {
  const slug = params.slug
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [config, setConfig] = useState<StorefrontConfig | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError("")
      try {
        const cfg = await storefrontService.getConfig(slug)
        setConfig(cfg)
      } catch (err: any) {
        setError(err?.message || "Failed to load storefront")
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [slug])

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
            Loading about page...
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

  if (!pageVisibility.about) {
    return (
      <StorefrontShell theme={theme}>
        <StorefrontHeader slug={slug} storeName={config.name} theme={theme} active="about" pageVisibility={pageVisibility} />
        <div className="mx-auto max-w-3xl px-4 py-20">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-sm backdrop-blur">
            <h1 className="mb-2 text-2xl font-bold">About page is currently disabled</h1>
            <p className="text-sm leading-7 opacity-80">This storefront has hidden the About page. Use the available navigation links to continue exploring.</p>
          </div>
        </div>
      </StorefrontShell>
    )
  }

  const aboutTitle = config?.seo_settings?.about_title?.trim() || "About Our Store"
  const aboutDescription =
    config?.seo_settings?.about_description?.trim() ||
    "We are a trusted retail store committed to quality products, fair prices, and great service."

  const templateKey = config?.seo_settings?.template_key || "nextcommerce_v1"
  const footerAbout = config?.seo_settings?.footer_about?.trim() || aboutDescription
  const socialLinks = {
    facebook: config?.seo_settings?.facebook_url,
    instagram: config?.seo_settings?.instagram_url,
    x: config?.seo_settings?.x_url,
    linkedin: config?.seo_settings?.linkedin_url,
    youtube: config?.seo_settings?.youtube_url,
  }
  const aboutHeroStyle = normalizeStorefrontHeroStyle(config?.seo_settings?.about_hero_style)
  const isAboutHeroLight = aboutHeroStyle === "glass"

  return (
    <StorefrontShell theme={theme} templateKey={templateKey} storeName={config.name} footerSlug={slug} footerAbout={footerAbout} socialLinks={socialLinks}>
      <StorefrontHeader slug={slug} storeName={config.name} theme={theme} active="about" pageVisibility={pageVisibility} />

      <section className="mx-auto w-full max-w-[1170px] px-4 pb-8 pt-8 sm:px-8 xl:px-0">
        <div
          className="overflow-hidden rounded-[10px] p-7.5 shadow-1 sm:p-10"
          style={getStorefrontHeroSurfaceStyle(theme, aboutHeroStyle)}
        >
          <p className={`text-custom-xs font-semibold uppercase tracking-[0.16em] ${isAboutHeroLight ? "text-dark/70" : "text-white/80"}`}>About this store</p>
          <h1 className={`mt-3 text-custom-2xl font-semibold sm:text-custom-4xl ${isAboutHeroLight ? "text-dark" : "text-white"}`}>{aboutTitle}</h1>
          <p className={`mt-4 max-w-[760px] text-custom-sm ${isAboutHeroLight ? "text-body" : "text-white/90"}`}>Discover why shoppers choose this store for quality products, clear pricing, and reliable service.</p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1170px] gap-6 px-4 pb-8 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] xl:px-0">
        <article className="rounded-[10px] border border-gray-3 bg-white p-6 shadow-1 sm:p-8">
          <p className="text-custom-xs font-semibold uppercase tracking-[0.16em] text-body">Our story</p>
          <h2 className="mt-3 text-custom-xl font-semibold text-dark">Built for reliable, everyday commerce</h2>

          <div className="mt-5 space-y-5 text-custom-sm leading-7 text-body">
            {aboutDescription.split("\n").filter(Boolean).map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/storefront/${slug}/shop`}
              className="rounded-[6px] bg-blue px-5 py-3 text-custom-sm font-semibold text-white transition hover:bg-blue-dark"
            >
              Go to shop
            </Link>
            <Link
              href={getStorefrontContactHref(slug)}
              className="rounded-[6px] border border-gray-3 px-5 py-3 text-custom-sm font-semibold text-dark transition hover:border-blue hover:text-blue"
            >
              Contact us
            </Link>
            <Link
              href={`/storefront/${slug}`}
              className="rounded-[6px] border border-gray-3 px-5 py-3 text-custom-sm font-semibold text-dark transition hover:border-blue hover:text-blue"
            >
              Back to home
            </Link>
          </div>
        </article>

        <aside className="grid gap-4 self-start">
          {[
            {
              title: "Quality You Can Trust",
              description: "Every product is presented with clear details so customers can buy with confidence.",
            },
            {
              title: "Fast Order Experience",
              description: "From browsing to checkout, the flow is designed to help customers complete orders quickly.",
            },
            {
              title: "Customer-First Support",
              description: "Customers can reach your team anytime through the contact flow for questions and assistance.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[10px] border border-gray-3 bg-white p-6 shadow-1"
            >
              <p className="text-custom-lg font-semibold tracking-tight text-dark">{item.title}</p>
              <p className="mt-3 text-custom-sm leading-7 text-body">{item.description}</p>
            </div>
          ))}

          <div className="overflow-hidden rounded-[10px] border border-gray-3 bg-white p-6 shadow-1">
            <p className="text-custom-xs font-semibold uppercase tracking-[0.16em] text-body">Need assistance?</p>
            <h3 className="mt-2 text-custom-lg font-semibold text-dark">Reach the store directly</h3>
            <p className="mt-3 text-custom-sm leading-7 text-body">
              Use the contact page form for inquiries, delivery details, and order support.
            </p>
            <Link
              href={getStorefrontContactHref(slug)}
              className="mt-4 inline-flex rounded-[6px] border border-gray-3 px-4 py-2 text-custom-sm font-semibold text-dark transition hover:border-blue hover:text-blue"
            >
              Open contact page
            </Link>
          </div>
        </aside>
      </section>

      <section className="mx-auto w-full max-w-[1170px] px-4 pb-12 sm:px-8 xl:px-0">
        <div className="rounded-[10px] border border-gray-3 bg-white p-6 shadow-1 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-custom-xs font-semibold uppercase tracking-[0.16em] text-body">Next step</p>
              <h2 className="mt-2 text-custom-xl font-semibold text-dark">Ready to browse the catalog?</h2>
            </div>
            <Link
              href={`/storefront/${slug}/shop`}
              className="rounded-[6px] bg-blue px-5 py-3 text-custom-sm font-semibold text-white transition hover:bg-blue-dark"
            >
              Explore products
            </Link>
          </div>
        </div>
      </section>
    </StorefrontShell>
  )
}
