"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { GripVertical } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface Widget {
  id: string
  name: string
  enabled: boolean
  order: number
}

export function CustomizeDashboardModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const [widgets, setWidgets] = useState<Widget[]>([
    { id: "kpi", name: "KPI Cards", enabled: true, order: 1 },
    { id: "sales-chart", name: "Sales Chart", enabled: true, order: 2 },
    { id: "recent-activity", name: "Recent Activity", enabled: true, order: 3 },
    { id: "low-stock", name: "Low Stock Alerts", enabled: true, order: 4 },
    { id: "top-selling", name: "Top Selling Items", enabled: true, order: 5 },
    { id: "quick-actions", name: "Quick Actions", enabled: true, order: 6 },
  ])

  const toggleWidget = (id: string) => {
    setWidgets(widgets.map(widget =>
      widget.id === id ? { ...widget, enabled: !widget.enabled } : widget
    ))
  }

  const handleSave = () => {
    // In production, this would save to user preferences
    toast({
      title: "Dashboard Customized",
      description: "Your dashboard layout has been saved successfully.",
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <DialogDescription>
            Choose which widgets to display and their order
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-3 py-4">
            {widgets
              .sort((a, b) => a.order - b.order)
              .map((widget) => (
                <div
                  key={widget.id}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                  <input
                    type="checkbox"
                    id={widget.id}
                    checked={widget.enabled}
                    onChange={() => toggleWidget(widget.id)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor={widget.id} className="flex-1 cursor-pointer">
                    {widget.name}
                  </Label>
                </div>
              ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

