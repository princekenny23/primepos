"use client"

/**
 * Hook for listening to real-time sale updates via WebSocket
 * Extends the WebSocket notifications connection to also receive sale updates
 */
import { useEffect, useRef, useState, useCallback } from "react"
import { useAuthStore } from "@/stores/authStore"
import type { Sale } from "@/lib/types"

interface SaleUpdateMessage {
  type: "sale_update"
  sale: any
  action: "created" | "updated" | "refunded"
}

interface WebSocketMessage {
  type: "sale_update" | "notification" | "notification_count" | "pong"
  sale?: any
  action?: "created" | "updated" | "refunded"
  notification?: any
  unread_count?: number
  timestamp?: string
}

export function useRealtimeSales() {
  const { user } = useAuthStore()
  const [isConnected, setIsConnected] = useState(false)
  const [latestSale, setLatestSale] = useState<Sale | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const onSaleUpdateRef = useRef<((sale: Sale, action: string) => void) | null>(null)

  const connect = useCallback(() => {
    if (!user?.id) {
      return
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close()
    }

    // Get WebSocket URL from environment or default
    if (typeof window === "undefined") {
      return // Don't connect during SSR
    }

    const wsHost = process.env.NEXT_PUBLIC_WS_URL || window.location.host
    const userId = typeof user.id === 'number' ? user.id : parseInt(user.id)
    
    // Check if wsHost already includes protocol
    let wsUrl: string
    if (wsHost.startsWith("ws://") || wsHost.startsWith("wss://")) {
      // Already includes protocol
      wsUrl = `${wsHost}/ws/notifications/${userId}/`
    } else {
      // Determine protocol based on current page protocol
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      wsUrl = `${wsProtocol}//${wsHost}/ws/notifications/${userId}/`
    }

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("WebSocket connected for real-time sales")
        setIsConnected(true)

        // Clear any pending reconnection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }

        // Start ping interval (send ping every 30 seconds)
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }))
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data)

          if (data.type === "sale_update" && data.sale) {
            const paymentMethod = data.sale.payment_method || "cash"
            const normalizedPaymentMethod = String(paymentMethod).toLowerCase()
            const derivedStatus = data.sale.status || (
              normalizedPaymentMethod === "tab" || normalizedPaymentMethod === "credit"
                ? "pending"
                : "completed"
            )

            // Transform backend sale to frontend format
            const sale: Sale = {
              id: String(data.sale.id),
              businessId: String(data.sale.tenant || ""),
              outletId: String(data.sale.outlet_detail?.id || data.sale.outlet || ""),
              userId: data.sale.user_detail 
                ? String(data.sale.user_detail.id) 
                : (data.sale.user ? String(data.sale.user) : ""),
              items: (data.sale.items || []).map((item: any) => ({
                productId: item.product ? String(item.product.id || item.product_id) : "",
                productName: item.product_name || item.product?.name || "",
                quantity: item.quantity || 0,
                price: parseFloat(item.price) || 0,
                total: parseFloat(item.total) || 0,
              })),
              subtotal: parseFloat(data.sale.subtotal) || 0,
              tax: parseFloat(data.sale.tax) || 0,
              total: parseFloat(data.sale.total) || 0,
              paymentMethod,
              status: derivedStatus,
              createdAt: data.sale.created_at || new Date().toISOString(),
              _raw: data.sale,
            } as any

            setLatestSale(sale)
            
            // Call callback if provided
            if (onSaleUpdateRef.current) {
              onSaleUpdateRef.current(sale, data.action || "created")
            }
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error)
        }
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        setIsConnected(false)
      }

      ws.onclose = () => {
        console.log("WebSocket disconnected")
        setIsConnected(false)

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        // Attempt to reconnect after 3 seconds (unless component is unmounting)
        if (user?.id) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, 3000)
        }
      }
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error)
      setIsConnected(false)
    }
  }, [user?.id])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
    setIsConnected(false)
  }, [])

  // Connect on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      connect()
    } else {
      disconnect()
    }

    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [user?.id, connect, disconnect])

  // Set callback for sale updates
  const onSaleUpdate = useCallback((callback: (sale: Sale, action: string) => void) => {
    onSaleUpdateRef.current = callback
  }, [])

  return {
    isConnected,
    latestSale,
    onSaleUpdate,
    reconnect: connect,
    disconnect,
  }
}

