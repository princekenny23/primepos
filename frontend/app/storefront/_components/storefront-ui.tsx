"use client"

import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"

export type StorefrontTheme = Record<string, string>

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

export function StorefrontShell({ theme, children }: { theme: StorefrontTheme; children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-x-hidden" style={getStorefrontPageStyle(theme)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem]"
        style={{
          background: `linear-gradient(180deg, ${hexToRgba(theme.primary, 0.08)} 0%, transparent 70%)`,
        }}
      />
      <div className="relative">{children}</div>
    </main>
  )
}

export function StorefrontHeader({
  slug,
  storeName,
  theme,
  active,
}: {
  slug: string
  storeName: string
  theme: StorefrontTheme
  active: "home" | "about" | "shop"
}) {
  const navItems = [
    { key: "home", label: "Home", href: `/storefront/${slug}` },
    { key: "about", label: "About", href: `/storefront/${slug}/about` },
    { key: "shop", label: "Shop", href: `/storefront/${slug}/shop` },
  ] as const

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-xl"
      style={{
        borderColor: hexToRgba(theme.border, 0.95),
        backgroundColor: hexToRgba(theme.card, 0.88),
        boxShadow: `0 10px 30px ${hexToRgba(theme.foreground, 0.06)}`,
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-60">Storefront</p>
          <p className="text-lg font-semibold tracking-tight">{storeName}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {navItems.map((item) => {
            const isActive = item.key === active
            return (
              <Link
                key={item.key}
                href={item.href}
                className="rounded-xl px-4 py-2 transition-all duration-200"
                style={
                  isActive
                    ? {
                        backgroundColor: theme.primary,
                        color: theme.primary_foreground,
                        boxShadow: `0 10px 24px ${hexToRgba(theme.primary, 0.28)}`,
                      }
                    : {
                        backgroundColor: hexToRgba(theme.card, 0.72),
                        color: theme.foreground,
                        border: `1px solid ${hexToRgba(theme.border, 0.9)}`,
                      }
                }
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
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