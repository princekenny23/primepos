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

export default function StorefrontShopPage({ params }: { params: { slug: string } }) {
  const slug = params.slug
  const cartStorageKey = `storefront_cart_${slug}`
  const [isLoading, setIsLoading] = useState(true)
  const [config, setConfig] = useState<StorefrontConfig | null>(null)
  const [products, setProducts] = useState<StorefrontProduct[]>([])
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string>("")
  const [cartQtyByProductId, setCartQtyByProductId] = useState<Record<number, number>>({})
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [checkoutError, setCheckoutError] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [deliveryInstructions, setDeliveryInstructions] = useState("")
  const [viewProduct, setViewProduct] = useState<StorefrontProduct | null>(null)

  const theme = useMemo(
    () => ({
      ...DEFAULT_THEME,
      ...(config?.theme_settings || {}),
    }),
    [config]
  )

  const loadData = async () => {
    setIsLoading(true)
    setError("")
    try {
      const [cfg, cats, prods] = await Promise.all([
        storefrontService.getConfig(slug),
        storefrontService.getCategories(slug),
        storefrontService.getProducts(slug),
      ])
      setConfig(cfg)
      setCategories(cats)
      setProducts(prods)
    } catch (err: any) {
      setError(err?.message || "Failed to load storefront")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [slug])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(cartStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, number>
      const normalized: Record<number, number> = {}
      Object.entries(parsed).forEach(([key, value]) => {
        const id = Number(key)
        const qty = Number(value)
        if (!Number.isNaN(id) && qty > 0) {
          normalized[id] = qty
        }
      })
      setCartQtyByProductId(normalized)
    } catch {
      // ignore invalid cart payload
    }
  }, [cartStorageKey])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(cartStorageKey, JSON.stringify(cartQtyByProductId))
  }, [cartQtyByProductId, cartStorageKey])

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchCategory =
        selectedCategory === "all" || String(product.category || "") === selectedCategory
      const q = search.trim().toLowerCase()
      const matchSearch =
        q.length === 0 ||
        product.name.toLowerCase().includes(q) ||
        (product.description || "").toLowerCase().includes(q)
      return matchCategory && matchSearch
    })
  }, [products, selectedCategory, search])

  const cartItems = useMemo(() => {
    return products
      .filter((product) => (cartQtyByProductId[product.id] || 0) > 0)
      .map((product) => {
        const quantity = cartQtyByProductId[product.id]
        const unitPrice = parseFloat(product.display_price || "0")
        return {
          product,
          quantity,
          lineTotal: quantity * unitPrice,
        }
      })
  }, [products, cartQtyByProductId])

  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.lineTotal, 0), [cartItems])
  const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems])

  const addToCart = (productId: number) => {
    setCartQtyByProductId((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }))
  }

  const updateCartQty = (productId: number, nextQty: number) => {
    setCartQtyByProductId((prev) => {
      if (nextQty <= 0) {
        const { [productId]: _, ...rest } = prev
        return rest
      }
      return {
        ...prev,
        [productId]: nextQty,
      }
    })
  }

  const buildWhatsAppUrl = (storeWhatsApp: string, message: string) => {
    const digits = storeWhatsApp.replace(/\D/g, "")
    const encoded = encodeURIComponent(message)
    return `https://wa.me/${digits}?text=${encoded}`
  }

  const submitCheckout = async () => {
    if (!customerName.trim()) {
      setCheckoutError("Customer name is required.")
      return
    }
    if (!customerPhone.trim()) {
      setCheckoutError("Phone number is required.")
      return
    }
    if (cartItems.length === 0) {
      setCheckoutError("Your cart is empty.")
      return
    }

    const storeWhatsApp = config?.whatsapp_number || ""
    if (!storeWhatsApp) {
      setCheckoutError("This store has not configured a WhatsApp number yet.")
      return
    }

    setCheckoutError("")

    const checkoutPayload = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_address: customerAddress.trim(),
      notes: deliveryInstructions.trim() ? `Delivery notes: ${deliveryInstructions.trim()}` : "",
      items: cartItems.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      })),
    }

    const messageLines = [
      `*New Order — ${config?.name || slug}*`,
      "",
      `Customer: ${customerName.trim()}`,
      `Phone: ${customerPhone.trim()}`,
      customerAddress.trim() ? `Address: ${customerAddress.trim()}` : "",
      deliveryInstructions.trim() ? `Delivery notes: ${deliveryInstructions.trim()}` : "",
      "",
      "*Items:*",
      ...cartItems.map(
        (item) =>
          `• ${item.product.name} x${item.quantity} = ${config?.currency || ""} ${item.lineTotal.toFixed(2)}`
      ),
      "",
      `*Total: ${config?.currency || ""} ${cartTotal.toFixed(2)}*`,
    ]
      .filter(Boolean)
      .join("\n")

    const fallbackWaUrl = buildWhatsAppUrl(storeWhatsApp, messageLines)

    setIsSubmittingOrder(true)
    try {
      const response = await storefrontService.createOrder(slug, checkoutPayload)
      const waUrl = response?.whatsapp_url || fallbackWaUrl

      setCartQtyByProductId({})
      setShowCheckoutModal(false)
      setCustomerName("")
      setCustomerPhone("")
      setCustomerAddress("")
      setDeliveryInstructions("")

      window.open(waUrl, "_blank", "noopener,noreferrer")
    } catch (err: any) {
      setCheckoutError(err?.message || "Failed to create order. Please try again.")
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  const heroTitle = config?.seo_settings?.hero_title?.trim() || config?.name || "Shop"
  const heroSubtitle =
    config?.seo_settings?.hero_subtitle?.trim() ||
    "Browse products and place your WhatsApp order directly for fast processing."
  const contactPhone = config?.seo_settings?.contact_phone?.trim() || ""
  const whatsappCtaText = config?.seo_settings?.whatsapp_cta?.trim() || "WhatsApp Checkout"

  if (isLoading) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: DEFAULT_THEME.background, color: DEFAULT_THEME.foreground }}>
        <div className="mx-auto max-w-6xl px-4 py-12">Loading shop...</div>
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

  return (
    <main className="min-h-screen" style={{ backgroundColor: theme.background, color: theme.foreground }}>
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ borderColor: theme.border, backgroundColor: `${theme.card}ee` }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">{config.name}</p>
          <nav className="flex items-center gap-2 text-sm font-medium">
            <Link href={`/storefront/${slug}`} className="rounded-md px-3 py-1.5" style={{ backgroundColor: theme.accent }}>
              Home
            </Link>
            <Link href={`/storefront/${slug}/about`} className="rounded-md px-3 py-1.5" style={{ backgroundColor: theme.accent }}>
              About
            </Link>
            <Link href={`/storefront/${slug}/shop`} className="rounded-md px-3 py-1.5 text-white" style={{ backgroundColor: theme.primary }}>
              Shop
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b" style={{ borderColor: theme.border, background: `linear-gradient(120deg, ${theme.primary} 0%, ${theme.ring} 100%)`, color: theme.primary_foreground }}>
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] opacity-80">Shop</p>
          <h1 className="text-4xl font-black leading-tight">{heroTitle}</h1>
          <p className="mt-3 max-w-2xl text-sm opacity-90">{heroSubtitle}</p>
          {contactPhone && <p className="mt-2 text-xs opacity-85">Contact: {contactPhone}</p>}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border p-3" style={{ borderColor: theme.border, backgroundColor: theme.card }}>
          <p className="text-sm font-medium">
            Cart: {cartCount} item{cartCount === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{config.currency} {cartTotal.toFixed(2)}</p>
            <button
              type="button"
              onClick={() => setShowCheckoutModal(true)}
              disabled={cartItems.length === 0}
              className="rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}
            >
              {whatsappCtaText}
            </button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            className="h-11 w-full rounded-md border px-3 outline-none"
            style={{ borderColor: theme.border, backgroundColor: theme.card, color: theme.foreground }}
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
            className="h-11 min-w-[210px] rounded-md border px-3"
            style={{ borderColor: theme.border, backgroundColor: theme.card, color: theme.foreground }}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-lg border p-8 text-center" style={{ borderColor: theme.border, backgroundColor: theme.card }}>
            <p className="text-sm">No products found.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <article key={product.id} className="rounded-lg border p-4" style={{ borderColor: theme.border, backgroundColor: theme.card }}>
                {product.image_url ? (
                  <div className="mb-3 overflow-hidden rounded-md border" style={{ borderColor: theme.border }}>
                    <img src={resolveStorefrontImageUrl(product.image_url)} alt={product.name} className="h-44 w-full object-cover" loading="lazy" />
                  </div>
                ) : (
                  <div className="mb-3 flex h-44 items-center justify-center rounded-md border text-sm opacity-70" style={{ borderColor: theme.border, backgroundColor: theme.secondary }}>
                    No image
                  </div>
                )}

                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold leading-snug">{product.name}</h2>
                  <div className="flex flex-col items-end gap-1">
                    {product.is_new_stock && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}>
                        New
                      </span>
                    )}
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: theme.secondary, color: theme.foreground }}>
                      {product.stock > 0 ? `${product.stock} ${product.unit}` : "Out"}
                    </span>
                  </div>
                </div>

                <p className="mb-3 line-clamp-2 text-sm opacity-80">{product.description || "No description"}</p>

                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">{config.currency} {product.display_price}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewProduct(product)}
                      className="rounded-md border px-3 py-2 text-sm font-semibold"
                      style={{ borderColor: theme.border }}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-3 py-2 text-sm font-semibold"
                      style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}
                      disabled={product.stock <= 0}
                      onClick={() => addToCart(product.id)}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showCheckoutModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-xl border p-4 shadow-xl" style={{ borderColor: theme.border, backgroundColor: theme.card }}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">WhatsApp Checkout</h3>
              <button type="button" className="rounded-md border px-3 py-1 text-sm" style={{ borderColor: theme.border }} onClick={() => setShowCheckoutModal(false)}>
                Close
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="customer-name" className="text-xs font-medium">Customer Name</label>
                  <input id="customer-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-10 w-full rounded-md border px-3" style={{ borderColor: theme.border, backgroundColor: theme.background, color: theme.foreground }} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="customer-phone" className="text-xs font-medium">Phone</label>
                  <input id="customer-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="h-10 w-full rounded-md border px-3" style={{ borderColor: theme.border, backgroundColor: theme.background, color: theme.foreground }} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="customer-address" className="text-xs font-medium">Address</label>
                  <input id="customer-address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="h-10 w-full rounded-md border px-3" style={{ borderColor: theme.border, backgroundColor: theme.background, color: theme.foreground }} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="checkout-notes" className="text-xs font-medium">Delivery Instructions</label>
                  <textarea id="checkout-notes" value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} className="min-h-[90px] w-full rounded-md border p-3" style={{ borderColor: theme.border, backgroundColor: theme.background, color: theme.foreground }} />
                </div>

                {checkoutError && <p className="text-sm text-red-600">{checkoutError}</p>}
                <button type="button" onClick={submitCheckout} disabled={isSubmittingOrder} className="w-full rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60" style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}>
                  {isSubmittingOrder ? "Placing Order..." : "Place WhatsApp Order"}
                </button>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-semibold">Order Summary</h3>
                <div className="space-y-2">
                  {cartItems.map((item) => (
                    <div key={item.product.id} className="rounded-md border p-2" style={{ borderColor: theme.border }}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{item.product.name}</p>
                        <p className="text-sm font-semibold">{config.currency} {item.lineTotal.toFixed(2)}</p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button type="button" className="h-7 w-7 rounded border" style={{ borderColor: theme.border }} onClick={() => updateCartQty(item.product.id, item.quantity - 1)}>
                          -
                        </button>
                        <span className="text-sm">{item.quantity}</span>
                        <button type="button" className="h-7 w-7 rounded border" style={{ borderColor: theme.border }} onClick={() => updateCartQty(item.product.id, item.quantity + 1)}>
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-right text-base font-bold">Total: {config.currency} {cartTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewProduct && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-xl border p-4 shadow-xl" style={{ borderColor: theme.border, backgroundColor: theme.card }}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Product Details</h3>
              <button type="button" className="rounded-md border px-3 py-1 text-sm" style={{ borderColor: theme.border }} onClick={() => setViewProduct(null)}>
                Close
              </button>
            </div>

            {viewProduct.image_url ? (
              <div className="mb-3 overflow-hidden rounded-md border" style={{ borderColor: theme.border }}>
                <img src={resolveStorefrontImageUrl(viewProduct.image_url)} alt={viewProduct.name} className="h-64 w-full object-cover" />
              </div>
            ) : (
              <div className="mb-3 flex h-64 items-center justify-center rounded-md border text-sm opacity-70" style={{ borderColor: theme.border, backgroundColor: theme.secondary }}>
                No image
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xl font-bold">{viewProduct.name}</h4>
              <p className="text-sm opacity-85">{viewProduct.description || "No description"}</p>
              <p className="text-base font-semibold">{config.currency} {viewProduct.display_price}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm font-semibold"
                style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}
                onClick={() => addToCart(viewProduct.id)}
                disabled={viewProduct.stock <= 0}
              >
                Add to Cart
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ borderColor: theme.border }}
                onClick={() => {
                  if (!config?.whatsapp_number) return
                  const message = [
                    `Hi, I want to ask about this product from ${config?.name || slug}:`,
                    `Product: ${viewProduct.name}`,
                    `Price: ${config?.currency || ""} ${viewProduct.display_price}`,
                    viewProduct.description ? `Description: ${viewProduct.description}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n")
                  window.open(buildWhatsAppUrl(config.whatsapp_number, message), "_blank", "noopener,noreferrer")
                }}
                disabled={!config?.whatsapp_number}
              >
                Chat on WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {cartItems.length > 0 && !showCheckoutModal && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t p-3 md:hidden" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div>
              <p className="text-xs opacity-70">{cartCount} item{cartCount === 1 ? "" : "s"}</p>
              <p className="text-sm font-semibold">{config.currency} {cartTotal.toFixed(2)}</p>
            </div>
            <button type="button" onClick={() => setShowCheckoutModal(true)} className="rounded-md px-4 py-2 text-sm font-semibold" style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}>
              {whatsappCtaText}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
