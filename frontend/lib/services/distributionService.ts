import { api, apiEndpoints } from "@/lib/api"

function toQuery(params?: Record<string, string | number | boolean | undefined | null>) {
  if (!params) return ""
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value))
  })
  const encoded = query.toString()
  return encoded ? `?${encoded}` : ""
}

export const distributionService = {
  listVehicles(params?: Record<string, string | number | boolean>) {
    return api.get<any>(`${apiEndpoints.distribution.vehicles}${toQuery(params)}`)
  },

  listAvailableVehicles() {
    return api.get<any>(apiEndpoints.distribution.availableVehicles)
  },

  createVehicle(payload: { plate_number: string; make?: string; model?: string; capacity_kg?: number | null; fuel_type?: string; status?: string; is_active?: boolean }) {
    return api.post<any>(apiEndpoints.distribution.vehicles, payload)
  },

  listDrivers(params?: Record<string, string | number | boolean>) {
    return api.get<any>(`${apiEndpoints.distribution.drivers}${toQuery(params)}`)
  },

  listAvailableDrivers() {
    return api.get<any>(apiEndpoints.distribution.availableDrivers)
  },

  createDriver(payload: { name: string; phone?: string; license_number: string; id_number?: string; status?: string }) {
    return api.post<any>(apiEndpoints.distribution.drivers, payload)
  },

  listDeliveryOrders(params?: Record<string, string | number | boolean>) {
    return api.get<any>(`${apiEndpoints.distribution.deliveryOrders}${toQuery(params)}`)
  },

  listDeliveries(params?: Record<string, string | number | boolean>) {
    return api.get<any>(`${apiEndpoints.distribution.deliveryOrders}${toQuery(params)}`)
  },

  createDeliveryOrder(payload: { sales_order: number; warehouse: number; customer?: number | null; delivery_address?: string }) {
    return api.post<any>(apiEndpoints.distribution.deliveryOrders, payload)
  },

  createFromSale(payload: { sale_id: number; warehouse_id?: number | null; customer_id?: number | null; delivery_address?: string }) {
    return api.post<any>(apiEndpoints.distribution.createDeliveryFromSale, payload)
  },

  assignDeliveryOrder(id: string | number, payload: { vehicle_id: number; driver_id: number }) {
    return api.post<any>(apiEndpoints.distribution.assignDeliveryOrder(id), payload)
  },

  startTrip(id: string | number) {
    return api.post<any>(apiEndpoints.distribution.startTrip(id), {})
  },

  confirmDelivery(id: string | number, payload?: { fuel_cost?: number; distance_km?: number }) {
    return api.post<any>(apiEndpoints.distribution.confirmDelivery(id), payload || {})
  },

  cancelDelivery(id: string | number, payload?: { reason?: string }) {
    return api.post<any>(apiEndpoints.distribution.cancelDelivery(id), payload || {})
  },

  listTrips(params?: Record<string, string | number | boolean>) {
    return api.get<any>(`${apiEndpoints.distribution.trips}${toQuery(params)}`)
  },

  listActiveTrips(params?: Record<string, string | number | boolean>) {
    return api.get<any>(`${apiEndpoints.distribution.activeTrips}${toQuery(params)}`)
  },

  updateDelivery(id: string | number, payload: Record<string, any>) {
    if (payload.status === "in_transit") {
      return api.post<any>(apiEndpoints.distribution.startTrip(id), {})
    }
    if (payload.status === "delivered") {
      return api.post<any>(apiEndpoints.distribution.confirmDelivery(id), {})
    }
    if (payload.status === "cancelled") {
      return api.post<any>(apiEndpoints.distribution.cancelDelivery(id), {})
    }
    return api.patch<any>(`${apiEndpoints.distribution.deliveryOrders}${id}/`, payload)
  },
}
