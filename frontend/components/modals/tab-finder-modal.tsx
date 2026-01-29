"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"

interface TabItem {
  id: string
  tab_number: string | number
  customer_display: string
  total: number
  is_over_limit: boolean
  table_number?: string
}

interface TabFinderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabs: TabItem[]
  currentTabId?: string
  business?: any
  onSelectTab: (tabId: string) => void
}

type SortOption = "recent" | "amount" | "name"

export function TabFinderModal({
  open,
  onOpenChange,
  tabs,
  currentTabId,
  business,
  onSelectTab,
}: TabFinderModalProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("recent")
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter tabs based on search
  const filteredTabs = useMemo(() => {
    return tabs.filter((tab) => {
      const searchLower = searchTerm.toLowerCase()
      return (
        tab.customer_display.toLowerCase().includes(searchLower) ||
        tab.tab_number.toString().includes(searchLower) ||
        (tab.table_number && tab.table_number.toLowerCase().includes(searchLower))
      )
    })
  }, [tabs, searchTerm])

  // Sort filtered tabs
  const sortedTabs = useMemo(() => {
    const sorted = [...filteredTabs]
    
    switch (sortBy) {
      case "amount":
        return sorted.sort((a, b) => b.total - a.total)
      case "name":
        return sorted.sort((a, b) => 
          a.customer_display.localeCompare(b.customer_display)
        )
      case "recent":
      default:
        // Assume the order from API is "most recent first"
        return sorted
    }
  }, [filteredTabs, sortBy])

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [searchTerm, sortBy])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setHighlightedIndex((prev) =>
            Math.min(prev + 1, sortedTabs.length - 1)
          )
          break
        case "ArrowUp":
          e.preventDefault()
          setHighlightedIndex((prev) => Math.max(prev - 1, 0))
          break
        case "Enter":
          e.preventDefault()
          if (sortedTabs[highlightedIndex]) {
            onSelectTab(sortedTabs[highlightedIndex].id)
            onOpenChange(false)
            setSearchTerm("")
          }
          break
        case "Escape":
          e.preventDefault()
          onOpenChange(false)
          setSearchTerm("")
          break
        default:
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, sortedTabs, highlightedIndex, onSelectTab, onOpenChange])

  // Scroll wheel navigation
  useEffect(() => {
    if (!open || !listRef.current) return

    const handleWheel = (e: WheelEvent) => {
      if (!sortedTabs.length) return
      e.preventDefault()
      const direction = e.deltaY > 0 ? 1 : -1
      setHighlightedIndex((prev) => {
        const next = prev + direction
        return Math.min(Math.max(next, 0), sortedTabs.length - 1)
      })
    }

    const el = listRef.current
    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [open, sortedTabs.length])

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
  }, [open])

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current) {
      const highlightedElement = listRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      )
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" })
      }
    }
  }, [highlightedIndex])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Find Tab</DialogTitle>
          <DialogDescription>
            {tabs.length === 0
              ? "No open tabs"
              : `${tabs.length} tab${tabs.length !== 1 ? "s" : ""} open`}
          </DialogDescription>
        </DialogHeader>

        {/* Search & Sort Controls */}
        <div className="px-6 py-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search by name, tab #, or table..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="amount">Highest Amount</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tab List */}
        {sortedTabs.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            {searchTerm ? "No tabs match your search" : "No open tabs"}
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <ScrollArea className="flex-1">
              <div ref={listRef} className="space-y-1 py-4 px-6">
              {sortedTabs.map((tab, index) => {
                const isActive = currentTabId === tab.id
                const isHighlighted = index === highlightedIndex

                return (
                  <button
                    key={tab.id}
                    data-index={index}
                    onClick={() => {
                      onSelectTab(tab.id)
                      onOpenChange(false)
                      setSearchTerm("")
                    }}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors flex items-start justify-between",
                      isActive
                        ? "bg-primary/10 border-primary"
                        : isHighlighted
                        ? "bg-accent border-accent"
                        : "border-border hover:bg-muted",
                      "group"
                    )}
                  >
                    {/* Tab Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm leading-tight">
                          {tab.customer_display}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          #{tab.tab_number}
                        </Badge>
                        {tab.table_number && (
                          <Badge variant="secondary" className="text-xs">
                            Table {tab.table_number}
                          </Badge>
                        )}
                        {tab.is_over_limit && (
                          <Badge variant="destructive" className="text-xs">
                            Over Limit
                          </Badge>
                        )}
                      </div>
                      {tab.table_number && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Table {tab.table_number}
                        </p>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="font-bold text-primary">
                        {formatCurrency(tab.total, business)}
                      </p>
                    </div>
                  </button>
                )
              })}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Footer Help Text */}
        <div className="px-6 py-3 border-t bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex gap-4">
            <span>↑↓ or scroll to navigate</span>
            <span>Enter to select</span>
            <span>Esc to close</span>
          </div>
          {filteredTabs.length > 0 && (
            <span>{filteredTabs.length} result(s)</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
