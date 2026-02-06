"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, LucideIcon } from "lucide-react"
import { ReactNode } from "react"

export interface TabConfig {
  value: string
  label: string
  icon?: LucideIcon
  badgeCount?: number
  badgeVariant?: "default" | "secondary" | "destructive" | "outline"
}

interface FilterableTabsProps {
  tabs: TabConfig[]
  activeTab: string
  onTabChange: (value: string) => void
  children: ReactNode
  className?: string
  tabsListClassName?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  actionButton?: ReactNode
  actionButtonPlacement?: "right" | "below"
}

export function FilterableTabs({
  tabs,
  activeTab,
  onTabChange,
  children,
  className = "space-y-6",
  tabsListClassName = "grid w-full",
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  actionButton,
  actionButtonPlacement = "right",
}: FilterableTabsProps) {
  // Map number of tabs to Tailwind grid classes
  const gridColsMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
  }
  const gridCols = gridColsMap[tabs.length] || "grid-cols-3"
  
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className={className}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <TabsList className={`${tabsListClassName} ${gridCols}`}>
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger 
                  key={tab.value} 
                  value={tab.value} 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-900 data-[state=active]:text-white"
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {tab.label}
                  {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
                    <Badge 
                      variant={tab.badgeVariant || "secondary"} 
                      className="ml-1 h-5 min-w-5 px-1.5 text-xs"
                    >
                      {tab.badgeCount}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
          {actionButton && actionButtonPlacement === "right" && (
            <div className="flex-shrink-0">
              {actionButton}
            </div>
          )}
        </div>
        {actionButton && actionButtonPlacement === "below" && (
          <div className="flex justify-end">
            {actionButton}
          </div>
        )}
        {searchValue !== undefined && onSearchChange && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              className="pl-10"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}
      </div>
      {children}
    </Tabs>
  )
}

// Export TabsContent for convenience
export { TabsContent }

