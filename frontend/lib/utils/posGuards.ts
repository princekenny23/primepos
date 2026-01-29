/**
 * Utility functions for POS guards and validations
 * Reusable across bar-pos, restaurant-pos, retail-pos
 */

export const posGuards = {
  guardCartNotEmpty: (cartLength: number, errorMsg = 'Cart is empty') => {
    if (cartLength === 0) {
      throw new Error(errorMsg)
    }
  },

  guardTableSelected: (table: any, errorMsg = 'No table selected') => {
    if (!table) {
      throw new Error(errorMsg)
    }
    return table
  },

  guardOutletSelected: (outlet: any, errorMsg = 'No outlet selected') => {
    if (!outlet) {
      throw new Error(errorMsg)
    }
    return outlet
  },

  guardShiftActive: (shift: any, errorMsg = 'No active shift') => {
    if (!shift) {
      throw new Error(errorMsg)
    }
    return shift
  },

  guardCustomerForOrder: (customer: any, allowWalkIn = true, errorMsg = 'No customer selected') => {
    if (!customer && !allowWalkIn) {
      throw new Error(errorMsg)
    }
    return customer
  },

  guardPaymentMethod: (method: string, validMethods = ['cash', 'card', 'mobile'], errorMsg = 'Invalid payment method') => {
    if (!validMethods.includes(method)) {
      throw new Error(errorMsg)
    }
    return method
  },
}
