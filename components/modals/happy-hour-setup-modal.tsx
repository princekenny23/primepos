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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Clock } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface HappyHourSetupModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HappyHourSetupModal({ open, onOpenChange }: HappyHourSetupModalProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [startTime, setStartTime] = useState("17:00")
  const [endTime, setEndTime] = useState("19:00")
  const [discount, setDiscount] = useState("20")
  const [days, setDays] = useState<Set<string>>(new Set(["monday", "tuesday", "wednesday", "thursday", "friday"]))

  const weekDays = [
    { value: "monday", label: "Monday" },
    { value: "tuesday", label: "Tuesday" },
    { value: "wednesday", label: "Wednesday" },
    { value: "thursday", label: "Thursday" },
    { value: "friday", label: "Friday" },
    { value: "saturday", label: "Saturday" },
    { value: "sunday", label: "Sunday" },
  ]

  const handleDayToggle = (day: string) => {
    const newDays = new Set(days)
    if (newDays.has(day)) {
      newDays.delete(day)
    } else {
      newDays.add(day)
    }
    setDays(newDays)
  }

  const handleSave = async () => {
    if (enabled && days.size === 0) {
      toast({
        title: "Days Required",
        description: "Please select at least one day for happy hour.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    // In production, this would call API
    setTimeout(() => {
      setIsSaving(false)
      toast({
        title: "Happy Hour Saved",
        description: "Happy hour settings have been saved successfully.",
      })
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Happy Hour Setup
          </DialogTitle>
          <DialogDescription>
            Configure happy hour discounts and timing
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-happy-hour"
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(checked as boolean)}
            />
            <Label htmlFor="enable-happy-hour" className="cursor-pointer">
              Enable Happy Hour
            </Label>
          </div>

          {enabled && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time *</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-time">End Time *</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount">Discount Percentage *</Label>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Days of Week *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {weekDays.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={day.value}
                        checked={days.has(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <Label htmlFor={day.value} className="cursor-pointer text-sm">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Happy hour discount of {discount}% will apply automatically during {startTime} - {endTime} on selected days.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || (enabled && days.size === 0)}>
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

