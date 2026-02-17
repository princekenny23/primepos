import type { Business, BusinessSettings } from "@/lib/types"
import { buildOutletSettings, normalizeOutletBusinessType } from "@/lib/utils/outlet-business-type"

type OutletLike = {
  id?: string | number
  businessType?: string
  settings?: BusinessSettings | Record<string, any>
}

export const getEffectiveOutletSettings = (
  outlet?: OutletLike | null,
  business?: Business | null
): BusinessSettings => {
  const baseSettings = outlet?.settings || business?.settings
  const typeSource = outlet?.businessType || business?.type || baseSettings?.posMode
  return buildOutletSettings(baseSettings as BusinessSettings | undefined, typeSource)
}

export const getOutletPosMode = (
  outlet?: OutletLike | null,
  business?: Business | null
): BusinessSettings["posMode"] => {
  return getEffectiveOutletSettings(outlet, business).posMode
}

export const getOutletBusinessRouteSegment = (
  outlet?: OutletLike | null,
  business?: Business | null
): "retail" | "restaurant" | "bar" => {
  const type = normalizeOutletBusinessType(outlet?.businessType || business?.type || outlet?.settings?.posMode)
  if (type === "restaurant") {
    return "restaurant"
  }
  if (type === "bar") {
    return "bar"
  }
  return "retail"
}

export const getOutletPOSRoute = (
  outlet?: OutletLike | null,
  business?: Business | null
): string => {
  if (business?.posType === "single_product") {
    return "/pos/single-product"
  }
  const segment = getOutletBusinessRouteSegment(outlet, business)
  if (segment === "retail") {
    return "/pos/retail"
  }
  return `/pos/${segment}`
}

export const getOutletDashboardRoute = (
  outlet?: OutletLike | null,
  business?: Business | null
): string => {
  const segment = getOutletBusinessRouteSegment(outlet, business)
  if (segment === "restaurant") {
    return "/dashboard/restaurant/dashboard"
  }
  if (segment === "bar") {
    return "/dashboard/bar/dashboard"
  }
  return "/dashboard"
}
