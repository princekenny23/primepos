"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, TrendingDown, CheckCircle2, AlertTriangle } from "lucide-react"
import type { Product, ProductUnit } from "@/lib/types"

interface StockDisplayProps {
  product: Product
}

/**
 * Get stock status color based on threshold
 */
function getStockStatus(available: number, threshold: number): "critical" | "low" | "healthy" {
  if (available === 0) return "critical"
  if (threshold > 0 && available <= threshold) return "low"
  if (threshold > 0 && available <= threshold * 1.5) return "low"
  return "healthy"
}

/**
 * Convert quantity between units
 */
function convertQuantity(quantity: number, unit: ProductUnit): string {
  if (unit.conversion_factor === 1) {
    return `${quantity} pcs`
  }
  const converted = quantity * unit.conversion_factor
  return `${quantity} ${unit.unit_name} (${converted} pcs)`
}

/**
 * Get color classes based on stock status
 */
function getStatusColor(status: "critical" | "low" | "healthy") {
  switch (status) {
    case "critical":
      return "bg-red-50 border-red-200 text-red-900"
    case "low":
      return "bg-orange-50 border-orange-200 text-orange-900"
    case "healthy":
      return "bg-green-50 border-green-200 text-green-900"
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status: "critical" | "low" | "healthy") {
  switch (status) {
    case "critical":
      return <AlertCircle className="w-5 h-5 text-red-600" />
    case "low":
      return <AlertTriangle className="w-5 h-5 text-orange-600" />
    case "healthy":
      return <CheckCircle2 className="w-5 h-5 text-green-600" />
  }
}

/**
 * Get status label
 */
function getStatusLabel(status: "critical" | "low" | "healthy") {
  switch (status) {
    case "critical":
      return "Out of Stock / Critical"
    case "low":
      return "Low Stock"
    case "healthy":
      return "Healthy Stock"
  }
}

export function StockDisplay({ product }: StockDisplayProps) {
  // Use product stock
  const baseQuantity = product.stock || 0
  const threshold = product.lowStockThreshold || 0
  const status = getStockStatus(baseQuantity, threshold)

  return (
    <Card className={`border-2 ${getStatusColor(status)}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            <div>
              <CardTitle className="text-lg">
                {product.name}
              </CardTitle>
              <CardDescription>Stock Status</CardDescription>
            </div>
          </div>
          <Badge variant={status === "healthy" ? "default" : "destructive"}>
            {getStatusLabel(status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main stock display */}
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600 mb-2">Available Quantity</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-900">{baseQuantity}</span>
            <span className="text-lg text-gray-600">
              {product.selling_units && product.selling_units.length > 0
                ? product.selling_units[0]?.unit_name || "pieces"
                : "pieces"}
            </span>
          </div>
        </div>

        {/* Threshold info */}
        {threshold > 0 && (
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-600">Low Stock Threshold</p>
              <p className="text-sm font-medium">{threshold} units</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-colors ${
                  status === "healthy"
                    ? "bg-green-500"
                    : status === "low"
                    ? "bg-orange-500"
                    : "bg-red-500"
                }`}
                // eslint-disable-next-line no-inline-styles
                style={{
                  width: `${Math.min((baseQuantity / (threshold * 2)) * 100, 100)}%`,
                } as React.CSSProperties}
              />
            </div>
          </div>
        )}

        {/* Per-unit breakdown */}
        {product.selling_units && product.selling_units.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Stock by Unit</p>
            <div className="space-y-2">
              {product.selling_units.map((unit) => {
                const unitQuantity =
                  unit.conversion_factor > 1
                    ? Math.floor(baseQuantity / unit.conversion_factor)
                    : baseQuantity
                return (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between bg-white p-2 rounded border"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {unit.unit_name || `Unit ${unit.id}`}
                        {unit.conversion_factor > 1 && (
                          <span className="text-xs text-gray-500 ml-2">
                            (1 = {unit.conversion_factor} pcs)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-600">
                        Price: MWK {Number(unit.retail_price || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{unitQuantity}</p>
                      <p className="text-xs text-gray-600">{unit.unit_name || `Unit ${unit.id}`}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Location breakdown */}
        {product.location_stocks && product.location_stocks.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Stock by Location</p>
            <div className="space-y-2">
              {product.location_stocks.map((loc) => (
                <div key={loc.id} className="flex items-center justify-between bg-white p-2 rounded border">
                  <div>
                    <p className="text-sm font-medium">{loc.outlet_name || "Unknown Location"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{loc.quantity || 0}</p>
                    <p className="text-xs text-gray-600">available</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Batch/Expiry info */}
        {product.batches && product.batches.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Batches</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {product.batches.map((batch) => {
                const expiryDate = new Date(batch.expiry_date)
                const today = new Date()
                const daysLeft = Math.ceil(
                  (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                )
                const isExpired = daysLeft < 0
                const isExpiringSoon = daysLeft < 30 && daysLeft >= 0

                return (
                  <div
                    key={batch.id}
                    className={`p-2 rounded border ${
                      isExpired
                        ? "bg-red-50 border-red-200"
                        : isExpiringSoon
                        ? "bg-orange-50 border-orange-200"
                        : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{batch.batch_number}</p>
                        <p className="text-xs text-gray-600">
                          Quantity: {batch.quantity}{" "}
                          {product.selling_units && product.selling_units.length > 0
                            ? product.selling_units[0]?.unit_name || "pcs"
                            : "pcs"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium">
                          {expiryDate.toLocaleDateString()}
                        </p>
                        {isExpired ? (
                          <Badge variant="destructive" className="text-xs mt-1">
                            Expired
                          </Badge>
                        ) : isExpiringSoon ? (
                          <Badge variant="secondary" className="text-xs mt-1 bg-orange-100">
                            {daysLeft} days left
                          </Badge>
                        ) : (
                          <p className="text-xs text-green-600 mt-1">{daysLeft} days left</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Action recommendations */}
        {status === "critical" && (
          <div className="bg-red-50 border border-red-200 p-3 rounded">
            <p className="text-sm font-medium text-red-900">🔴 Action Required</p>
            <p className="text-xs text-red-800 mt-1">
              Product is out of stock. Consider reordering from suppliers.
            </p>
          </div>
        )}

        {status === "low" && (
          <div className="bg-orange-50 border border-orange-200 p-3 rounded">
            <p className="text-sm font-medium text-orange-900">⚠️ Low Stock Alert</p>
            <p className="text-xs text-orange-800 mt-1">
              Stock is below threshold. Reorder soon to avoid stockout.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Multi-product stock display
 */
export function StockDisplayGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {products.map((product) => (
        <StockDisplay key={product.id} product={product} />
      ))}
    </div>
  )
}
