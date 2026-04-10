"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Trash2 } from "lucide-react"
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
    shop_header_title?: string
    shop_header_subtitle?: string
    hero_title?: string
    hero_subtitle?: string
    contact_phone?: string
    whatsapp_cta?: string
  }
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

  const heroTitle =
    config?.seo_settings?.shop_header_title?.trim() ||
    config?.seo_settings?.hero_title?.trim() ||
    config?.name ||
    "Shop"
  const heroSubtitle =
    config?.seo_settings?.shop_header_subtitle?.trim() ||
    config?.seo_settings?.hero_subtitle?.trim() ||
    "Browse products and place your WhatsApp order directly for fast processing."
  const contactPhone = config?.seo_settings?.contact_phone?.trim() || ""
  const whatsappCtaText = config?.seo_settings?.whatsapp_cta?.trim() || "WhatsApp Checkout"

  if (isLoading) {
    return (
      <StorefrontShell theme={DEFAULT_THEME}>
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 text-sm shadow-sm backdrop-blur">
            Loading shop...
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

  const inputCardStyle = {
    borderColor: theme.border,
    backgroundColor: hexToRgba(theme.card, 0.94),
    color: theme.foreground,
  }

  const surfaceStyle = {
    borderColor: theme.border,
    backgroundColor: hexToRgba(theme.card, 0.94),
  }

  return (
    <StorefrontShell theme={theme}>
      <StorefrontHeader slug={slug} storeName={config.name} theme={theme} active="shop" />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14 lg:py-16">
        <div
          className="overflow-hidden rounded-[2rem] border p-6 shadow-sm sm:p-8 lg:p-10"
          style={{
            borderColor: theme.border,
            background: `linear-gradient(135deg, ${hexToRgba(theme.primary, 0.98)} 0%, ${hexToRgba(theme.ring, 0.9)} 100%)`,
            color: theme.primary_foreground,
            boxShadow: `0 24px 64px ${hexToRgba(theme.primary, 0.22)}`,
          }}
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] opacity-80">Curated catalog</p>
              <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">{heroTitle}</h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 opacity-90 sm:text-base">{heroSubtitle}</p>
              {contactPhone ? <p className="mt-6 text-sm font-medium opacity-85">Contact: {contactPhone}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[1.5rem] border p-5 backdrop-blur" style={{ borderColor: hexToRgba(theme.primary_foreground, 0.18), backgroundColor: hexToRgba(theme.primary_foreground, 0.12) }}>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-75">Products</p>
                <p className="mt-3 text-3xl font-bold">{products.length}</p>
                <p className="mt-2 text-sm opacity-80">Items available in the public catalog.</p>
              </div>
              <div className="rounded-[1.5rem] border p-5 backdrop-blur" style={{ borderColor: hexToRgba(theme.primary_foreground, 0.18), backgroundColor: hexToRgba(theme.primary_foreground, 0.1) }}>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-75">Categories</p>
                <p className="mt-3 text-3xl font-bold">{categories.length}</p>
                <p className="mt-2 text-sm opacity-80">Refine the catalog with faster browsing tools.</p>
              </div>
              <div className="rounded-[1.5rem] border p-5 backdrop-blur" style={{ borderColor: hexToRgba(theme.primary_foreground, 0.18), backgroundColor: hexToRgba(theme.primary_foreground, 0.08) }}>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-75">Cart total</p>
                <p className="mt-3 text-2xl font-bold">{config.currency} {cartTotal.toFixed(2)}</p>
                <p className="mt-2 text-sm opacity-80">{cartCount} item{cartCount === 1 ? "" : "s"} ready for WhatsApp checkout.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-[2rem] border p-4 shadow-sm sm:p-5" style={surfaceStyle}>
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto] lg:items-end">
            <div>
              <label htmlFor="storefront-search" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] opacity-55">
                Search products
              </label>
              <input
                id="storefront-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product name or description"
                aria-label="Search products"
                className="h-12 w-full rounded-xl border px-4 text-sm outline-none transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                style={inputCardStyle}
              />
            </div>
            <div>
              <label htmlFor="storefront-category" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] opacity-55">
                Category
              </label>
              <select
                id="storefront-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter by category"
                className="h-12 w-full rounded-xl border px-4 text-sm outline-none transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                style={inputCardStyle}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setShowCheckoutModal(true)}
              disabled={cartItems.length === 0}
              className="h-12 rounded-xl px-5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}
            >
              {whatsappCtaText}
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <SectionHeading
              eyebrow="Catalog"
              title="Shop with clearer cards and faster scanning"
              description={`Showing ${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"} with a stronger price hierarchy, consistent image framing, and quicker add-to-cart actions.`}
            />

            {filteredProducts.length === 0 ? (
              <div className="rounded-[2rem] border p-10 text-center shadow-sm" style={surfaceStyle}>
                <p className="text-lg font-semibold">No products found.</p>
                <p className="mt-2 text-sm opacity-70">Adjust your search or switch the category filter to see more items.</p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <article
                    key={product.id}
                    className="group flex h-full flex-col rounded-[1.75rem] border p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                    style={surfaceStyle}
                  >
                    <StorefrontImage src={product.image_url} alt={product.name} theme={theme} className="aspect-[4/3] w-full" />

                    <div className="mt-4 flex flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-50">{product.category_name || "Product"}</p>
                          <h2 className="mt-2 text-lg font-semibold leading-tight">{product.name}</h2>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {product.is_new_stock ? (
                            <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}>
                              New
                            </span>
                          ) : null}
                          <span
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              backgroundColor: product.stock > 0 ? hexToRgba(theme.secondary, 0.95) : hexToRgba(theme.foreground, 0.08),
                              color: theme.foreground,
                            }}
                          >
                            {product.stock > 0 ? `${product.stock} ${product.unit}` : "Out of stock"}
                          </span>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 opacity-75">{product.description || "No description"}</p>

                      <div className="mt-5 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-45">Price</p>
                          <p className="mt-1 text-2xl font-bold tracking-tight">{config.currency} {product.display_price}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewProduct(product)}
                            className="rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                            style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.74), color: theme.foreground }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}
                            disabled={product.stock <= 0}
                            onClick={() => addToCart(product.id)}
                          >
                            Add to cart
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-[2rem] border p-5 shadow-sm" style={surfaceStyle}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-55">Cart summary</p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold tracking-tight">{config.currency} {cartTotal.toFixed(2)}</p>
                  <p className="mt-1 text-sm opacity-70">{cartCount} item{cartCount === 1 ? "" : "s"} selected</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(true)}
                  disabled={cartItems.length === 0}
                  className="rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}
                >
                  Checkout
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {cartItems.length === 0 ? (
                  <div className="rounded-[1.5rem] border p-4 text-sm opacity-70" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.7) }}>
                    Add products to your cart to preview the WhatsApp order summary here.
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.product.id} className="rounded-[1.25rem] border p-4" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.7) }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold leading-6">{item.product.name}</p>
                          <p className="text-xs opacity-60">Qty {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{config.currency} {item.lineTotal.toFixed(2)}</p>
                          <button
                            type="button"
                            aria-label={`Remove ${item.product.name} from cart`}
                            onClick={() => updateCartQty(item.product.id, 0)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-200 hover:-translate-y-0.5"
                            style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.75), color: theme.foreground }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {showCheckoutModal ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center py-6">
            <div className="w-full max-w-6xl rounded-[2rem] border shadow-2xl" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.card, 0.98) }}>
              <div className="flex flex-col gap-4 border-b p-6 sm:flex-row sm:items-start sm:justify-between" style={{ borderColor: theme.border }}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-55">Checkout</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight">WhatsApp order confirmation</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 opacity-70">Enter your delivery details, review your order, and send the purchase to the store on WhatsApp.</p>
                </div>
                <button
                  type="button"
                  className="rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                  style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.7), color: theme.foreground }}
                  onClick={() => setShowCheckoutModal(false)}
                >
                  Close
                </button>
              </div>

              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="grid gap-5">
                  <div className="grid gap-5 rounded-[1.75rem] border p-5 sm:grid-cols-2" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.65) }}>
                    <div className="space-y-2 sm:col-span-2">
                      <label htmlFor="customer-name" className="text-xs font-semibold uppercase tracking-[0.18em] opacity-55">Customer name</label>
                      <input
                        id="customer-name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="h-12 w-full rounded-xl border px-4 text-sm outline-none transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                        style={inputCardStyle}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="customer-phone" className="text-xs font-semibold uppercase tracking-[0.18em] opacity-55">Phone</label>
                      <input
                        id="customer-phone"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="h-12 w-full rounded-xl border px-4 text-sm outline-none transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                        style={inputCardStyle}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="customer-address" className="text-xs font-semibold uppercase tracking-[0.18em] opacity-55">Address</label>
                      <input
                        id="customer-address"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        className="h-12 w-full rounded-xl border px-4 text-sm outline-none transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                        style={inputCardStyle}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label htmlFor="checkout-notes" className="text-xs font-semibold uppercase tracking-[0.18em] opacity-55">Delivery instructions</label>
                      <textarea
                        id="checkout-notes"
                        value={deliveryInstructions}
                        onChange={(e) => setDeliveryInstructions(e.target.value)}
                        className="min-h-[140px] w-full rounded-xl border p-4 text-sm outline-none transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                        style={inputCardStyle}
                      />
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border p-5" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.65) }}>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-55">Why this is better</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {[
                        "Clear customer detail capture",
                        "Visible order review before sending",
                        "Single CTA into WhatsApp checkout",
                      ].map((item) => (
                        <div key={item} className="rounded-[1.25rem] border p-4 text-sm font-medium" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.card, 0.92) }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  {checkoutError ? <p className="text-sm font-medium text-red-600">{checkoutError}</p> : null}
                </div>

                <div className="rounded-[1.75rem] border p-5" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.7) }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-55">Order summary</p>
                      <h4 className="mt-2 text-xl font-bold tracking-tight">{cartCount} item{cartCount === 1 ? "" : "s"} in cart</h4>
                    </div>
                    <p className="text-xl font-bold">{config.currency} {cartTotal.toFixed(2)}</p>
                  </div>

                  <div className="mt-5 space-y-3">
                    {cartItems.map((item) => (
                      <div key={item.product.id} className="rounded-[1.25rem] border p-4" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.card, 0.92) }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold leading-6">{item.product.name}</p>
                            <p className="text-xs opacity-60">{config.currency} {item.product.display_price} each</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{config.currency} {item.lineTotal.toFixed(2)}</p>
                            <button
                              type="button"
                              aria-label={`Remove ${item.product.name} from cart`}
                              onClick={() => updateCartQty(item.product.id, 0)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-200 hover:-translate-y-0.5"
                              style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.75), color: theme.foreground }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border text-base font-semibold"
                            style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.75) }}
                            onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                          >
                            -
                          </button>
                          <span className="min-w-6 text-center text-sm font-semibold">{item.quantity}</span>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border text-base font-semibold"
                            style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.75) }}
                            onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={submitCheckout}
                    disabled={isSubmittingOrder}
                    className="mt-5 w-full rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}
                  >
                    {isSubmittingOrder ? "Placing order..." : "Place WhatsApp order"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewProduct ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center py-6">
            <div className="w-full max-w-4xl rounded-[2rem] border shadow-2xl" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.card, 0.98) }}>
              <div className="flex items-center justify-between border-b p-6" style={{ borderColor: theme.border }}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-55">Quick view</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight">Product details</h3>
                </div>
                <button
                  type="button"
                  className="rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                  style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.72), color: theme.foreground }}
                  onClick={() => setViewProduct(null)}
                >
                  Close
                </button>
              </div>

              <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
                <StorefrontImage src={viewProduct.image_url} alt={viewProduct.name} theme={theme} className="aspect-[4/3] w-full" />

                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-55">{viewProduct.category_name || "Product"}</p>
                    <h4 className="mt-2 text-3xl font-bold tracking-tight">{viewProduct.name}</h4>
                    <p className="mt-4 text-base leading-8 opacity-75">{viewProduct.description || "No description"}</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border p-4" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.68) }}>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-50">Price</p>
                      <p className="mt-2 text-2xl font-bold">{config.currency} {viewProduct.display_price}</p>
                    </div>
                    <div className="rounded-[1.25rem] border p-4" style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.68) }}>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-50">Availability</p>
                      <p className="mt-2 text-2xl font-bold">{viewProduct.stock > 0 ? `${viewProduct.stock} ${viewProduct.unit}` : "Out"}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}
                      onClick={() => addToCart(viewProduct.id)}
                      disabled={viewProduct.stock <= 0}
                    >
                      Add to cart
                    </button>
                    <Link
                      href={`/storefront/${slug}/products/${viewProduct.id}`}
                      className="rounded-xl border px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                      style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.72), color: theme.foreground }}
                    >
                      Open full page
                    </Link>
                    <button
                      type="button"
                      className="rounded-xl border px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ borderColor: theme.border, backgroundColor: hexToRgba(theme.background, 0.72), color: theme.foreground }}
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
            </div>
          </div>
        </div>
      ) : null}

      {cartItems.length > 0 && !showCheckoutModal ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t p-3 lg:hidden" style={{ backgroundColor: hexToRgba(theme.card, 0.97), borderColor: theme.border, boxShadow: `0 -16px 40px ${hexToRgba(theme.foreground, 0.08)}` }}>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-50">Cart</p>
              <p className="mt-1 text-sm font-semibold">{cartCount} item{cartCount === 1 ? "" : "s"} • {config.currency} {cartTotal.toFixed(2)}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCheckoutModal(true)}
              className="rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200"
              style={{ backgroundColor: theme.primary, color: theme.primary_foreground }}
            >
              {whatsappCtaText}
            </button>
          </div>
        </div>
      ) : null}
    </StorefrontShell>
  )
}
