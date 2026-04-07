"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { storefrontService } from "@/lib/services/storefrontService"

type StorefrontConfig = {
  name: string
  slug: string
  currency: string
  theme_settings?: Record<string, string>
  seo_settings?: {
    about_title?: string
    about_description?: string
    contact_phone?: string
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

  if (isLoading) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: DEFAULT_THEME.background, color: DEFAULT_THEME.foreground }}>
        <div className="mx-auto max-w-6xl px-4 py-12">Loading about page...</div>
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

  const aboutTitle = config?.seo_settings?.about_title?.trim() || "About Our Store"
  const aboutDescription =
    config?.seo_settings?.about_description?.trim() ||
    "We are a trusted retail store committed to quality products, fair prices, and great service."
  const contactPhone = config?.seo_settings?.contact_phone?.trim() || ""

  return (
    <main className="min-h-screen" style={{ backgroundColor: theme.background, color: theme.foreground }}>
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ borderColor: theme.border, backgroundColor: `${theme.card}ee` }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">{config.name}</p>
          <nav className="flex items-center gap-2 text-sm font-medium">
            <Link href={`/storefront/${slug}`} className="rounded-md px-3 py-1.5" style={{ backgroundColor: theme.accent }}>
              Home
            </Link>
            <Link href={`/storefront/${slug}/about`} className="rounded-md px-3 py-1.5 text-white" style={{ backgroundColor: theme.primary }}>
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
          <p className="mb-2 text-xs uppercase tracking-[0.2em] opacity-80">About Us</p>
          <h1 className="text-4xl font-black leading-tight">{aboutTitle}</h1>
          {contactPhone && <p className="mt-3 text-sm opacity-90">Contact: {contactPhone}</p>}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10">
        <article className="rounded-xl border p-6" style={{ borderColor: theme.border, backgroundColor: theme.card }}>
          {aboutDescription.split("\n").filter(Boolean).map((paragraph, index) => (
            <p key={index} className="mb-4 whitespace-pre-line text-sm leading-7 opacity-90">
              {paragraph}
            </p>
          ))}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/storefront/${slug}/shop`} className="rounded-md px-4 py-2 text-sm font-semibold" style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}>
              Go to Shop
            </Link>
            <Link href={`/storefront/${slug}/about`} className="rounded-md border px-4 py-2 text-sm font-semibold" style={{ borderColor: theme.border }}>
              Refresh About
            </Link>
          </div>
        </article>
      </section>
    </main>
  )
}
