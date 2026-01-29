import { useState, useEffect, useCallback, useMemo } from 'react'

interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
}

/**
 * Shared hook for customer search and selection
 * Used by all POS systems for customer lookup/selection flow
 */
export function useCustomerSelector(customerService: any) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Search customers
  const searchCustomers = useCallback(
    async (term: string) => {
      if (!term || term.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const results = await customerService.list({ search: term })
        setSearchResults(results.slice(0, 10) || [])
      } catch (error) {
        console.error('Failed to search customers:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [customerService]
  )

  // Trigger search on debounced term change
  useEffect(() => {
    searchCustomers(debouncedSearchTerm)
  }, [debouncedSearchTerm, searchCustomers])

  const selectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer)
    setSearchTerm('')
    setSearchResults([])
  }, [])

  const clearCustomer = useCallback(() => {
    setSelectedCustomer(null)
    setSearchTerm('')
    setSearchResults([])
  }, [])

  return {
    selectedCustomer,
    setSelectedCustomer,
    selectCustomer,
    clearCustomer,
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
  }
}
