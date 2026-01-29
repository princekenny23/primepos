import { useBusinessStore } from '@/stores/businessStore'
import { useShift } from '@/contexts/shift-context'
import { useTenant } from '@/contexts/tenant-context'

/**
 * Shared POS session hook for outlet, shift, and business context
 * Used by bar-pos, restaurant-pos, retail-pos to validate prerequisites
 */
export function usePosSession() {
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet } = useTenant()
  const { activeShift } = useShift()

  const outlet = currentOutlet || tenantOutlet
  
  // Guard functions throw errors if prerequisites missing
  const guardHasOutlet = () => {
    if (!outlet) {
      throw new Error('No outlet selected. Please select an outlet.')
    }
    return outlet
  }

  const guardHasShift = () => {
    if (!activeShift) {
      throw new Error('No active shift. Please start a shift before processing.')
    }
    return activeShift
  }

  const guardHasBusiness = () => {
    if (!currentBusiness) {
      throw new Error('No business selected. Please select a business.')
    }
    return currentBusiness
  }

  const guardAllRequired = () => {
    const business = guardHasBusiness()
    const outletVal = guardHasOutlet()
    const shift = guardHasShift()
    return { business, outlet: outletVal, shift }
  }

  return {
    currentBusiness,
    outlet,
    activeShift,
    guardHasOutlet,
    guardHasShift,
    guardHasBusiness,
    guardAllRequired,
  }
}
