import type { BusinessSettings, OutletBusinessType } from "@/lib/types"

const DEFAULT_OUTLET_TYPE: OutletBusinessType = "wholesale_and_retail"

export const normalizeOutletBusinessType = (value?: string | null): OutletBusinessType => {
  if (!value) {
    return DEFAULT_OUTLET_TYPE
  }

  const normalized = value.trim().toLowerCase()
  if (
    normalized === "retail" ||
    normalized === "standard" ||
    normalized === "wholesale and retail" ||
    normalized === "wholesale_and_retail"
  ) {
    return "wholesale_and_retail"
  }
  if (normalized === "restaurant") {
    return "restaurant"
  }
  if (normalized === "bar") {
    return "bar"
  }

  return DEFAULT_OUTLET_TYPE
}

export const getOutletBusinessTypeDisplay = (value?: string | null): string => {
  const type = normalizeOutletBusinessType(value)
  switch (type) {
    case "restaurant":
      return "Restaurant"
    case "bar":
      return "Bar"
    default:
      return "Wholesale and Retail"
  }
}

export const buildOutletSettings = (
  baseSettings: Partial<BusinessSettings> | undefined,
  businessType?: string | null
): BusinessSettings => {
  const normalizedType = normalizeOutletBusinessType(businessType)
  const posMode = normalizedType === "restaurant" ? "restaurant" : normalizedType === "bar" ? "bar" : "standard"

  return {
    posMode,
    receiptTemplate: baseSettings?.receiptTemplate ?? "standard",
    taxEnabled: baseSettings?.taxEnabled ?? false,
    taxRate: baseSettings?.taxRate ?? 0,
    printerSettings: baseSettings?.printerSettings,
    timezone: baseSettings?.timezone,
    taxId: baseSettings?.taxId,
    language: baseSettings?.language,
  }
}
