"use client"

import Link from "next/link"
import { useEffect, type CSSProperties, type ReactNode } from "react"
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react"

export type StorefrontTheme = Record<string, string>

export type StorefrontPageVisibility = {
  home: boolean
  shop: boolean
  about: boolean
  contact: boolean
}

export type StorefrontSocialLinks = {
  facebook?: string
  instagram?: string
  x?: string
  linkedin?: string
  youtube?: string
}

export type StorefrontHeroStyle = "gradient" | "solid" | "glass"

export const DEFAULT_THEME: StorefrontTheme = {
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

function normalizeHex(color: string) {
  const hex = color.replace("#", "").trim()
  if (hex.length === 3) {
    return hex
      .split("")
      .map((value) => `${value}${value}`)
      .join("")
  }
  if (hex.length === 6) return hex
  return "0f172a"
}

export function hexToRgba(color: string, alpha: number) {
  const normalized = normalizeHex(color)
  const red = parseInt(normalized.slice(0, 2), 16)
  const green = parseInt(normalized.slice(2, 4), 16)
  const blue = parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function getStorefrontPageStyle(theme: StorefrontTheme): CSSProperties {
  return {
    backgroundColor: theme.background,
    color: theme.foreground,
    backgroundImage: `radial-gradient(circle at top left, ${hexToRgba(theme.ring, 0.14)}, transparent 28%), radial-gradient(circle at top right, ${hexToRgba(theme.primary, 0.1)}, transparent 24%), linear-gradient(180deg, ${hexToRgba(theme.secondary, 0.4)} 0%, ${theme.background} 32%)`,
  }
}

export function normalizeStorefrontHeroStyle(value?: string): StorefrontHeroStyle {
  if (value === "solid" || value === "glass" || value === "gradient") return value
  return "gradient"
}

export function getStorefrontHeroSurfaceStyle(theme: StorefrontTheme, styleMode: StorefrontHeroStyle): CSSProperties {
  if (styleMode === "solid") {
    return {
      backgroundColor: theme.primary,
      color: "#ffffff",
    }
  }

  if (styleMode === "glass") {
    return {
      backgroundColor: hexToRgba(theme.card, 0.84),
      border: `1px solid ${hexToRgba(theme.border, 0.9)}`,
      backdropFilter: "blur(6px)",
      color: "#1C274C",
    }
  }

  return {
    background: `linear-gradient(120deg, ${hexToRgba(theme.primary, 0.95)} 0%, #3C50E0 100%)`,
    color: "#ffffff",
  }
}

export function resolveStorefrontImageUrl(rawUrl?: string): string {
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

export function buildWhatsAppUrl(storeWhatsApp: string, message: string) {
  const digits = storeWhatsApp.replace(/\D/g, "")
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${digits}?text=${encoded}`
}

export function getStorefrontContactHref(slug: string) {
  return `/storefront/${slug}/contact`
}

export const DEFAULT_PAGE_VISIBILITY: StorefrontPageVisibility = {
  home: true,
  shop: true,
  about: true,
  contact: true,
}

export function normalizeStorefrontPageVisibility(value?: Record<string, any> | null): StorefrontPageVisibility {
  return {
    home: value?.home_page_active !== false,
    shop: value?.shop_page_active !== false,
    about: value?.about_page_active !== false,
    contact: value?.contact_page_active !== false,
  }
}

export function StorefrontShell({
  theme,
  children,
  templateKey = "nextcommerce_v1",
  storeName = "Your Store",
  footerSlug,
  footerAbout,
  socialLinks,
}: {
  theme: StorefrontTheme
  children: ReactNode
  templateKey?: string
  storeName?: string
  footerSlug?: string
  footerAbout?: string
  socialLinks?: StorefrontSocialLinks
}) {
  const isMinimal = templateKey === "minimal_v1"

  useEffect(() => {
    const revealTargets = Array.from(
      document.querySelectorAll<HTMLElement>("main section, main article, main aside")
    )

    revealTargets.forEach((target, index) => {
      target.classList.add("sf-reveal")
      target.style.setProperty("--sf-reveal-delay", `${(index % 8) * 70}ms`)
    })

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("sf-reveal-visible")
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    )

    revealTargets.forEach((target) => observer.observe(target))

    return () => {
      observer.disconnect()
    }
  }, [children])

  const footerSummary =
    footerAbout?.trim() ||
    (isMinimal
      ? `${storeName} offers a simple shopping experience for quick browsing and checkout.`
      : `${storeName} helps customers discover products quickly and complete orders with confidence.`)

  const quickLinks = footerSlug
    ? [
        { label: "Home", href: `/storefront/${footerSlug}` },
        { label: "Shop", href: `/storefront/${footerSlug}/shop` },
        { label: "About", href: `/storefront/${footerSlug}/about` },
        { label: "Contact", href: `/storefront/${footerSlug}/contact` },
      ]
    : []

  const normalizeExternalUrl = (raw?: string) => {
    if (!raw) return ""
    const value = raw.trim()
    if (!value) return ""
    if (/^https?:\/\//i.test(value)) return value
    return `https://${value}`
  }

  const socialItems = [
    { key: "facebook", href: normalizeExternalUrl(socialLinks?.facebook), icon: Facebook, label: "Facebook" },
    { key: "instagram", href: normalizeExternalUrl(socialLinks?.instagram), icon: Instagram, label: "Instagram" },
    { key: "x", href: normalizeExternalUrl(socialLinks?.x), icon: Twitter, label: "X" },
    { key: "linkedin", href: normalizeExternalUrl(socialLinks?.linkedin), icon: Linkedin, label: "LinkedIn" },
    { key: "youtube", href: normalizeExternalUrl(socialLinks?.youtube), icon: Youtube, label: "YouTube" },
  ].filter((item) => Boolean(item.href))

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-white text-dark font-euclid-circular-a" style={isMinimal ? { backgroundColor: theme.background, color: theme.foreground } : getStorefrontPageStyle(theme)}>
      <div className="relative z-[1]">{children}</div>
      <footer className={`mt-16 border-t border-gray-3 ${isMinimal ? "bg-white" : "bg-white/95"}`}>
        <div className="mx-auto w-full max-w-[1170px] px-4 py-10 sm:px-8 lg:px-0">
          <div className="overflow-hidden rounded-[14px] border border-gray-3 bg-gradient-to-br from-white via-[#F8FBFF] to-[#F2F7FF] p-6 shadow-1 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-3">
          <div>
            <p className="text-custom-lg font-semibold text-dark">{storeName}</p>
            <p className="mt-3 max-w-sm text-custom-sm text-body">{footerSummary}</p>
          </div>
          <div>
            <p className="text-custom-sm font-semibold uppercase tracking-[0.15em] text-dark">Quick Links</p>
            {quickLinks.length > 0 ? (
              <ul className="mt-3 space-y-2 text-custom-sm text-body">
                {quickLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="inline-flex items-center rounded-md px-2 py-1 transition hover:bg-white hover:text-blue">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="mt-3 space-y-2 text-custom-sm text-body">
                <li>Browse products</li>
                <li>Review cart and checkout</li>
                <li>Contact and support</li>
              </ul>
            )}
          </div>
          <div>
            <p className="text-custom-sm font-semibold uppercase tracking-[0.15em] text-dark">Follow Us</p>
            {socialItems.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {socialItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <a
                      key={item.key}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={item.label}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-3 bg-white text-dark transition hover:-translate-y-0.5 hover:border-blue hover:text-blue"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  )
                })}
              </div>
            ) : (
              <p className="mt-3 text-custom-sm text-body">Add social links in storefront settings to display your channels here.</p>
            )}
          </div>
        </div>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .sf-reveal {
          opacity: 0;
          transform: translateY(22px);
          transition: opacity 480ms ease var(--sf-reveal-delay, 0ms), transform 480ms ease var(--sf-reveal-delay, 0ms);
          will-change: opacity, transform;
        }

        .sf-reveal.sf-reveal-visible {
          opacity: 1;
          transform: translateY(0);
        }

        @media (prefers-reduced-motion: reduce) {
          .sf-reveal,
          .sf-reveal.sf-reveal-visible {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
      `}</style>
    </main>
  )
}

export function StorefrontHeader({
  slug,
  storeName,
  theme,
  active,
  pageVisibility = DEFAULT_PAGE_VISIBILITY,
}: {
  slug: string
  storeName: string
  theme: StorefrontTheme
  active: "home" | "about" | "shop" | "contact"
  pageVisibility?: StorefrontPageVisibility
}) {
  const navItems = [
    { key: "home", label: "Home", href: `/storefront/${slug}`, enabled: pageVisibility.home },
    { key: "shop", label: "Shop", href: `/storefront/${slug}/shop`, enabled: pageVisibility.shop },
    { key: "about", label: "About", href: `/storefront/${slug}/about`, enabled: pageVisibility.about },
    { key: "contact", label: "Contact", href: `/storefront/${slug}/contact`, enabled: pageVisibility.contact },
  ].filter((item) => item.enabled)

  return (
    <header
      className="sticky left-0 top-0 z-9999 w-full border-b backdrop-blur"
      style={{
        borderColor: hexToRgba(theme.border, 0.9),
        backgroundColor: hexToRgba(theme.card, 0.95),
        boxShadow: `0 6px 24px ${hexToRgba(theme.foreground, 0.08)}`,
      }}
    >
      <div className="mx-auto flex w-full max-w-[1170px] flex-col gap-4 px-4 py-4 sm:px-7.5 lg:flex-row lg:items-center lg:justify-between xl:px-0">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-custom-sm font-semibold text-white"
            style={{ backgroundColor: theme.primary }}
            aria-hidden
          >
            {storeName.trim().charAt(0).toUpperCase() || "S"}
          </div>
          <p className="text-custom-lg font-semibold text-dark">{storeName}</p>
        </div>
        {navItems.length > 0 ? (
          <nav className="flex flex-wrap items-center gap-2 text-custom-sm font-medium">
            {navItems.map((item) => {
              const isActive = item.key === active
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="rounded-md px-4 py-2.5 transition-all duration-200"
                  style={
                    isActive
                      ? {
                          backgroundColor: "#3C50E0",
                          color: "#ffffff",
                          boxShadow: `0 8px 20px ${hexToRgba("#3C50E0", 0.28)}`,
                        }
                      : {
                          backgroundColor: "#ffffff",
                          color: "#1C274C",
                          border: `1px solid ${hexToRgba(theme.border, 0.85)}`,
                        }
                  }
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        ) : null}
      </div>
    </header>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl space-y-3">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-60">{eyebrow}</p> : null}
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        {description ? <p className="text-sm leading-7 opacity-75 sm:text-base">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function StorefrontImage({
  src,
  alt,
  theme,
  className,
  fallbackLabel = "No image",
}: {
  src?: string
  alt: string
  theme: StorefrontTheme
  className?: string
  fallbackLabel?: string
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border text-sm font-medium opacity-70 ${className || ""}`}
        style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.secondary, 0.95) }}
      >
        {fallbackLabel}
      </div>
    )
  }

  return (
    <div className={`overflow-hidden rounded-2xl border ${className || ""}`} style={{ borderColor: theme.border }}>
      <img src={resolveStorefrontImageUrl(src)} alt={alt} className="h-full w-full object-cover" loading="lazy" />
    </div>
  )
}
