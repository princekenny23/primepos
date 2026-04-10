"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { storefrontService } from "@/lib/services/storefrontService"
import {
  DEFAULT_THEME,
  hexToRgba,
  SectionHeading,
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
    contact_phone?: string
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

  const aboutTitle = config?.seo_settings?.about_title?.trim() || "About Our Store"
  const aboutDescription =
    config?.seo_settings?.about_description?.trim() ||
    "We are a trusted retail store committed to quality products, fair prices, and great service."
  const contactPhone = config?.seo_settings?.contact_phone?.trim() || ""

  return (
    <StorefrontShell theme={theme}>
      <StorefrontHeader slug={slug} storeName={config.name} theme={theme} active="about" />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14 lg:py-16">
        <div
          className="rounded-[2rem] border p-8 shadow-sm sm:p-10"
          style={{
            borderColor: theme.border,
            background: `linear-gradient(135deg, ${hexToRgba(theme.primary, 0.98)} 0%, ${hexToRgba(theme.ring, 0.92)} 100%)`,
            color: theme.primary_foreground,
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] opacity-80">About the brand</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">{aboutTitle}</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 opacity-90 sm:text-base">
            Learn what sets this storefront apart, how it serves customers, and how to get in touch when you need help.
          </p>
          {contactPhone ? <p className="mt-6 text-sm font-medium opacity-85">Contact: {contactPhone}</p> : null}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <article className="rounded-[2rem] border p-7 shadow-sm sm:p-8" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.card, 0.94) }}>
          <SectionHeading
            eyebrow="Story"
            title="A clearer, more readable storefront profile"
            description="The public-facing description now has more breathing room, stronger rhythm, and easier scanning on both desktop and mobile."
          />

          <div className="space-y-5 text-base leading-8 opacity-85">
            {aboutDescription.split("\n").filter(Boolean).map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/storefront/${slug}/shop`}
              className="rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}
            >
              Go to shop
            </Link>
            <Link
              href={`/storefront/${slug}`}
              className="rounded-xl border px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.72), color: theme.foreground }}
            >
              Back to home
            </Link>
          </div>
        </article>

        <aside className="grid gap-4 self-start">
          {[
            {
              title: "Trusted presentation",
              description: "Clearer typography and spacing make brand information feel more credible and easier to absorb.",
            },
            {
              title: "Direct shopping flow",
              description: "Visitors can move from discovery to browsing without friction through stronger CTA placement.",
            },
            {
              title: "Responsive by default",
              description: "The updated layout holds its structure cleanly across phone, tablet, and desktop widths.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[1.5rem] border p-6 shadow-sm"
              style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.card, 0.9) }}
            >
              <p className="text-lg font-semibold tracking-tight">{item.title}</p>
              <p className="mt-3 text-sm leading-7 opacity-75">{item.description}</p>
            </div>
          ))}
        </aside>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-8">
        <div className="rounded-[2rem] border p-6 shadow-sm sm:p-8" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.card, 0.9) }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-55">Next step</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">Ready to browse the catalog?</h2>
            </div>
            <Link
              href={`/storefront/${slug}/shop`}
              className="rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}
            >
              Explore products
            </Link>
          </div>
        </div>
      </section>
    </StorefrontShell>
  )
}
