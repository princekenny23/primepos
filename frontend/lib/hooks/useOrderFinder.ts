import { useState, useEffect, useCallback, useMemo } from 'react'

interface Order {
  id: string
  _raw?: {
    receipt_number?: string
    table_detail?: { id: string; number: string }
    customer_detail?: { id: string; name: string }
  }
  total?: number
  items?: any[]
}

/**
 * Shared hook for order finder: search, filter, sort, and keyboard navigation
 * Used by bar-pos and restaurant-pos for resuming orders
 */
export function useOrderFinder(orders: Order[]) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'amount' | 'table'>('recent')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  // Filter orders by search term
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const searchLower = searchTerm.toLowerCase()
      const receiptNum = order._raw?.receipt_number || order.id
      const tableName = order._raw?.table_detail?.number || ''
      const customerName = order._raw?.customer_detail?.name || ''

      return (
        receiptNum.toString().toLowerCase().includes(searchLower) ||
        tableName.toString().toLowerCase().includes(searchLower) ||
        customerName.toLowerCase().includes(searchLower)
      )
    })
  }, [orders, searchTerm])

  // Sort filtered orders
  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders]

    switch (sortBy) {
      case 'amount':
        return sorted.sort((a, b) => (b.total || 0) - (a.total || 0))
      case 'table':
        return sorted.sort((a, b) => {
          const aTable = parseInt(a._raw?.table_detail?.number || '0')
          const bTable = parseInt(b._raw?.table_detail?.number || '0')
          return aTable - bTable
        })
      case 'recent':
      default:
        return sorted
    }
  }, [filteredOrders, sortBy])

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [searchTerm, sortBy])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent, onSelect: (order: Order) => void) => {
      if (!isOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex((prev) => Math.min(prev + 1, sortedOrders.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && sortedOrders[highlightedIndex]) {
        e.preventDefault()
        onSelect(sortedOrders[highlightedIndex])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setIsOpen(false)
      }
    },
    [isOpen, sortedOrders, highlightedIndex]
  )

  return {
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    filteredOrders,
    sortedOrders,
    highlightedIndex,
    setHighlightedIndex,
    isOpen,
    setIsOpen,
    handleKeyDown,
  }
}
