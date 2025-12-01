"use client"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Keyboard } from "lucide-react"

export function ShortcutKeysLegend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Keyboard className="h-4 w-4 mr-2" />
          Shortcuts
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Keyboard Shortcuts</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Search</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl + F</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Add to Cart</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Process Payment</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs">F1</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Clear Cart</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl + X</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hold Sale</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl + H</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Print Receipt</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl + P</kbd>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

