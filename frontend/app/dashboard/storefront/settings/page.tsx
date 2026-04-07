"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageCard } from "@/components/layouts/page-card"
import { PageHeader } from "@/components/layouts/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { FilterableTabs, TabsContent } from "@/components/ui/filterable-tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Copy, Check, Loader2, Wand2 } from "lucide-react"
import { storefrontService, type StorefrontAdmin, type CatalogRule } from "@/lib/services/storefrontService"
import { api } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useTenant } from "@/contexts/tenant-context"

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

const DEFAULT_THEME_SETTINGS: Record<string, string> = {
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

const THEME_PRESETS: Record<string, Record<string, string>> = {
  "Teal Market": {
    primary: "#0f766e",
    primary_foreground: "#ffffff",
    secondary: "#f1f5f9",
    accent: "#e2e8f0",
    background: "#ffffff",
    foreground: "#0f172a",
    card: "#ffffff",
    border: "#e2e8f0",
    ring: "#14b8a6",
  },
  "Sunset Retail": {
    primary: "#c2410c",
    primary_foreground: "#ffffff",
    secondary: "#fff7ed",
    accent: "#ffedd5",
    background: "#fffdf9",
    foreground: "#431407",
    card: "#ffffff",
    border: "#fed7aa",
    ring: "#f97316",
  },
  "Forest Fresh": {
    primary: "#166534",
    primary_foreground: "#ffffff",
    secondary: "#f0fdf4",
    accent: "#dcfce7",
    background: "#f7fee7",
    foreground: "#14532d",
    card: "#ffffff",
    border: "#bbf7d0",
    ring: "#22c55e",
  },
  "Ocean Professional": {
    primary: "#1d4ed8",
    primary_foreground: "#ffffff",
    secondary: "#eff6ff",
    accent: "#dbeafe",
    background: "#f8fafc",
    foreground: "#172554",
    card: "#ffffff",
    border: "#bfdbfe",
    ring: "#3b82f6",
  },
}

const THEME_SHOWCASES: Array<{ key: string; title: string; blurb: string }> = [
  { key: "Teal Market", title: "Modern Market", blurb: "Clean and trusted for everyday retail." },
  { key: "Sunset Retail", title: "Warm Commerce", blurb: "Friendly and vibrant conversion-focused look." },
  { key: "Ocean Professional", title: "Corporate Blue", blurb: "Professional style for formal brands." },
]

type StorefrontForm = {
  name: string
  slug: string
  default_outlet: string
  whatsapp_number: string
  currency_override: string
  is_active: boolean
  theme_settings: Record<string, string>
  seo_settings: {
    hero_title: string
    hero_subtitle: string
    about_title: string
    about_description: string
    contact_phone: string
    whatsapp_cta: string
    setup_theme: string
    logo_palette: string[]
    [key: string]: any
  }
}

const EMPTY_FORM: StorefrontForm = {
  name: "",
  slug: "",
  default_outlet: "",
  whatsapp_number: "",
  currency_override: "",
  is_active: true,
  theme_settings: DEFAULT_THEME_SETTINGS,
  seo_settings: {
    hero_title: "",
    hero_subtitle: "",
    about_title: "",
    about_description: "",
    contact_phone: "",
    whatsapp_cta: "",
    setup_theme: "Teal Market",
    logo_palette: [],
  },
}

export default function StorefrontSettingsPage() {
  const { toast } = useToast()
  const { outlets } = useTenant()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const initialTab = requestedTab === "rules" || requestedTab === "content" || requestedTab === "general"
    ? requestedTab
    : "general"

  const [storefronts, setStorefronts] = useState<StorefrontAdmin[]>([])
  const [selectedStorefrontId, setSelectedStorefrontId] = useState<string>("new")
  const [storefront, setStorefront] = useState<StorefrontAdmin | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const [form, setForm] = useState<StorefrontForm>(EMPTY_FORM)
  const [slugEdited, setSlugEdited] = useState(false)

  const [rules, setRules] = useState<CatalogRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [products, setProducts] = useState<Array<{ id: number; name: string; category_name: string }>>([])
  const [updatingProductId, setUpdatingProductId] = useState<number | null>(null)
  const [selectedThemePreset, setSelectedThemePreset] = useState<string>("custom")
  const [activeTab, setActiveTab] = useState(initialTab)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoFileName, setLogoFileName] = useState<string>("")
  const [detectedPalette, setDetectedPalette] = useState<string[]>([])
  const [detectingColors, setDetectingColors] = useState(false)

  const activeOutlets = useMemo(() => outlets.filter((outlet) => outlet.isActive), [outlets])

  const applyStorefrontToForm = useCallback((sf: StorefrontAdmin | null) => {
    if (!sf) {
      setStorefront(null)
      setForm(EMPTY_FORM)
      setSelectedThemePreset("Teal Market")
      setDetectedPalette([])
      setLogoFile(null)
      setLogoFileName("")
      setSlugEdited(false)
      setRules([])
      return
    }

    const seo = (sf.seo_settings || {}) as Record<string, any>
    const storedTheme = typeof seo.setup_theme === "string" ? seo.setup_theme : "Teal Market"
    const normalizedTheme = THEME_PRESETS[storedTheme] ? storedTheme : "custom"
    const logoPalette = Array.isArray(seo.logo_palette)
      ? seo.logo_palette.filter((hex) => typeof hex === "string")
      : []

    setStorefront(sf)
    setForm({
      name: sf.name,
      slug: sf.slug,
      default_outlet: String(sf.default_outlet),
      whatsapp_number: sf.whatsapp_number || "",
      currency_override: sf.currency_override || "",
      is_active: sf.is_active,
      theme_settings: {
        ...DEFAULT_THEME_SETTINGS,
        ...(sf.theme_settings || {}),
      },
      seo_settings: {
        ...seo,
        hero_title: (seo.hero_title as string) || "",
        hero_subtitle: (seo.hero_subtitle as string) || "",
        about_title: (seo.about_title as string) || "",
        about_description: (seo.about_description as string) || "",
        contact_phone: (seo.contact_phone as string) || "",
        whatsapp_cta: (seo.whatsapp_cta as string) || "",
        setup_theme: storedTheme,
        logo_palette: logoPalette,
      },
    })
    setSelectedThemePreset(normalizedTheme)
    setDetectedPalette(logoPalette)
    setLogoFile(null)
    setLogoFileName("")
    setSlugEdited(true)
  }, [])

  const loadStorefronts = useCallback(async () => {
    setLoading(true)
    try {
      const list = await storefrontService.listStorefronts()
      setStorefronts(list)

      const requestedId = Number(searchParams.get("site") || "")
      const requestedSite = requestedId > 0 ? list.find((item) => item.id === requestedId) : undefined
      const currentId = Number(selectedStorefrontId)
      const currentSite = currentId > 0 ? list.find((item) => item.id === currentId) : undefined
      const next = requestedSite || (selectedStorefrontId === "new" ? null : (currentSite || list[0] || null))

      if (next) {
        setSelectedStorefrontId(String(next.id))
        applyStorefrontToForm(next)
      } else {
        setSelectedStorefrontId("new")
        applyStorefrontToForm(null)
      }
    } catch (err: any) {
      toast({ title: "Failed to load storefronts", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [applyStorefrontToForm, searchParams, toast])

  const loadRules = useCallback(async (sfId: number) => {
    setRulesLoading(true)
    try {
      const data = await storefrontService.listRules(sfId)
      setRules(data)
    } catch (err: any) {
      toast({ title: "Failed to load rules", description: err.message, variant: "destructive" })
    } finally {
      setRulesLoading(false)
    }
  }, [toast])

  const loadProducts = useCallback(async (outletId?: string) => {
    if (!outletId) {
      setProducts([])
      return
    }

    try {
      const prodResp = await api.get<any>(`/products/?page_size=500&is_active=true&outlet=${encodeURIComponent(outletId)}`)
      const prods = Array.isArray(prodResp) ? prodResp : (prodResp.results || [])
      setProducts(
        prods.map((product: any) => ({
          id: product.id,
          name: product.name,
          category_name: product.category_name || product.category?.name || "Uncategorized",
        }))
      )
    } catch {
      // non-fatal for page startup
    }
  }, [])

  useEffect(() => {
    loadStorefronts()
  }, [loadStorefronts])

  useEffect(() => {
    loadProducts(form.default_outlet)
  }, [form.default_outlet, loadProducts])

  useEffect(() => {
    if (selectedStorefrontId === "new") {
      applyStorefrontToForm(null)
      return
    }
    const selected = storefronts.find((item) => String(item.id) === selectedStorefrontId) || null
    applyStorefrontToForm(selected)
  }, [applyStorefrontToForm, selectedStorefrontId, storefronts])

  useEffect(() => {
    if (!storefront) {
      setRules([])
      return
    }
    loadRules(storefront.id)
  }, [storefront, loadRules])

  const handleNameChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: slugEdited ? prev.slug : slugify(value),
    }))
  }

  const handleSave = async () => {
    if (!form.name || !form.slug || !form.default_outlet) {
      toast({ title: "Validation", description: "Name, slug, and outlet are required.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        default_outlet: parseInt(form.default_outlet, 10),
        whatsapp_number: form.whatsapp_number,
        currency_override: form.currency_override,
        is_active: form.is_active,
        theme_settings: form.theme_settings,
        seo_settings: form.seo_settings,
      }

      if (storefront) {
        const updated = await storefrontService.updateStorefront(storefront.id, payload)
        setStorefront(updated)
        setStorefronts((prev) => prev.map((sf) => (sf.id === updated.id ? updated : sf)))
        toast({ title: "Saved", description: "Changes were applied to the selected site." })
      } else {
        const created = await storefrontService.createStorefront(payload as any)
        setStorefront(created)
        setStorefronts((prev) => [...prev, created])
        setSelectedStorefrontId(String(created.id))
        setSlugEdited(true)
        toast({ title: "Created", description: "Storefront created successfully." })
      }
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const addProductToCatalog = async (productId: number) => {
    if (!storefront) return
    setUpdatingProductId(productId)
    try {
      const created = await storefrontService.addRule(storefront.id, {
        rule_type: "include",
        product: productId,
      })
      setRules((prev) => [...prev, created])
      toast({ title: "Product added to catalog" })
    } catch (err: any) {
      toast({ title: "Failed to add product", description: err.message, variant: "destructive" })
    } finally {
      setUpdatingProductId(null)
    }
  }

  const removeProductFromCatalog = async (ruleId: number, productId: number) => {
    if (!storefront) return
    setUpdatingProductId(productId)
    try {
      await storefrontService.deleteRule(storefront.id, ruleId)
      setRules((prev) => prev.filter((rule) => rule.id !== ruleId))
      toast({ title: "Product removed from catalog" })
    } catch (err: any) {
      toast({ title: "Failed to remove product", description: err.message, variant: "destructive" })
    } finally {
      setUpdatingProductId(null)
    }
  }

  const copySlugUrl = () => {
    if (!storefront) return
    const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    navigator.clipboard.writeText(`${base}/storefront/${storefront.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleThemeColorChange = (key: string, value: string) => {
    setSelectedThemePreset("custom")
    setForm((prev) => ({
      ...prev,
      theme_settings: {
        ...prev.theme_settings,
        [key]: value,
      },
      seo_settings: {
        ...prev.seo_settings,
        setup_theme: "custom",
      },
    }))
  }

  const handleApplyThemePreset = (presetName: string) => {
    if (presetName === "custom") return
    const preset = THEME_PRESETS[presetName]
    if (!preset) return
    setSelectedThemePreset(presetName)
    setForm((prev) => ({
      ...prev,
      theme_settings: {
        ...preset,
      },
      seo_settings: {
        ...prev.seo_settings,
        setup_theme: presetName,
      },
    }))
  }

  const hexFromRgb = (r: number, g: number, b: number) =>
    `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`

  const getReadableTextColor = (hex: string) => {
    const value = hex.replace("#", "")
    if (value.length !== 6) return "#0f172a"
    const r = parseInt(value.slice(0, 2), 16)
    const g = parseInt(value.slice(2, 4), 16)
    const b = parseInt(value.slice(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.58 ? "#0f172a" : "#ffffff"
  }

  const detectPaletteFromLogo = async (file?: File) => {
    const sourceFile = file || logoFile
    if (!sourceFile) {
      toast({ title: "Upload logo first", description: "Select a logo image to detect brand colors." })
      return
    }

    setDetectingColors(true)
    try {
      const bitmap = await createImageBitmap(sourceFile)
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      if (!context) throw new Error("Could not read image")

      const maxSize = 96
      const ratio = Math.max(bitmap.width, bitmap.height) / maxSize || 1
      canvas.width = Math.max(24, Math.floor(bitmap.width / ratio))
      canvas.height = Math.max(24, Math.floor(bitmap.height / ratio))

      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)

      const buckets = new Map<string, number>()
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3]
        if (alpha < 140) continue

        const r = Math.round(data[i] / 32) * 32
        const g = Math.round(data[i + 1] / 32) * 32
        const b = Math.round(data[i + 2] / 32) * 32
        const brightness = (r + g + b) / 3
        if (brightness < 18 || brightness > 245) continue

        const hex = hexFromRgb(Math.min(255, r), Math.min(255, g), Math.min(255, b))
        buckets.set(hex, (buckets.get(hex) || 0) + 1)
      }

      const topColors = [...buckets.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([hex]) => hex)

      if (topColors.length === 0) {
        throw new Error("No strong colors detected")
      }

      setDetectedPalette(topColors)
      setSelectedThemePreset("custom")
      setForm((prev) => ({
        ...prev,
        theme_settings: {
          ...prev.theme_settings,
          primary: topColors[0] || prev.theme_settings.primary,
          primary_foreground: getReadableTextColor(topColors[0] || prev.theme_settings.primary),
          ring: topColors[1] || topColors[0] || prev.theme_settings.ring,
          accent: topColors[2] || prev.theme_settings.accent,
          border: topColors[3] || prev.theme_settings.border,
        },
        seo_settings: {
          ...prev.seo_settings,
          setup_theme: "custom",
          logo_palette: topColors,
        },
      }))

      toast({ title: "Palette detected", description: "Applied logo colors to your storefront theme." })
    } catch (err: any) {
      toast({
        title: "Color detection failed",
        description: err?.message || "Try a clearer logo with stronger colors.",
        variant: "destructive",
      })
    } finally {
      setDetectingColors(false)
    }
  }

  const productRuleMap = new Map(
    rules
      .filter((rule) => rule.rule_type === "include" && rule.product != null)
      .map((rule) => [rule.product as number, rule])
  )

  const generalForm = (
    <div className="w-full space-y-5">
      <p className="text-xs text-muted-foreground">
        {storefront
          ? `Editing site: ${storefront.name} (${storefront.slug})`
          : "Creating a new storefront site."}
      </p>

      <div className="space-y-2">
        <Label htmlFor="sf-name">Storefront Name *</Label>
        <Input id="sf-name" value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="My Online Store" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sf-slug">URL Slug *</Label>
        <Input
          id="sf-slug"
          value={form.slug}
          onChange={(e) => {
            setSlugEdited(true)
            setForm((prev) => ({ ...prev, slug: e.target.value }))
          }}
          placeholder="my-online-store"
          pattern="[a-z0-9-]+"
        />
        <p className="text-xs text-muted-foreground">Lowercase letters, numbers and hyphens only.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sf-outlet">Default Outlet *</Label>
        <Select value={form.default_outlet} onValueChange={(v) => setForm((prev) => ({ ...prev, default_outlet: v }))}>
          <SelectTrigger id="sf-outlet">
            <SelectValue placeholder="Select outlet" />
          </SelectTrigger>
          <SelectContent>
            {activeOutlets.map((outlet) => (
              <SelectItem key={outlet.id} value={String(outlet.id)}>{outlet.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sf-whatsapp">WhatsApp Number</Label>
        <Input
          id="sf-whatsapp"
          value={form.whatsapp_number}
          onChange={(e) => setForm((prev) => ({ ...prev, whatsapp_number: e.target.value }))}
          placeholder="+265991234567"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sf-currency">Currency Override</Label>
        <Input
          id="sf-currency"
          value={form.currency_override}
          onChange={(e) => setForm((prev) => ({ ...prev, currency_override: e.target.value.toUpperCase().slice(0, 3) }))}
          maxLength={3}
          placeholder="MWK"
          className="w-24"
        />
        <p className="text-xs text-muted-foreground">Leave blank to use tenant default.</p>
      </div>

      {storefront && (
        <div className="flex items-center gap-3">
          <Switch id="sf-active" checked={form.is_active} onCheckedChange={(v) => setForm((prev) => ({ ...prev, is_active: v }))} />
          <Label htmlFor="sf-active">Storefront Active</Label>
        </div>
      )}

      {storefront && (
        <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm font-mono">
          <span className="truncate text-xs text-muted-foreground">
            {(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")}/storefront/{storefront.slug}
          </span>
          <Button type="button" variant="ghost" size="icon" onClick={copySlugUrl} className="h-7 w-7 shrink-0">
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      <div className="space-y-4 rounded-md border p-4">
        <div>
          <p className="text-sm font-medium">Quick Setup</p>
          <p className="text-xs text-muted-foreground">Configure brand colors and theme style like guided website setup.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="logo-upload">Detect from Logo</Label>
            <Input
              id="logo-upload"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                setLogoFile(file)
                setLogoFileName(file?.name || "")
              }}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => detectPaletteFromLogo()}
                disabled={!logoFile || detectingColors}
              >
                {detectingColors ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Detect Colors
              </Button>
              {logoFileName ? (
                <span className="text-xs text-muted-foreground">{logoFileName}</span>
              ) : (
                <span className="text-xs text-muted-foreground">No logo selected</span>
              )}
            </div>
            {detectedPalette.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Detected palette confirmation</p>
                <div className="flex flex-wrap gap-2">
                  {detectedPalette.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className="h-8 min-w-16 rounded-md border px-2 text-[11px] font-medium"
                      style={{ backgroundColor: hex, color: getReadableTextColor(hex) }}
                      onClick={() => handleThemeColorChange("primary", hex)}
                    >
                      {hex}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Choose Theme</Label>
            <div className="grid gap-2">
              {THEME_SHOWCASES.map((theme) => {
                const palette = THEME_PRESETS[theme.key]
                const selected = selectedThemePreset === theme.key
                return (
                  <button
                    key={theme.key}
                    type="button"
                    onClick={() => handleApplyThemePreset(theme.key)}
                    className={`rounded-md border p-3 text-left transition ${selected ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{theme.title}</p>
                      {selected ? <Badge>Active</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{theme.blurb}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      {[palette.primary, palette.secondary, palette.accent, palette.ring].map((hex) => (
                        <span
                          key={`${theme.key}-${hex}`}
                          className="h-5 w-5 rounded-full border"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  )

  const catalogTab = (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Manage which products are visible in this storefront catalog.</p>

      {!storefront ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Products are optional when creating a site. Save the site first, then add Shop products here.
        </div>
      ) : rulesLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading catalog...</div>
      ) : products.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No products found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Product</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const activeRule = productRuleMap.get(product.id)
                const isInCatalog = Boolean(activeRule)

                return (
                  <tr key={product.id} className="border-b hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">{product.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{product.category_name}</td>
                    <td className="px-3 py-2">
                      <Badge variant={isInCatalog ? "default" : "outline"} className="text-xs">
                        {isInCatalog ? "In Catalog" : "Not In Catalog"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isInCatalog ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => removeProductFromCatalog(activeRule!.id, product.id)}
                          disabled={updatingProductId === product.id}
                        >
                          {updatingProductId === product.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8"
                          onClick={() => addProductToCatalog(product.id)}
                          disabled={updatingProductId === product.id}
                        >
                          {updatingProductId === product.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                          Add
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const contentTab = (
    <div className="space-y-6">
      <div className="rounded-md border p-4">
        <p className="mb-3 text-sm font-medium">Home Page Content</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="seo-hero-title">Home Headline</Label>
            <Input
              id="seo-hero-title"
              value={form.seo_settings.hero_title}
              onChange={(e) => setForm((prev) => ({ ...prev, seo_settings: { ...prev.seo_settings, hero_title: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seo-whatsapp-cta">Home Button Text</Label>
            <Input
              id="seo-whatsapp-cta"
              value={form.seo_settings.whatsapp_cta}
              onChange={(e) => setForm((prev) => ({ ...prev, seo_settings: { ...prev.seo_settings, whatsapp_cta: e.target.value } }))}
            />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <Label htmlFor="seo-hero-subtitle">Home Subtitle</Label>
            <Textarea
              id="seo-hero-subtitle"
              value={form.seo_settings.hero_subtitle}
              onChange={(e) => setForm((prev) => ({ ...prev, seo_settings: { ...prev.seo_settings, hero_subtitle: e.target.value } }))}
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seo-contact-phone">Contact Phone</Label>
            <Input
              id="seo-contact-phone"
              value={form.seo_settings.contact_phone}
              onChange={(e) => setForm((prev) => ({ ...prev, seo_settings: { ...prev.seo_settings, contact_phone: e.target.value } }))}
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border p-4">
        <p className="mb-3 text-sm font-medium">About Page Content</p>
        <div className="grid gap-4">
          <div className="space-y-1">
            <Label htmlFor="seo-about-title">About Title</Label>
            <Input
              id="seo-about-title"
              value={form.seo_settings.about_title}
              onChange={(e) => setForm((prev) => ({ ...prev, seo_settings: { ...prev.seo_settings, about_title: e.target.value } }))}
              placeholder="Who we are"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seo-about-description">About Description</Label>
            <Textarea
              id="seo-about-description"
              value={form.seo_settings.about_description}
              onChange={(e) => setForm((prev) => ({ ...prev, seo_settings: { ...prev.seo_settings, about_description: e.target.value } }))}
              rows={5}
              placeholder="Tell customers about your business, mission, and what makes your shop different."
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border p-4">
        <p className="mb-2 text-sm font-medium">Page Links</p>
        <p className="mb-3 text-xs text-muted-foreground">Open your public pages directly after save.</p>
        {storefront ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <a
              href={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/storefront/${storefront.slug}/about`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
            >
              About
            </a>
            <a
              href={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/storefront/${storefront.slug}/shop`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
            >
              Shop
            </a>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Create and save the site first to generate page links.</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Shop content is managed from the Catalog tab.</p>
    </div>
  )

  const saveButtonLabel = storefront ? "Save Changes" : "Create Storefront"

  if (loading) {
    return (
      <DashboardLayout>
        <PageCard className="mt-6">
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin opacity-40" />
          </div>
        </PageCard>
      </DashboardLayout>
    )
  }

  const settingsActionButtons = (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setActiveTab("general")
          setSelectedStorefrontId("new")
        }}
        disabled={saving}
      >
        Create New Site
      </Button>
      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {saveButtonLabel}
      </Button>
    </div>
  )

  return (
    <DashboardLayout>
      <PageCard className="mt-6">
        <PageHeader title="Storefront Settings" />

        <FilterableTabs
          tabs={[
            { value: "general", label: "General" },
            { value: "rules", label: "Catalog" },
            { value: "content", label: "Content" },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="w-full"
          tabsListClassName="grid w-full h-9 items-center gap-1 rounded-md bg-gray-100 p-1"
          actionButton={settingsActionButtons}
          actionButtonPlacement="below"
        >
          <TabsContent value="general" className="m-0">{generalForm}</TabsContent>
          <TabsContent value="rules" className="m-0">{catalogTab}</TabsContent>
          <TabsContent value="content" className="m-0">{contentTab}</TabsContent>
        </FilterableTabs>
      </PageCard>
    </DashboardLayout>
  )
}
