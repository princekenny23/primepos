'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Plus, Search } from 'lucide-react'

interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
}

interface CustomerSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selected?: Customer | null
  onSelect: (customer: Customer) => void
  onAddNew?: () => void
  searchTerm: string
  onSearchChange: (term: string) => void
  searchResults: Customer[]
  isSearching: boolean
}

/**
 * Shared customer selector modal/dropdown
 * Allows search and selection of customers across all POS systems
 */
export function CustomerSelector({
  open,
  onOpenChange,
  selected,
  onSelect,
  onAddNew,
  searchTerm,
  onSearchChange,
  searchResults,
  isSearching,
}: CustomerSelectorProps) {
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (open) {
      setFocused(true)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Selected Customer */}
          {selected && (
            <div className="bg-green-50 border border-green-200 rounded p-2 text-sm">
              <div className="font-medium">{selected.name}</div>
              {selected.phone && <div className="text-xs text-muted-foreground">{selected.phone}</div>}
            </div>
          )}

          {/* Search Results */}
          {searchTerm && (
            <ScrollArea className="h-48 border rounded p-2">
              {isSearching ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((customer) => (
                    <Button
                      key={customer.id}
                      variant="ghost"
                      className="w-full justify-start text-left"
                      onClick={() => {
                        onSelect(customer)
                        onOpenChange(false)
                      }}
                    >
                      <div>
                        <div className="font-medium text-sm">{customer.name}</div>
                        {customer.phone && (
                          <div className="text-xs text-muted-foreground">{customer.phone}</div>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No customers found
                </div>
              )}
            </ScrollArea>
          )}

          {/* Add New Customer Button */}
          {onAddNew && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onAddNew()
                onOpenChange(false)
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add New Customer
            </Button>
          )}

          {/* Walk-in Option */}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              onSelect({ id: 'walk-in', name: 'Walk-in Customer' })
              onOpenChange(false)
            }}
          >
            Walk-in Customer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
