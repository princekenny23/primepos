"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import React, { useState, useEffect, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { productService, categoryService, unitService } from "@/lib/services/productService"
import { outletService } from "@/lib/services/outletService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import type { Category, Product, ProductUnit } from "@/lib/types"
import { Plus, Trash2, X } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"

interface ProductModalTabsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: any
  onProductSaved?: () => void
  initialBarcode?: string
  initialTab?: "basic" | "units" | "pricing" | "stock"
}

export const ProductModalTabs: React.FC<ProductModalTabsProps> = ({
  open,
  onOpenChange,
  product,
  onProductSaved,
  initialBarcode,
  initialTab = "basic",
}) => {
  const { toast } = useToast()
  const { currentBusiness } = useBusinessStore()
  const { outlets } = useTenant()
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [activeTab, setActiveTab] = useState<string>(initialTab)

  // Determine business type
  const businessType = currentBusiness?.type || ""
  const isWholesaleRetail = businessType === "wholesale and retail"
  const isBar = businessType === "bar"
  const isRestaurant = businessType === "restaurant"

  // BASIC TAB - Product information
  const [basicForm, setBasicForm] = useState({
    name: "",
    sku: "",
    categoryId: "",
    barcode: "",
    description: "",
    isActive: true,
    image: "",
  })

  // UNITS TAB - Multiple unit types (piece, dozen, carton, etc.)
  const [units, setUnits] = useState<ProductUnit[]>([])
  const [editingUnitIdx, setEditingUnitIdx] = useState<number | null>(null)
  const [unitForm, setUnitForm] = useState({
    name: "",
    conversion_factor: "1",
    retail_price: "",
    wholesale_price: "",
  })

  // PRICING TAB - Unified pricing for all variations/units
  const [pricingForm, setPricingForm] = useState({
    cost: "",
    retail_price: "",
    wholesale_price: "",
    wholesale_enabled: false,
    minimum_wholesale_quantity: "1",
    apply_to: "all", // "all" or "selected_variation"
  })

  // STOCK TAB - Initial stock quantities
  const [stockForm, setStockForm] = useState({
    track_inventory: true,
    low_stock_threshold: "0",
    outletId: "",
    opening_stock: "0",
  })

  // When reopening the modal, ensure the starting tab is the one requested by the parent
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab)
    }
  }, [open, initialTab])

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await categoryService.list()
        setCategories(cats)
      } catch (error) {
        console.error("Failed to load categories:", error)
      }
    }
    loadCategories()
  }, [])

  // Reset form when modal opens/closes or product changes
  useEffect(() => {
    if (!open) return

    if (product) {
      // Edit mode - populate from existing product
      setBasicForm({
        name: product.name || "",
        sku: product.sku || "",
        categoryId: product.categoryId || "",
        barcode: product.barcode || "",
        description: product.description || "",
        isActive: product.isActive !== undefined ? product.isActive : true,
        image: product.image || "",
      })

      setUnits(product.units || product.selling_units || [])

      setPricingForm({
        cost: product.cost || product.cost_price || "",
        retail_price: product.retail_price || product.price || "",
        wholesale_price: product.wholesale_price || "",
        wholesale_enabled: product.wholesale_enabled || false,
        minimum_wholesale_quantity: String(product.minimum_wholesale_quantity || 1),
        apply_to: "all",
      })

      setStockForm({
        track_inventory: true,
        low_stock_threshold: String(product.lowStockThreshold || 0),
        outletId: product.outlet?.id || product.outlet_id || "",
        opening_stock: String(product.stock || 0),
      })

      setActiveTab("basic")
    } else {
      // Create mode - reset all forms
      setBasicForm({
        name: initialBarcode ? "" : "",
        sku: "",
        categoryId: "",
        barcode: initialBarcode || "",
        description: "",
        isActive: true,
        image: "",
      })
      setUnits([])
      setPricingForm({
        cost: "",
        retail_price: "",
        wholesale_price: "",
        wholesale_enabled: false,
        minimum_wholesale_quantity: "1",
        apply_to: "all",
      })
      setStockForm({
        track_inventory: true,
        low_stock_threshold: "0",
        outletId: "",
        opening_stock: "0",
      })
      setActiveTab("basic")
    }

    setUnitForm({ name: "", conversion_factor: "1", retail_price: "", wholesale_price: "" })
    setEditingUnitIdx(null)
  }, [open, product, initialBarcode])

  // Handle add/edit unit
  const handleAddUnit = useCallback(() => {
    // Ensure we have fresh state
    const currentName = unitForm.name || ''
    const trimmedName = currentName.trim()

    if (!trimmedName) {
      toast({
        title: "Validation Error",
        description: "Unit name is required",
        variant: "destructive",
      })
      return
    }

    const conversionFactor = parseFloat(unitForm.conversion_factor) || 1
    if (conversionFactor < 1) {
      toast({
        title: "Validation Error",
        description: "Conversion factor must be at least 1",
        variant: "destructive",
      })
      return
    }

    if (editingUnitIdx !== null) {
      // Edit existing
      const updated = [...units]
      updated[editingUnitIdx] = {
        ...units[editingUnitIdx],
        unit_name: currentName,
        conversion_factor: conversionFactor,
        retail_price: parseFloat(unitForm.retail_price) || 0,
        wholesale_price: unitForm.wholesale_price ? parseFloat(unitForm.wholesale_price) : undefined,
      }
      setUnits(updated)
      setEditingUnitIdx(null)
    } else {
      // Add new
      setUnits([
        ...units,
        {
          unit_name: currentName,
          conversion_factor: conversionFactor,
          retail_price: parseFloat(unitForm.retail_price) || 0,
          wholesale_price: unitForm.wholesale_price ? parseFloat(unitForm.wholesale_price) : undefined,
          is_active: true,
        },
      ])
    }

    setUnitForm({ name: "", conversion_factor: "1", retail_price: "", wholesale_price: "" })
  }, [unitForm, units, editingUnitIdx, toast])

  const handleRemoveUnit = (idx: number) => {
    setUnits(units.filter((_, i) => i !== idx))
    if (editingUnitIdx === idx) setEditingUnitIdx(null)
  }

  // Main submit handler - Clean sequential save
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // === VALIDATION ===
      if (!basicForm.name.trim()) {
        throw new Error("Product name is required")
      }

      const retailPrice = parseFloat(pricingForm.retail_price) || 0
      if (retailPrice <= 0) {
        throw new Error("Retail price must be greater than 0")
      }

      if (isWholesaleRetail && pricingForm.wholesale_enabled) {
        const wholesalePrice = parseFloat(pricingForm.wholesale_price) || 0
        if (wholesalePrice <= 0) {
          throw new Error("Wholesale price must be greater than 0")
        }
      }

      // Get outlet
      let outletId = stockForm.outletId
      if (!outletId && outlets && outlets.length > 0) {
        outletId = String(outlets[0].id)
      }

      if (!outletId) {
        throw new Error("Outlet is required. Please ensure you have at least one outlet configured.")
      }

      // === STEP 1: CREATE OR UPDATE PRODUCT ===
      const productPayload: any = {
        name: basicForm.name,
        sku: basicForm.sku || undefined,
        barcode: basicForm.barcode || undefined,
        categoryId: basicForm.categoryId || undefined,
        description: basicForm.description || "",
        retail_price: retailPrice,
        cost: pricingForm.cost ? parseFloat(pricingForm.cost) : undefined,
        wholesale_price: pricingForm.wholesale_enabled ? parseFloat(pricingForm.wholesale_price) : undefined,
        wholesale_enabled: pricingForm.wholesale_enabled,
        minimum_wholesale_quantity: parseInt(pricingForm.minimum_wholesale_quantity) || 1,
        isActive: basicForm.isActive,
        low_stock_threshold: parseInt(stockForm.low_stock_threshold) || 0,
        outletId: outletId,
        stock: parseInt(stockForm.opening_stock) || 0,
        image: basicForm.image || undefined,
      }

      let productId: string
      if (product?.id) {
        // UPDATE existing
        await productService.update(product.id, productPayload)
        productId = product.id
      } else {
        // CREATE new
        const created = await productService.create(productPayload)
        productId = created.id
      }

      // === STEP 2: SAVE UNITS (IF ANY) ===
      const savedUnits: any[] = []
      if (units.length > 0) {
        for (const unit of units) {
          const isExisting = unit.id && unit.id !== ''

          const unitPayload = {
            unit_name: unit.unit_name || "",
            conversion_factor: parseFloat(String(unit.conversion_factor)) || 1,
            retail_price: parseFloat(String(unit.retail_price)) || 0,
            wholesale_price: unit.wholesale_price ? parseFloat(String(unit.wholesale_price)) : undefined,
            is_active: unit.is_active !== false,
          }

          let savedUnit
          if (isExisting) {
            // UPDATE existing unit
            savedUnit = await unitService.update(String(unit.id), unitPayload)
          } else {
            // CREATE new unit - capture the response with proper ID
            savedUnit = await unitService.create({ product: productId, ...unitPayload })
          }
          savedUnits.push(savedUnit)
        }
      }

      // Update local state with saved units (they now have proper IDs from backend)
      if (savedUnits.length > 0) {
        setUnits(savedUnits)
      }

      // === SUCCESS ===
      toast({
        title: "Success",
        description: product ? "Product updated successfully" : "Product created successfully",
      })

      onOpenChange(false)
      onProductSaved?.()
    } catch (error: any) {
      console.error("Save error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save product",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle>
          <DialogDescription>
            Create or update product information with units and pricing
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="units">Units</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="stock">Stock</TabsTrigger>
            </TabsList>

            {/* BASIC TAB */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={basicForm.name}
                  onChange={(e) => setBasicForm({ ...basicForm, name: e.target.value })}
                  placeholder="e.g., Coca Cola"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={basicForm.sku}
                    onChange={(e) => setBasicForm({ ...basicForm, sku: e.target.value })}
                    placeholder="e.g., COKE-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    value={basicForm.barcode}
                    onChange={(e) => setBasicForm({ ...basicForm, barcode: e.target.value })}
                    placeholder="e.g., 1234567890"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={basicForm.categoryId}
                  onValueChange={(val) => setBasicForm({ ...basicForm, categoryId: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={basicForm.description}
                  onChange={(e) => setBasicForm({ ...basicForm, description: e.target.value })}
                  placeholder="Product details"
                  className="w-full border rounded px-3 py-2 min-h-20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">Product Image (URL)</Label>
                <Input
                  id="image"
                  value={basicForm.image}
                  onChange={(e) => setBasicForm({ ...basicForm, image: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
                <p className="text-xs text-gray-500">Enter image URL or leave empty</p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={basicForm.isActive}
                  onChange={(e) => setBasicForm({ ...basicForm, isActive: e.target.checked })}
                  className="rounded"
                  aria-label="Product is active"
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </TabsContent>

            {/* UNITS TAB */}
            <TabsContent value="units" className="space-y-4 mt-4">
              <p className="text-sm text-gray-600">
                Add different units to sell (e.g., Piece, Dozen, Carton) - optional for single-unit products
              </p>

              {/* Unit list */}
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {units.length > 0 && (
                  <div className="space-y-2">
                    {units.map((u, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-gray-50 p-3 rounded"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{u.unit_name}</p>
                          <p className="text-xs text-gray-500">
                            {u.conversion_factor > 1
                              ? `1 ${u.unit_name} = ${u.conversion_factor} pieces`
                              : "Base unit"}
                          </p>
                          <p className="text-sm text-gray-600">MWK {Number(u.retail_price || 0).toFixed(2)}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUnitForm({
                                name: u.unit_name || "",
                                conversion_factor: String(u.conversion_factor),
                                retail_price: String(u.retail_price),
                                wholesale_price: u.wholesale_price
                                  ? String(u.wholesale_price)
                                  : "",
                              })
                              setEditingUnitIdx(idx)
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveUnit(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add/Edit unit form */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-medium">
                  {editingUnitIdx !== null ? "Edit Unit" : "Add Unit"}
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="unit-name" className="text-sm">
                      Name *
                    </Label>
                    <Input
                      key={`unit-name-${editingUnitIdx || 'new'}`}
                      id="unit-name"
                      value={unitForm.name || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        setUnitForm(prev => ({ ...prev, name: value }))
                      }}
                      placeholder="e.g., Piece, Dozen, Box"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="unit-conv" className="text-sm">
                      Conversion Factor *
                    </Label>
                    <Input
                      id="unit-conv"
                      type="number"
                      value={unitForm.conversion_factor}
                      onChange={(e) =>
                        setUnitForm({ ...unitForm, conversion_factor: e.target.value })
                      }
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="unit-price" className="text-sm">
                      Price *
                    </Label>
                    <Input
                      id="unit-price"
                      type="number"
                      step="0.01"
                      value={unitForm.retail_price}
                      onChange={(e) =>
                        setUnitForm({ ...unitForm, retail_price: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="unit-wprice" className="text-sm">
                      Wholesale Price
                    </Label>
                    <Input
                      id="unit-wprice"
                      type="number"
                      step="0.01"
                      value={unitForm.wholesale_price}
                      onChange={(e) =>
                        setUnitForm({ ...unitForm, wholesale_price: e.target.value })
                      }
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleAddUnit}
                  className="w-full"
                  variant="outline"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {editingUnitIdx !== null ? "Update Unit" : "Add Unit"}
                </Button>

                {editingUnitIdx !== null && (
                  <Button
                    type="button"
                    onClick={() => {
                      setEditingUnitIdx(null)
                      setUnitForm({
                        name: "",
                        conversion_factor: "1",
                        retail_price: "",
                        wholesale_price: "",
                      })
                    }}
                    variant="ghost"
                    className="w-full"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* PRICING TAB */}
            <TabsContent value="pricing" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="cost">Cost Price</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={pricingForm.cost}
                  onChange={(e) => setPricingForm({ ...pricingForm, cost: e.target.value })}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500">For margin calculations only</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="retail_price">Retail Price *</Label>
                <Input
                  id="retail_price"
                  type="number"
                  step="0.01"
                  value={pricingForm.retail_price}
                  onChange={(e) => setPricingForm({ ...pricingForm, retail_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              {isWholesaleRetail && (
                <>
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="wholesale_enabled"
                      checked={pricingForm.wholesale_enabled}
                      onChange={(e) =>
                        setPricingForm({ ...pricingForm, wholesale_enabled: e.target.checked })
                      }
                      className="rounded"
                      aria-label="Enable wholesale pricing"
                    />
                    <Label htmlFor="wholesale_enabled" className="cursor-pointer">
                      Enable wholesale pricing
                    </Label>
                  </div>

                  {pricingForm.wholesale_enabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="wholesale_price">Wholesale Price</Label>
                        <Input
                          id="wholesale_price"
                          type="number"
                          step="0.01"
                          value={pricingForm.wholesale_price}
                          onChange={(e) =>
                            setPricingForm({ ...pricingForm, wholesale_price: e.target.value })
                          }
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="min_qty">Minimum Wholesale Quantity</Label>
                        <Input
                          id="min_qty"
                          type="number"
                          value={pricingForm.minimum_wholesale_quantity}
                          onChange={(e) =>
                            setPricingForm({
                              ...pricingForm,
                              minimum_wholesale_quantity: e.target.value,
                            })
                          }
                          placeholder="1"
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              <p className="text-xs text-gray-500 pt-2">
                Note: Individual variations and units can have their own prices
              </p>
            </TabsContent>

            {/* STOCK TAB */}
            <TabsContent value="stock" className="space-y-4 mt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="track_inventory"
                  checked={stockForm.track_inventory}
                  onChange={(e) =>
                    setStockForm({ ...stockForm, track_inventory: e.target.checked })
                  }
                  className="rounded"
                  aria-label="Track inventory for this product"
                />
                <Label htmlFor="track_inventory" className="cursor-pointer">
                  Track inventory
                </Label>
              </div>

              {stockForm.track_inventory && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="low_stock">Low Stock Threshold</Label>
                    <Input
                      id="low_stock"
                      type="number"
                      value={stockForm.low_stock_threshold}
                      onChange={(e) =>
                        setStockForm({ ...stockForm, low_stock_threshold: e.target.value })
                      }
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500">Alert when stock falls below this</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="outlet">Outlet</Label>
                    <Select
                      value={stockForm.outletId}
                      onValueChange={(val) =>
                        setStockForm({ ...stockForm, outletId: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select outlet" />
                      </SelectTrigger>
                      <SelectContent>
                        {outlets?.map((outlet: any) => (
                          <SelectItem key={outlet.id} value={String(outlet.id)}>
                            {outlet.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="opening_stock">Opening Stock</Label>
                    <Input
                      id="opening_stock"
                      type="number"
                      value={stockForm.opening_stock}
                      onChange={(e) =>
                        setStockForm({ ...stockForm, opening_stock: e.target.value })
                      }
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500">Initial quantity in base unit</p>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              {activeTab !== "basic" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const tabs = ["basic", "variations", "units", "pricing", "stock"]
                    const currentIdx = tabs.indexOf(activeTab)
                    if (currentIdx > 0) {
                      setActiveTab(tabs[currentIdx - 1])
                    }
                  }}
                >
                  Back
                </Button>
              )}
              {activeTab !== "stock" && (
                <Button
                  type="button"
                  onClick={() => {
                    const tabs = ["basic", "variations", "units", "pricing", "stock"]
                    const currentIdx = tabs.indexOf(activeTab)
                    if (currentIdx < tabs.length - 1) {
                      setActiveTab(tabs[currentIdx + 1])
                    }
                  }}
                >
                  Next
                </Button>
              )}
              {activeTab === "stock" && (
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Product"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
