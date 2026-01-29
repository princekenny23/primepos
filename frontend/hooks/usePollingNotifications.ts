"use client"

/**
 * Polling Implementation for Notifications
 * 
 * PROS:
 * - Simplest to implement
 * - Works everywhere (no special server setup needed)
 * - No connection management complexity
 * - Easy to debug
 * 
 * CONS:
 * - Less efficient (constant requests)
 * - Higher latency (up to poll interval)
 * - More server load
 * - Battery drain on mobile
 * 
 * Best for: Low-frequency notifications or as a fallback
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { useAuthStore } from "@/stores/authStore"
import { notificationService, type Notification } from "@/lib/services/notificationService"

interface UsePollingNotificationsOptions {
  interval?: number // Poll interval in milliseconds (default: 60000 = 60 seconds)
  enabled?: boolean // Whether polling is enabled (default: false to prevent dashboard instability)
}

export function usePollingNotifications(options: UsePollingNotificationsOptions = {}) {
  const { user } = useAuthStore()
  // FIXED: Changed from 5 seconds to 60 seconds, disabled by default to prevent dashboard flickering
  const { interval = 60000, enabled = false } = options
  const [unreadCount, setUnreadCount] = useState(0)
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastNotificationIdRef = useRef<string | number | null>(null)

  const poll = useCallback(async () => {
    if (!user?.id || !enabled) {
      return
    }

    setIsPolling(true)
    try {
      // Get unread count
      const countResponse = await notificationService.getUnreadCount()
      setUnreadCount(countResponse.unread_count)

      // Get latest unread notification
      const notificationsResponse = await notificationService.list({
        read: false,
        page_size: 1,
      })

      if (notificationsResponse.results.length > 0) {
        const latest = notificationsResponse.results[0]
        // Only update if it's a new notification
        if (latest.id !== lastNotificationIdRef.current) {
          setLatestNotification(latest)
          lastNotificationIdRef.current = latest.id
        }
      }
    } catch (error) {
      console.error("Error polling notifications:", error)
    } finally {
      setIsPolling(false)
    }
  }, [user?.id, enabled])

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Poll immediately
    poll()

    // Then poll at interval
    intervalRef.current = setInterval(poll, interval)
  }, [poll, interval])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPolling(false)
  }, [])

  useEffect(() => {
    if (user?.id && enabled) {
      startPolling()
    } else {
      stopPolling()
    }

    return () => {
      stopPolling()
    }
  }, [user?.id, enabled, startPolling, stopPolling])

  // Fetch initial unread count
  useEffect(() => {
    if (user?.id) {
      notificationService.getUnreadCount().then((response) => {
        setUnreadCount(response.unread_count)
      })
    }
  }, [user?.id])

  return {
    isConnected: isPolling || enabled, // Always "connected" when polling
    unreadCount,
    latestNotification,
    reconnect: startPolling,
    disconnect: stopPolling,
    isPolling,
  }
}

