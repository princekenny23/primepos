"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageCard } from "@/components/layouts/page-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Copy,
  Check,
  Loader2,
  Wand2,
  Eye,
  Globe,
  Palette,
  FileText,
  ShoppingBag,
  Settings2,
  Truck,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
  Laptop,
  Tablet,
  Smartphone,
} from "lucide-react"
import { storefrontService, type StorefrontAdmin, type CatalogRule } from "@/lib/services/storefrontService"
import { api } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useTenant } from "@/contexts/tenant-context"
import { ProductModalTabs } from "@/components/modals/product-modal-tabs"

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

const STOREFRONT_TEMPLATES: Array<{
  key: string
  title: string
  blurb: string
  accentStart: string
  accentEnd: string
}> = [
  {
    key: "nextcommerce_v1",
    title: "Premium Layout",
    blurb: "Rich storefront layout with larger hero framing, stronger cards, and conversion-focused sections.",
    accentStart: "#3C50E0",
    accentEnd: "#0EA5E9",
  },
  {
    key: "minimal_v1",
    title: "Minimal Retail",
    blurb: "Cleaner lightweight storefront style focused on fast browsing and simple conversion paths.",
    accentStart: "#0f766e",
    accentEnd: "#22c55e",
  },
]

type StorefrontForm = {
  name: string
  slug: string
  default_outlet: string
  whatsapp_number: string
  currency_override: string
  is_active: boolean
  theme_settings: Record<string, string>
  checkout_settings: Record<string, any>
  seo_settings: {
    hero_title: string
    hero_subtitle: string
    home_hero_style: string
    shop_hero_style: string
    about_title: string
    about_description: string
    about_hero_style: string
    contact_phone: string
    contact_email: string
    contact_address: string
    contact_person: string
    contact_hero_style: string
    footer_about: string
    whatsapp_cta: string
    setup_theme: string
    logo_palette: string[]
    template_key: string
    template_version: string
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
  checkout_settings: {
    delivery_fee_enabled: true,
    delivery_fee: 0,
    delivery_fee_label: "Delivery",
  },
  seo_settings: {
    hero_title: "",
    hero_subtitle: "",
    home_hero_style: "gradient",
    shop_hero_style: "gradient",
    about_title: "",
    about_description: "",
    about_hero_style: "gradient",
    contact_phone: "",
    contact_email: "",
    contact_address: "",
    contact_person: "",
    contact_hero_style: "gradient",
    footer_about: "",
    whatsapp_cta: "",
    setup_theme: "Teal Market",
    logo_palette: [],
    template_key: "nextcommerce_v1",
    template_version: "1",
  },
}

function StorefrontSettingsPageContent() {
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
  const [productsPage, setProductsPage] = useState(1)
  const [productsPageSize] = useState(10)
  const [productsCount, setProductsCount] = useState(0)
  const [updatingProductId, setUpdatingProductId] = useState<number | null>(null)
  const [selectedThemePreset, setSelectedThemePreset] = useState<string>("custom")
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [activeSection, setActiveSection] = useState<"overview" | "design" | "pages" | "products" | "checkout" | "seo" | "settings">(
    initialTab === "rules" ? "products" : initialTab === "content" ? "pages" : "overview"
  )
  const [selectedPageEditor, setSelectedPageEditor] = useState<"home" | "shop" | "about" | "contact">("home")
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop")
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
    const templateKey = typeof seo.template_key === "string" ? seo.template_key : "nextcommerce_v1"
    const templateVersion = typeof seo.template_version === "string" ? seo.template_version : "1"
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
      checkout_settings: {
        delivery_fee_enabled: (sf.checkout_settings?.delivery_fee_enabled ?? true) !== false,
        delivery_fee: sf.checkout_settings?.delivery_fee ?? 0,
        delivery_fee_label: sf.checkout_settings?.delivery_fee_label || "Delivery",
      },
      seo_settings: {
        ...seo,
        hero_title: (seo.hero_title as string) || "",
        hero_subtitle: (seo.hero_subtitle as string) || "",
        home_hero_style: (seo.home_hero_style as string) || "gradient",
        shop_hero_style: (seo.shop_hero_style as string) || "gradient",
        about_title: (seo.about_title as string) || "",
        about_description: (seo.about_description as string) || "",
        about_hero_style: (seo.about_hero_style as string) || "gradient",
        contact_phone: (seo.contact_phone as string) || "",
        contact_email: (seo.contact_email as string) || "",
        contact_address: (seo.contact_address as string) || "",
        contact_person: (seo.contact_person as string) || "",
        contact_hero_style: (seo.contact_hero_style as string) || "gradient",
        footer_about: (seo.footer_about as string) || "",
        whatsapp_cta: (seo.whatsapp_cta as string) || "",
        setup_theme: storedTheme,
        logo_palette: logoPalette,
        template_key: templateKey,
        template_version: templateVersion,
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

  const loadProducts = useCallback(async (outletId?: string, page = 1) => {
    if (!outletId) {
      setProducts([])
      setProductsCount(0)
      return
    }

    try {
      const prodResp = await api.get<any>(
        `/products/?page=${page}&page_size=${productsPageSize}&outlet=${encodeURIComponent(outletId)}`
      )
      const prods = Array.isArray(prodResp) ? prodResp : (prodResp.results || [])
      const count = Array.isArray(prodResp) ? prods.length : Number(prodResp.count || prods.length)
      setProducts(
        prods.map((product: any) => ({
          id: product.id,
          name: product.name,
          category_name: product.category_name || product.category?.name || "Uncategorized",
        }))
      )
      setProductsCount(count)
      setProductsPage(page)
    } catch {
      setProducts([])
      setProductsCount(0)
    }
  }, [productsPageSize])

  useEffect(() => {
    loadStorefronts()
  }, [loadStorefronts])

  useEffect(() => {
    setProductsPage(1)
    void loadProducts(form.default_outlet, 1)
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

  const handleSave = async (overrides?: Partial<StorefrontForm>) => {
    const mergedForm: StorefrontForm = {
      ...form,
      ...overrides,
      theme_settings: {
        ...form.theme_settings,
        ...(overrides?.theme_settings || {}),
      },
      checkout_settings: {
        ...form.checkout_settings,
        ...(overrides?.checkout_settings || {}),
      },
      seo_settings: {
        ...form.seo_settings,
        ...((overrides?.seo_settings as Record<string, any>) || {}),
      },
    }

    if (!mergedForm.name || !mergedForm.slug || !mergedForm.default_outlet) {
      toast({ title: "Validation", description: "Name, slug, and outlet are required.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: mergedForm.name,
        slug: mergedForm.slug,
        default_outlet: parseInt(mergedForm.default_outlet, 10),
        whatsapp_number: mergedForm.whatsapp_number,
        currency_override: mergedForm.currency_override,
        is_active: mergedForm.is_active,
        theme_settings: mergedForm.theme_settings,
        checkout_settings: mergedForm.checkout_settings,
        seo_settings: mergedForm.seo_settings,
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

  const openEditProduct = async (product: { id: number; name: string; category_name?: string }) => {
    try {
      const outletId = form.default_outlet || undefined
      const endpoints = [
        `/products/${product.id}/`,
        outletId ? `/products/${product.id}/?outlet=${encodeURIComponent(outletId)}` : undefined,
      ].filter(Boolean) as string[]

      let fullProduct: any = null
      for (const endpoint of endpoints) {
        try {
          fullProduct = await api.get<any>(endpoint)
          break
        } catch (err: any) {
          if (err?.status !== 404) {
            throw err
          }
        }
      }

      if (!fullProduct) {
        throw new Error("Product could not be loaded for the selected outlet.")
      }

      setEditingProduct({
        ...fullProduct,
        categoryName: fullProduct.category_name || fullProduct.category?.name || product.category_name || "",
      })
      setProductModalOpen(true)
    } catch (err: any) {
      toast({ title: "Failed to load product", description: err.message, variant: "destructive" })
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

  const themeColorFields = [
    { key: "primary", label: "Primary" },
    { key: "ring", label: "Focus Ring" },
    { key: "accent", label: "Accent" },
    { key: "border", label: "Border" },
  ] as const
  const updateSeoSetting = (key: string, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      seo_settings: {
        ...prev.seo_settings,
        [key]: value,
      },
    }))
  }

  const pageVisibility = {
    home: form.seo_settings.home_page_active !== false,
    shop: form.seo_settings.shop_page_active !== false,
    about: form.seo_settings.about_page_active !== false,
    contact: form.seo_settings.contact_page_active !== false,
  }

  const previewUrl = storefront
    ? `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/storefront/${storefront.slug}`
    : form.slug
      ? `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/storefront/${form.slug}`
      : "Not available yet"

  const setupChecklist = [
    { key: "Store information", done: Boolean(form.name && form.slug && form.default_outlet) },
    { key: "Branding", done: Boolean(form.theme_settings.primary) },
    { key: "Template", done: Boolean(form.seo_settings.template_key) },
    { key: "Homepage", done: Boolean(form.seo_settings.hero_title && form.seo_settings.hero_subtitle) },
    { key: "Products", done: productRuleMap.size > 0 },
    { key: "Contact information", done: Boolean(form.seo_settings.contact_phone || form.seo_settings.contact_email) },
    { key: "SEO", done: Boolean(form.seo_settings.seo_title || form.seo_settings.seo_description) },
  ]

  const completedCount = setupChecklist.filter((item) => item.done).length
  const setupPercent = Math.round((completedCount / setupChecklist.length) * 100)

  const sectionItems: Array<{ key: "overview" | "design" | "pages" | "products" | "checkout" | "seo" | "settings"; label: string; icon: any }> = [
    { key: "overview", label: "Overview", icon: Globe },
    { key: "design", label: "Design", icon: Palette },
    { key: "pages", label: "Pages", icon: FileText },
    { key: "products", label: "Products", icon: ShoppingBag },
    { key: "checkout", label: "Checkout", icon: Truck },
    { key: "seo", label: "SEO", icon: Search },
    { key: "settings", label: "Settings", icon: Settings2 },
  ]

  const currentTemplate = STOREFRONT_TEMPLATES.find((item) => item.key === form.seo_settings.template_key)
  const setupSteps = [
    { number: 1, label: "Business Information", section: "settings" as const },
    { number: 2, label: "Choose Template", section: "design" as const },
    { number: 3, label: "Branding", section: "design" as const },
    { number: 4, label: "Homepage", section: "pages" as const },
    { number: 5, label: "Products", section: "products" as const },
    { number: 6, label: "Checkout", section: "checkout" as const },
    { number: 7, label: "SEO", section: "seo" as const },
    { number: 8, label: "Publish", section: "overview" as const },
  ]

  const saveButtonLabel = storefront ? "Save Draft" : "Create Storefront"

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

  return (
    <DashboardLayout>
      <div className="mx-auto mt-6 w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <ProductModalTabs
          open={productModalOpen}
          onOpenChange={(open) => {
            setProductModalOpen(open)
            if (!open) setEditingProduct(null)
          }}
          product={editingProduct}
          onProductSaved={() => {
            void loadProducts(form.default_outlet, productsPage)
          }}
          initialTab="basic"
        />

        <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Store Builder</h1>
              <p className="mt-1 text-sm text-muted-foreground">Create and manage your online storefront with guided setup, live preview, and publishing controls.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void handleSave()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {saveButtonLabel}
              </Button>
              <Button type="button" variant="outline" onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")} disabled={!form.slug}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button type="button" onClick={() => void handleSave({ is_active: true })} disabled={saving}>
                Publish Store
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="rounded-xl border bg-white p-3 shadow-sm">
            <nav className="space-y-1">
              {sectionItems.map((section) => {
                const Icon = section.icon
                const active = activeSection === section.key
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => setActiveSection(section.key)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {section.label}
                  </button>
                )
              })}
            </nav>
          </aside>

          <main className="space-y-6">
            {activeSection === "overview" ? (
              <>
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Storefront</p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-900">{form.name || "Untitled Storefront"}</h2>
                      <div className="mt-3 flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${form.is_active ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <p className="text-sm font-medium text-slate-700">{form.is_active ? "Published" : "Draft"}</p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{form.is_active ? "Your online store is ready to receive customers." : "Complete setup and publish when ready."}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")} disabled={!form.slug}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Preview Store
                        </Button>
                        <Button type="button" variant="outline" onClick={copySlugUrl} disabled={!form.slug}>
                          {copied ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <Copy className="mr-2 h-4 w-4" />}
                          {copied ? "Copied" : "Copy Store URL"}
                        </Button>
                        {form.is_active ? (
                          <Button type="button" variant="outline" onClick={() => void handleSave({ is_active: false })} disabled={saving}>
                            Unpublish
                          </Button>
                        ) : (
                          <Button type="button" onClick={() => void handleSave({ is_active: true })} disabled={saving}>
                            Publish
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="w-full max-w-md rounded-lg border bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">Setup progress</p>
                      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-slate-900" style={{ width: `${setupPercent}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{setupPercent}% completed</p>
                      <div className="mt-4 space-y-2">
                        {setupChecklist.map((item) => (
                          <div key={item.key} className="flex items-center gap-2 text-sm">
                            {item.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                            <span className={item.done ? "text-slate-700" : "text-slate-500"}>{item.key}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {!storefront ? (
                  <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">Guided setup</p>
                    <p className="mt-1 text-xs text-muted-foreground">Follow each step to launch your storefront quickly.</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {setupSteps.map((step) => (
                        <button
                          key={step.number}
                          type="button"
                          onClick={() => setActiveSection(step.section)}
                          className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                        >
                          <span>{step.number}. {step.label}</span>
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Live Store Preview</p>
                    <div className="flex items-center gap-2">
                      {[{ key: "desktop", icon: Laptop }, { key: "tablet", icon: Tablet }, { key: "mobile", icon: Smartphone }].map((device) => {
                        const Icon = device.icon
                        const active = previewDevice === device.key
                        return (
                          <button
                            key={device.key}
                            type="button"
                            onClick={() => setPreviewDevice(device.key as "desktop" | "tablet" | "mobile")}
                            className={`rounded-md border px-2 py-1.5 text-xs ${active ? "border-slate-900 bg-slate-900 text-white" : "text-slate-600"}`}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className={`mx-auto overflow-hidden rounded-xl border bg-white ${previewDevice === "desktop" ? "max-w-full" : previewDevice === "tablet" ? "max-w-[760px]" : "max-w-[380px]"}`}>
                    <div className="border-b bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold">{form.name || "Your storefront"}</p>
                    </div>
                    <div className="space-y-4 p-4">
                      <div className="rounded-lg p-4" style={{ background: `linear-gradient(120deg, ${form.theme_settings.primary} 0%, #3C50E0 100%)` }}>
                        <p className="text-xs uppercase tracking-[0.16em] text-white/80">Hero</p>
                        <p className="mt-2 text-lg font-semibold text-white">{form.seo_settings.hero_title || "Your homepage headline"}</p>
                        <p className="mt-1 text-sm text-white/85">{form.seo_settings.hero_subtitle || "Your value proposition appears here."}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {products.slice(0, 3).map((product) => (
                          <div key={product.id} className="rounded-lg border p-3">
                            <div className="h-16 rounded-md bg-slate-100" />
                            <p className="mt-2 text-xs font-semibold text-slate-700 line-clamp-1">{product.name}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{product.category_name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {activeSection === "design" ? (
              <>
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Templates</p>
                      <p className="text-xs text-muted-foreground">Template controls page structure. Theme controls visual style.</p>
                    </div>
                    <Badge variant="outline">Selected: {currentTemplate?.title || "None"}</Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {STOREFRONT_TEMPLATES.map((template) => {
                      const selected = form.seo_settings.template_key === template.key
                      return (
                        <div key={template.key} className={`rounded-xl border p-4 ${selected ? "border-slate-900" : ""}`}>
                          <div className="rounded-lg border bg-white p-3">
                            <div className="rounded-md border bg-slate-50 p-2">
                              <div className="mb-2 h-2 w-1/2 rounded bg-slate-300" />
                              <div className="h-14 rounded bg-slate-200" />
                              <div className="mt-2 grid grid-cols-3 gap-2">
                                <div className="h-10 rounded bg-slate-100" />
                                <div className="h-10 rounded bg-slate-100" />
                                <div className="h-10 rounded bg-slate-100" />
                              </div>
                            </div>
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-900">{template.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{template.blurb}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Recommended: Retail, Fashion, General commerce</p>
                          <div className="mt-3 flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setActiveSection("overview")}>Preview</Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  seo_settings: {
                                    ...prev.seo_settings,
                                    template_key: template.key,
                                    template_version: "1",
                                  },
                                }))
                              }}
                            >
                              {selected ? "Using Template" : "Use Template"}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Branding</p>
                  <p className="mt-1 text-xs text-muted-foreground">Upload your logo and generate a starter palette from brand colors.</p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="logo-upload">Logo</Label>
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
                        <Button type="button" variant="outline" onClick={() => detectPaletteFromLogo()} disabled={!logoFile || detectingColors}>
                          {detectingColors ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                          Use Recommended Colors
                        </Button>
                        <span className="text-xs text-muted-foreground">{logoFileName || "No logo selected"}</span>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-700">Detected colors</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {detectedPalette.length > 0 ? detectedPalette.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            className="h-8 min-w-16 rounded-md border px-2 text-[10px] font-semibold"
                            style={{ backgroundColor: hex, color: getReadableTextColor(hex) }}
                            onClick={() => handleThemeColorChange("primary", hex)}
                          >
                            {hex}
                          </button>
                        )) : <span className="text-xs text-muted-foreground">No palette detected yet.</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Colors & Theme</p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {themeColorFields.map((field) => (
                        <div key={field.key} className="rounded-lg border p-3">
                          <Label className="mb-2 block text-xs font-medium">{field.label}</Label>
                          <div className="flex items-center gap-2">
                            <Input type="color" value={form.theme_settings[field.key] || "#000000"} onChange={(e) => handleThemeColorChange(field.key, e.target.value)} className="h-10 w-12 p-1" />
                            <Input value={form.theme_settings[field.key] || ""} onChange={(e) => handleThemeColorChange(field.key, e.target.value)} className="h-10" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      {THEME_SHOWCASES.map((theme) => {
                        const palette = THEME_PRESETS[theme.key]
                        const selected = selectedThemePreset === theme.key
                        return (
                          <button key={theme.key} type="button" onClick={() => handleApplyThemePreset(theme.key)} className={`w-full rounded-lg border p-4 text-left transition ${selected ? "border-slate-900" : "hover:bg-slate-50"}`}>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-slate-900">{theme.title}</p>
                              {selected ? <Badge>Active</Badge> : <Badge variant="outline">Preset</Badge>}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{theme.blurb}</p>
                            <div className="mt-2 flex gap-2">
                              {[palette.primary, palette.secondary, palette.accent, palette.ring].map((hex) => (
                                <span key={`${theme.key}-${hex}`} className="h-5 w-5 rounded-full border" style={{ backgroundColor: hex }} />
                              ))}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {activeSection === "pages" ? (
              <>
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Pages Manager</p>
                  <p className="mt-1 text-xs text-muted-foreground">Open each page editor and publish only the pages you need.</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      { key: "home", label: "Home", desc: "Homepage content", published: pageVisibility.home },
                      { key: "shop", label: "Shop", desc: "Catalog and shopping experience", published: pageVisibility.shop },
                      { key: "about", label: "About", desc: "Brand story and business information", published: pageVisibility.about },
                      { key: "contact", label: "Contact", desc: "Phone, email, address and WhatsApp", published: pageVisibility.contact },
                    ].map((page) => (
                      <button key={page.key} type="button" onClick={() => setSelectedPageEditor(page.key as "home" | "shop" | "about" | "contact")} className="rounded-lg border p-4 text-left transition hover:bg-slate-50">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900">{page.label}</p>
                          <Badge variant={page.published ? "default" : "outline"}>{page.published ? "Published" : "Hidden"}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{page.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{selectedPageEditor.charAt(0).toUpperCase() + selectedPageEditor.slice(1)} Editor</p>
                    <Switch
                      checked={form.seo_settings[`${selectedPageEditor}_page_active`] !== false}
                      onCheckedChange={(checked) => updateSeoSetting(`${selectedPageEditor}_page_active`, checked)}
                    />
                  </div>

                  {selectedPageEditor === "home" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2"><Label>Headline</Label><Input value={form.seo_settings.hero_title || ""} onChange={(e) => updateSeoSetting("hero_title", e.target.value)} /></div>
                      <div className="space-y-2"><Label>CTA Text</Label><Input value={form.seo_settings.whatsapp_cta || ""} onChange={(e) => updateSeoSetting("whatsapp_cta", e.target.value)} /></div>
                      <div className="space-y-2 md:col-span-2"><Label>Subtitle</Label><Textarea rows={3} value={form.seo_settings.hero_subtitle || ""} onChange={(e) => updateSeoSetting("hero_subtitle", e.target.value)} /></div>
                      <div className="space-y-2"><Label>Hero Style</Label><Select value={form.seo_settings.home_hero_style || "gradient"} onValueChange={(value) => updateSeoSetting("home_hero_style", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gradient">Gradient</SelectItem><SelectItem value="solid">Solid Brand Color</SelectItem><SelectItem value="glass">Glass Light</SelectItem></SelectContent></Select></div>
                    </div>
                  ) : null}

                  {selectedPageEditor === "shop" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2"><Label>Shop Header Title</Label><Input value={form.seo_settings.shop_header_title || ""} onChange={(e) => updateSeoSetting("shop_header_title", e.target.value)} /></div>
                      <div className="space-y-2"><Label>Hero Style</Label><Select value={form.seo_settings.shop_hero_style || "gradient"} onValueChange={(value) => updateSeoSetting("shop_hero_style", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gradient">Gradient</SelectItem><SelectItem value="solid">Solid Brand Color</SelectItem><SelectItem value="glass">Glass Light</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2 md:col-span-2"><Label>Shop Header Subtitle</Label><Textarea rows={3} value={form.seo_settings.shop_header_subtitle || ""} onChange={(e) => updateSeoSetting("shop_header_subtitle", e.target.value)} /></div>
                    </div>
                  ) : null}

                  {selectedPageEditor === "about" ? (
                    <div className="grid gap-4">
                      <div className="space-y-2"><Label>About Title</Label><Input value={form.seo_settings.about_title || ""} onChange={(e) => updateSeoSetting("about_title", e.target.value)} /></div>
                      <div className="space-y-2"><Label>Hero Style</Label><Select value={form.seo_settings.about_hero_style || "gradient"} onValueChange={(value) => updateSeoSetting("about_hero_style", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gradient">Gradient</SelectItem><SelectItem value="solid">Solid Brand Color</SelectItem><SelectItem value="glass">Glass Light</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2"><Label>About Description</Label><Textarea rows={5} value={form.seo_settings.about_description || ""} onChange={(e) => updateSeoSetting("about_description", e.target.value)} /></div>
                    </div>
                  ) : null}

                  {selectedPageEditor === "contact" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2"><Label>Contact Title</Label><Input value={form.seo_settings.contact_title || ""} onChange={(e) => updateSeoSetting("contact_title", e.target.value)} /></div>
                      <div className="space-y-2"><Label>Contact CTA</Label><Input value={form.seo_settings.contact_cta || ""} onChange={(e) => updateSeoSetting("contact_cta", e.target.value)} /></div>
                      <div className="space-y-2 md:col-span-2"><Label>Hero Style</Label><Select value={form.seo_settings.contact_hero_style || "gradient"} onValueChange={(value) => updateSeoSetting("contact_hero_style", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gradient">Gradient</SelectItem><SelectItem value="solid">Solid Brand Color</SelectItem><SelectItem value="glass">Glass Light</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2 md:col-span-2"><Label>Contact Description</Label><Textarea rows={4} value={form.seo_settings.contact_description || ""} onChange={(e) => updateSeoSetting("contact_description", e.target.value)} /></div>
                      <div className="space-y-2"><Label>Phone</Label><Input value={form.seo_settings.contact_phone || ""} onChange={(e) => updateSeoSetting("contact_phone", e.target.value)} /></div>
                      <div className="space-y-2"><Label>Email</Label><Input value={form.seo_settings.contact_email || ""} onChange={(e) => updateSeoSetting("contact_email", e.target.value)} /></div>
                      <div className="space-y-2 md:col-span-2"><Label>Address</Label><Textarea rows={3} value={form.seo_settings.contact_address || ""} onChange={(e) => updateSeoSetting("contact_address", e.target.value)} /></div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {activeSection === "products" ? (
              <div className="space-y-6">
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Catalog</p>
                      <p className="text-xs text-muted-foreground">Manage product visibility rules without breaking existing catalog logic.</p>
                    </div>
                    <Badge variant="outline">Published products: {productRuleMap.size}</Badge>
                  </div>

                  {!storefront ? (
                    <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                      Save the storefront first, then add products to your public catalog.
                    </div>
                  ) : rulesLoading ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Loading catalog...</div>
                  ) : products.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">No products found for the selected outlet.</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/40">
                            <tr className="text-muted-foreground">
                              <th className="px-4 py-3 text-left font-medium">Product</th>
                              <th className="px-4 py-3 text-left font-medium">Category</th>
                              <th className="px-4 py-3 text-left font-medium">Status</th>
                              <th className="px-4 py-3 text-right font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {products.map((product) => {
                              const activeRule = productRuleMap.get(product.id)
                              const isInCatalog = Boolean(activeRule)

                              return (
                                <tr key={product.id} className="border-t transition hover:bg-muted/30">
                                  <td className="px-4 py-3 font-medium text-slate-900">{product.name}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{product.category_name}</td>
                                  <td className="px-4 py-3"><Badge variant={isInCatalog ? "default" : "outline"} className="text-xs">{isInCatalog ? "In Catalog" : "Not In Catalog"}</Badge></td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button variant="outline" size="sm" className="h-8" onClick={() => void openEditProduct(product)}>Edit</Button>
                                      {isInCatalog ? (
                                        <Button variant="outline" size="sm" className="h-8" onClick={() => void removeProductFromCatalog(activeRule!.id, product.id)} disabled={updatingProductId === product.id}>
                                          {updatingProductId === product.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                                          Remove
                                        </Button>
                                      ) : (
                                        <Button size="sm" className="h-8 shadow-sm" onClick={() => void addProductToCatalog(product.id)} disabled={updatingProductId === product.id}>
                                          {updatingProductId === product.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                                          Add
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {productsCount > productsPageSize ? (
                        <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                          <span>
                            Showing {(productsPage - 1) * productsPageSize + 1}-{Math.min(productsPage * productsPageSize, productsCount)} of {productsCount}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const nextPage = Math.max(1, productsPage - 1)
                                void loadProducts(form.default_outlet, nextPage)
                              }}
                              disabled={productsPage === 1}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const nextPage = productsPage + 1
                                void loadProducts(form.default_outlet, nextPage)
                              }}
                              disabled={productsPage * productsPageSize >= productsCount}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {activeSection === "checkout" ? (
              <div className="space-y-6">
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Order Method</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {["whatsapp", "online", "both"].map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, checkout_settings: { ...prev.checkout_settings, order_method: method } }))}
                        className={`rounded-lg border px-3 py-2 text-sm ${form.checkout_settings?.order_method === method ? "border-slate-900 bg-slate-900 text-white" : "hover:bg-slate-50"}`}
                      >
                        {method === "whatsapp" ? "WhatsApp" : method === "online" ? "Online checkout" : "Both"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">WhatsApp</p>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>Number</Label><Input value={form.whatsapp_number} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp_number: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Pre-filled message</Label><Input value={form.checkout_settings?.whatsapp_prefill || "Hi, I want to place an order."} onChange={(e) => setForm((prev) => ({ ...prev, checkout_settings: { ...prev.checkout_settings, whatsapp_prefill: e.target.value } }))} /></div>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Delivery & Pickup</p>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Delivery Fee</Label>
                      <Input type="number" min="0" step="0.01" value={form.checkout_settings?.delivery_fee ?? 0} onChange={(e) => setForm((prev) => ({ ...prev, checkout_settings: { ...prev.checkout_settings, delivery_fee: Number(e.target.value || 0) } }))} />
                    </div>
                    <div className="space-y-2"><Label>Delivery Label</Label><Input value={form.checkout_settings?.delivery_fee_label || "Delivery"} onChange={(e) => setForm((prev) => ({ ...prev, checkout_settings: { ...prev.checkout_settings, delivery_fee_label: e.target.value } }))} /></div>
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3"><Switch checked={form.checkout_settings?.delivery_fee_enabled !== false} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, checkout_settings: { ...prev.checkout_settings, delivery_fee_enabled: checked } }))} /><Label>Enable delivery</Label></div>
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3"><Switch checked={form.checkout_settings?.pickup_enabled !== false} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, checkout_settings: { ...prev.checkout_settings, pickup_enabled: checked } }))} /><Label>Enable pickup</Label></div>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Customer Details</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {[
                      { key: "collect_name", label: "Name" },
                      { key: "collect_phone", label: "Phone" },
                      { key: "collect_address", label: "Address" },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3">
                        <Switch checked={form.checkout_settings?.[item.key] !== false} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, checkout_settings: { ...prev.checkout_settings, [item.key]: checked } }))} />
                        <Label>{item.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeSection === "seo" ? (
              <div className="space-y-6">
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">SEO</p>
                  <div className="mt-4 grid gap-4">
                    <div className="space-y-2"><Label>Search engine title</Label><Input value={form.seo_settings.seo_title || ""} onChange={(e) => updateSeoSetting("seo_title", e.target.value)} placeholder="Kim's Collection" /></div>
                    <div className="space-y-2"><Label>Meta description</Label><Textarea rows={3} value={form.seo_settings.seo_description || ""} onChange={(e) => updateSeoSetting("seo_description", e.target.value)} placeholder="Your store description..." /></div>
                    <div className="space-y-2"><Label>Social sharing image</Label><Input value={form.seo_settings.social_image || ""} onChange={(e) => updateSeoSetting("social_image", e.target.value)} placeholder="https://..." /></div>
                    <div className="space-y-2"><Label>Store description</Label><Textarea rows={3} value={form.seo_settings.store_description || ""} onChange={(e) => updateSeoSetting("store_description", e.target.value)} /></div>
                  </div>
                </div>
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Google Search Preview</p>
                  <div className="mt-3 rounded-lg border bg-slate-50 p-4">
                    <p className="text-base text-blue-700">{form.seo_settings.seo_title || form.name || "Your Storefront"}</p>
                    <p className="text-xs text-emerald-700">{previewUrl}</p>
                    <p className="mt-1 text-sm text-slate-600">{form.seo_settings.seo_description || "Your store description appears here."}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {activeSection === "settings" ? (
              <div className="space-y-6">
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Business Information</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>Storefront Name *</Label><Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} /></div>
                    <div className="space-y-2"><Label>URL Slug *</Label><Input value={form.slug} onChange={(e) => { setSlugEdited(true); setForm((prev) => ({ ...prev, slug: e.target.value })) }} /></div>
                    <div className="space-y-2"><Label>Default Outlet *</Label><Select value={form.default_outlet} onValueChange={(v) => setForm((prev) => ({ ...prev, default_outlet: v }))}><SelectTrigger><SelectValue placeholder="Select outlet" /></SelectTrigger><SelectContent>{activeOutlets.map((outlet) => <SelectItem key={outlet.id} value={String(outlet.id)}>{outlet.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Currency</Label><Input value={form.currency_override} onChange={(e) => setForm((prev) => ({ ...prev, currency_override: e.target.value.toUpperCase().slice(0, 3) }))} maxLength={3} /></div>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Publishing</p>
                  <p className="mt-1 text-xs text-muted-foreground">Separate draft saving from publish state.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void handleSave({ is_active: false })} disabled={saving}>Save Draft</Button>
                    <Button variant="outline" onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")} disabled={!form.slug}>Preview</Button>
                    <Button onClick={() => void handleSave({ is_active: true })} disabled={saving}>Publish Store</Button>
                    {form.is_active ? <Badge className="ml-2">Published</Badge> : <Badge variant="outline" className="ml-2">Draft</Badge>}
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Footer</p>
                  <div className="mt-4 space-y-2">
                    <Label>Footer About Text</Label>
                    <Textarea rows={3} value={form.seo_settings.footer_about || ""} onChange={(e) => updateSeoSetting("footer_about", e.target.value)} />
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>Facebook URL</Label><Input value={form.seo_settings.facebook_url || ""} onChange={(e) => updateSeoSetting("facebook_url", e.target.value)} placeholder="https://facebook.com/yourstore" /></div>
                    <div className="space-y-2"><Label>Instagram URL</Label><Input value={form.seo_settings.instagram_url || ""} onChange={(e) => updateSeoSetting("instagram_url", e.target.value)} placeholder="https://instagram.com/yourstore" /></div>
                    <div className="space-y-2"><Label>X URL</Label><Input value={form.seo_settings.x_url || ""} onChange={(e) => updateSeoSetting("x_url", e.target.value)} placeholder="https://x.com/yourstore" /></div>
                    <div className="space-y-2"><Label>LinkedIn URL</Label><Input value={form.seo_settings.linkedin_url || ""} onChange={(e) => updateSeoSetting("linkedin_url", e.target.value)} placeholder="https://linkedin.com/company/yourstore" /></div>
                    <div className="space-y-2 md:col-span-2"><Label>YouTube URL</Label><Input value={form.seo_settings.youtube_url || ""} onChange={(e) => updateSeoSetting("youtube_url", e.target.value)} placeholder="https://youtube.com/@yourstore" /></div>
                  </div>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function StorefrontSettingsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <PageCard className="mt-6">
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin opacity-40" />
            </div>
          </PageCard>
        </DashboardLayout>
      }
    >
      <StorefrontSettingsPageContent />
    </Suspense>
  )
}
