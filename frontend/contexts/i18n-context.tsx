"use client"

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react"
import {
  Locale,
  DEFAULT_LOCALE,
  TranslationNamespace,
  Translations,
  loadAllTranslations,
  getNestedValue,
  interpolate,
  getStoredLocale,
  setStoredLocale,
  clearLocaleCache,
} from "@/lib/i18n"
import { useTenant } from "./tenant-context"
import { tenantService } from "@/lib/services/tenantService"

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => Promise<void>
  t: (key: string, params?: Record<string, string | number>) => string
  isLoading: boolean
  isReady: boolean
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

// Global translations storage for fast access
let globalTranslations: Record<TranslationNamespace, Translations> = {} as Record<TranslationNamespace, Translations>

export function I18nProvider({ children }: { children: ReactNode }) {
  const { currentTenant } = useTenant()
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [translations, setTranslations] = useState<Record<TranslationNamespace, Translations>>(
    {} as Record<TranslationNamespace, Translations>
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)

  // Load translations for a specific locale
  const loadLocaleTranslations = useCallback(async (newLocale: Locale, forceReload = false) => {
    setIsLoading(true)
    try {
      // Force reload translations when switching languages
      const loaded = await loadAllTranslations(newLocale, forceReload)
      globalTranslations = loaded
      // Create a new object reference to ensure React detects the change
      setTranslations({ ...loaded })
      console.log(`Loaded ${newLocale} translations:`, Object.keys(loaded))
    } catch (error) {
      console.error("Failed to load translations:", error)
      // Fallback to English
      if (newLocale !== DEFAULT_LOCALE) {
        const fallback = await loadAllTranslations(DEFAULT_LOCALE, true)
        globalTranslations = fallback
        setTranslations({ ...fallback })
      }
    } finally {
      setIsLoading(false)
      setIsReady(true)
    }
  }, [])

  // Initialize locale on mount
  useEffect(() => {
    const initLocale = async () => {
      // Priority: 1. Tenant setting, 2. localStorage, 3. Default
      let initialLocale = DEFAULT_LOCALE
      
      // Check localStorage first for immediate UI
      const stored = getStoredLocale()
      if (stored) {
        initialLocale = stored
      }
      
      // Check tenant settings if available
      if (currentTenant?.id) {
        try {
          const tenant = await tenantService.get(currentTenant.id)
          const tenantLang = tenant.settings?.language as Locale
          if (tenantLang && (tenantLang === 'en' || tenantLang === 'ny')) {
            initialLocale = tenantLang
          }
        } catch (error) {
          // Silently fail, use stored/default
        }
      }
      
      setLocaleState(initialLocale)
      await loadLocaleTranslations(initialLocale)
    }
    
    initLocale()
  }, [currentTenant?.id, loadLocaleTranslations])

  // Change locale
  const setLocale = useCallback(async (newLocale: Locale) => {
    if (newLocale === locale) return
    
    console.log(`Switching language from ${locale} to ${newLocale}`)
    
    // Update state immediately for fast UI response
    setLocaleState(newLocale)
    
    // Store in localStorage
    setStoredLocale(newLocale)
    
    // Load new translations with force reload
    await loadLocaleTranslations(newLocale, true)
    
    // Save to tenant settings if logged in
    if (currentTenant?.id) {
      try {
        await tenantService.update(currentTenant.id, {
          settings: {
            language: newLocale,
          } as any,
        })
      } catch (error) {
        console.warn("Failed to save language preference to server:", error)
        // Language switch still works locally
      }
    }
    
    // Dispatch event for any components that need to know
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("locale-changed", {
        detail: { locale: newLocale }
      }))
    }
  }, [locale, currentTenant?.id, loadLocaleTranslations])

  // Translation function with fallback
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    // Parse key: "namespace.path.to.value" or "path.to.value" (defaults to common)
    const parts = key.split(".")
    let namespace: TranslationNamespace = "common"
    let path = key
    
    // Check if first part is a valid namespace
    const namespaces: TranslationNamespace[] = [
      "common", "pos", "products", "inventory", "sales",
      "customers", "reports", "settings", "shifts", "validation"
    ]
    
    if (parts.length > 1 && namespaces.includes(parts[0] as TranslationNamespace)) {
      namespace = parts[0] as TranslationNamespace
      path = parts.slice(1).join(".")
    }
    
    // Get translation from current locale
    const nsTranslations = globalTranslations[namespace] || translations[namespace]
    if (nsTranslations) {
      const value = getNestedValue(nsTranslations, path)
      if (value) {
        return interpolate(value, params)
      }
    }
    
    // Fallback: return key (development helper)
    if (process.env.NODE_ENV === "development" && isReady) {
      console.warn(`Missing translation: ${key}`)
    }
    
    // Return key with interpolation if applicable
    return interpolate(key, params)
  }, [translations, isReady])

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      isLoading,
      isReady,
    }),
    [locale, setLocale, t, isLoading, isReady]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/**
 * Hook to use translations
 * 
 * Usage:
 * const { t, locale, setLocale } = useI18n()
 * t('pos.cart.empty') // "Cart is empty" or "Dengu Lalibe Kanthu"
 * t('common.actions.save') // "Save" or "Sungani"
 */
export function useI18n() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return context
}

/**
 * Hook for namespace-specific translations (reduces key prefixing)
 * 
 * Usage:
 * const t = useTranslation('pos')
 * t('cart.empty') // Same as useI18n().t('pos.cart.empty')
 */
export function useTranslation(namespace: TranslationNamespace) {
  const { t: translate, locale, isLoading, isReady } = useI18n()
  
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translate(`${namespace}.${key}`, params)
    },
    [translate, namespace]
  )
  
  return { t, locale, isLoading, isReady }
}

