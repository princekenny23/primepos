"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { storefrontService, type StorefrontProduct } from "@/lib/services/storefrontService"
import { DEFAULT_THEME, hexToRgba, StorefrontImage, StorefrontShell } from "@/app/storefront/_components/storefront-ui"

export default function StorefrontProductDetailPage({
  params,
}: {
  params: { slug: string; product_id: string }
}) {
  const slug = params.slug
  const productId = Number(params.product_id)
  const [isLoading, setIsLoading] = useState(true)
  const [product, setProduct] = useState<StorefrontProduct | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const loadProduct = async () => {
      if (Number.isNaN(productId)) {
        setError("Invalid product.")
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setError("")
      try {
        const response = await storefrontService.getProduct(slug, productId)
        setProduct(response)
      } catch (err: any) {
        setError(err?.message || "Failed to load product")
      } finally {
        setIsLoading(false)
      }
    }
    loadProduct()
  }, [slug, productId])

  return (
    <StorefrontShell theme={DEFAULT_THEME}>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14 lg:py-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Product detail</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">A cleaner product presentation</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/storefront/${slug}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-all duration-200 hover:-translate-y-0.5">
              Back to store
            </Link>
            <Link href={`/storefront/${slug}/shop`} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5">
              Open shop
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 text-sm shadow-sm backdrop-blur">Loading product...</div>
        ) : null}

        {!isLoading && error ? (
          <div className="rounded-[2rem] border border-red-200 bg-white/90 p-8 text-sm font-medium text-red-600 shadow-sm backdrop-blur">{error}</div>
        ) : null}

        {!isLoading && product ? (
          <section className="grid gap-8 rounded-[2rem] border border-slate-200/80 bg-white/92 p-6 shadow-sm backdrop-blur lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:p-8">
            <StorefrontImage src={product.image_url} alt={product.name} theme={DEFAULT_THEME} className="aspect-[4/3] w-full" fallbackLabel="No image available" />

            <div className="flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{product.category_name || "Product"}</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{product.name}</h2>
                <p className="mt-5 text-base leading-8 text-slate-600">{product.description || "No description available."}</p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Price</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{product.display_price}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Stock</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{product.stock} {product.unit}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white" style={{ boxShadow: `0 20px 40px ${hexToRgba("#0f172a", 0.14)}` }}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Next step</p>
                <p className="mt-3 text-lg font-semibold">Add this product from the shop page cart flow.</p>
                <p className="mt-2 text-sm leading-7 text-white/75">The updated shop experience now gives this product a stronger card, quick view, and smoother checkout path.</p>
                <Link href={`/storefront/${slug}/shop`} className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-all duration-200 hover:-translate-y-0.5">
                  Browse in shop
                </Link>
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </StorefrontShell>
  )
}
