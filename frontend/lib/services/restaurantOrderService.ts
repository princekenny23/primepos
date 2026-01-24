import { api } from '@/lib/api';

export interface CustomerDetail {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface TableDetail {
  id: string;
  number: string;
  capacity: number;
}

export interface SaleDetail {
  id: string;
  receipt_number: string;
  total: string;
}

export interface TillDetail {
  id: string;
  name: string;
}

export interface RestaurantOrder {
  id: string;
  order_number: string;
  order_type: 'dine_in' | 'takeout' | 'delivery';
  status: 'pending' | 'completed' | 'cancelled';
  customer_name: string;
  customer?: string;
  customer_detail?: CustomerDetail;
  table?: string;
  table_detail?: TableDetail;
  subtotal: number;
  tax: number;
  discount: number;
  discount_type?: 'percentage' | 'amount';
  discount_reason?: string;
  total: number;
  payment_method?: 'cash' | 'card' | 'mobile' | 'credit';
  sale?: string;
  sale_detail?: SaleDetail;
  till?: string;
  till_detail?: TillDetail;
  notes?: string;
  guests?: number;
  priority?: 'normal' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface CreateRestaurantOrderData {
  order_type: 'dine_in' | 'takeout' | 'delivery';
  customer_name: string;
  customer_id?: string;
  table_id?: string;
  subtotal: number;
  tax: number;
  discount?: number;
  discount_type?: 'percentage' | 'amount';
  discount_reason?: string;
  total: number;
  payment_method?: string;
  notes?: string;
  guests?: number;
  priority?: string;
}

/**
 * Restaurant Order Service
 * Manages persistent order sessions for dine-in, takeout, and delivery orders
 */
const restaurantOrderService = {
  /**
   * List all restaurant orders with optional filtering
   */
  async list(filters?: {
    outlet?: string;
    status?: string;
    table?: string;
    order_type?: string;
    customer?: string;
    search?: string;
    ordering?: string;
  }): Promise<RestaurantOrder[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const response = await api.get<{ results?: RestaurantOrder[], data?: RestaurantOrder[] }>(`/restaurant/orders/?${params}`);
    return (response as any).data.results || (response as any).data;
  },

  /**
   * Get a specific restaurant order by ID
   */
  async get(orderId: string): Promise<RestaurantOrder> {
    const response = await api.get<RestaurantOrder>(`/restaurant/orders/${orderId}/`);
    return (response as any).data;
  },

  /**
   * Create a new restaurant order
   */
  async create(data: CreateRestaurantOrderData): Promise<RestaurantOrder> {
    const response = await api.post<RestaurantOrder>(`/restaurant/orders/`, data);
    return (response as any).data;
  },

  /**
   * Update an existing restaurant order
   */
  async update(orderId: string, data: Partial<CreateRestaurantOrderData>): Promise<RestaurantOrder> {
    const response = await api.patch<RestaurantOrder>(`/restaurant/orders/${orderId}/`, data);
    return (response as any).data;
  },

  /**
   * Mark order as completed
   */
  async complete(orderId: string): Promise<RestaurantOrder> {
    const response = await api.post<RestaurantOrder>(`/restaurant/orders/${orderId}/complete/`);
    return (response as any).data;
  },

  /**
   * Cancel an order
   */
  async cancel(orderId: string): Promise<RestaurantOrder> {
    const response = await api.post<RestaurantOrder>(`/restaurant/orders/${orderId}/cancel/`);
    return (response as any).data;
  },

  /**
   * Add items to an existing order
   */
  async addItems(orderId: string, items: any[]): Promise<RestaurantOrder> {
    const response = await api.post<RestaurantOrder>(`/restaurant/orders/${orderId}/add_items/`, { items });
    return (response as any).data;
  },

  /**
   * Get all pending orders
   */
  async getPending(): Promise<RestaurantOrder[]> {
    const response = await api.get<{ results?: RestaurantOrder[], data?: RestaurantOrder[] }>(`/restaurant/orders/pending/`);
    return (response as any).data.results || (response as any).data;
  },

  /**
   * Get orders for a specific table
   */
  async getByTable(tableId: string): Promise<RestaurantOrder[]> {
    const response = await api.get<{ results?: RestaurantOrder[], data?: RestaurantOrder[] }>(`/restaurant/orders/by_table/?table_id=${tableId}`);
    return (response as any).data.results || (response as any).data;
  },
};

export default restaurantOrderService;
