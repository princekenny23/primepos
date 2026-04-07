"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { storefrontService, type StorefrontProduct } from "@/lib/services/storefrontService"

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
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Product</h1>
          <Link href={`/storefront/${slug}`} className="text-sm font-medium text-teal-700 hover:underline">
            Back to Store
          </Link>
        </div>

        {isLoading && <p className="rounded-lg border bg-white p-6 text-sm">Loading product...</p>}
        {!isLoading && error && <p className="rounded-lg border bg-white p-6 text-sm text-red-600">{error}</p>}

        {!isLoading && product && (
          <section className="rounded-lg border bg-white p-6">
            {product.image_url ? (
              <div className="mb-4 overflow-hidden rounded-md border">
                <img
                  src={resolveStorefrontImageUrl(product.image_url)}
                  alt={product.name}
                  className="h-64 w-full object-cover"
                />
              </div>
            ) : (
              <div className="mb-4 flex h-64 items-center justify-center rounded-md border bg-slate-50 text-sm text-slate-500">
                No image available
              </div>
            )}
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{product.category_name || "Product"}</p>
            <h2 className="mt-1 text-2xl font-semibold">{product.name}</h2>
            <p className="mt-3 text-sm text-slate-700">{product.description || "No description available."}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Price</p>
                <p className="text-lg font-bold">{product.display_price}</p>
              </div>
              <div className="rounded-md border bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Stock</p>
                <p className="text-lg font-bold">{product.stock} {product.unit}</p>
              </div>
            </div>

            <p className="mt-5 text-xs text-slate-500">Add this product from the main storefront page cart flow.</p>
          </section>
        )}
      </div>
    </main>
  )
}
