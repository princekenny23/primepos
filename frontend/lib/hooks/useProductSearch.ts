import { useState, useEffect, useCallback, useMemo } from 'react'
import { categoryService } from '@/lib/services/productService'

interface Category {
  id: string
  name: string
  description?: string
  icon?: string
}

interface Product {
  id: string
  name: string
  price: number
  category?: Category | { id: string }
  category_id?: string
  description?: string
  sku?: string
  barcode?: string
  is_active?: boolean
}

/**
 * Shared hook for product search, filtering by category, and loading
 * Used by all POS systems (bar, restaurant, retail)
 */
export function useProductSearch(isActive = true) {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 200)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Load categories
  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true)
    try {
      const data = await categoryService.list()
      setCategories(data || [])
      setCategoriesError(null)
    } catch (err: any) {
      console.error('Failed to load categories:', err)
      setCategoriesError(err.message || 'Failed to load categories')
      setCategories([])
    } finally {
      setIsLoadingCategories(false)
    }
  }, [])

  // Load products (implement in component based on service)
  const loadProducts = useCallback(async (productService: any) => {
    setIsLoading(true)
    try {
      const data = await productService.list({ is_active: isActive })
      const list = Array.isArray(data) ? data : data.results || []
      setProducts(list)
      setError(null)
    } catch (err: any) {
      console.error('Failed to load products:', err)
      setError(err.message || 'Failed to load products')
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }, [isActive])

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        (product.category && (product.category as any).id === selectedCategory) ||
        product.category_id === selectedCategory ||
        (!product.category && !product.category_id && selectedCategory === 'uncategorized')

      const matchesSearch =
        !debouncedSearchTerm ||
        product.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (product.sku && product.sku.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (product.barcode && product.barcode.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))

      return matchesCategory && matchesSearch && (product.is_active !== false)
    })
  }, [products, selectedCategory, debouncedSearchTerm])

  return {
    products,
    filteredProducts,
    isLoading,
    error,
    loadProducts,
    
    categories,
    isLoadingCategories,
    categoriesError,
    loadCategories,
    
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
  }
}
