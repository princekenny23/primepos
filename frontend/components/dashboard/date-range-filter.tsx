"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "lucide-react"
import { DatePicker } from "@/components/ui/date-picker"
import { useEffect, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"

interface DateRangeFilterProps {
  onRangeChange?: (range: { start: Date | undefined; end: Date | undefined }) => void
  defaultPreset?: string
}

const presetRanges = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "last7" },
  { label: "Last 30 Days", value: "last30" },
  { label: "This Month", value: "thisMonth" },
  { label: "Last Month", value: "lastMonth" },
  { label: "This Year", value: "thisYear" },
  { label: "Custom Range", value: "custom" },
]

function getPresetRange(value: string) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let start: Date | undefined
  let end: Date | undefined = new Date(today)

  switch (value) {
    case "today":
      start = new Date(today)
      end = new Date(today)
      break
    case "yesterday":
      start = new Date(today)
      start.setDate(start.getDate() - 1)
      end = new Date(start)
      break
    case "last7":
      start = new Date(today)
      start.setDate(start.getDate() - 6)
      break
    case "last30":
      start = new Date(today)
      start.setDate(start.getDate() - 29)
      break
    case "thisMonth":
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      break
    case "lastMonth":
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      end = new Date(today.getFullYear(), today.getMonth(), 0)
      break
    case "thisYear":
      start = new Date(today.getFullYear(), 0, 1)
      break
    default:
      start = today
      end = today
      break
  }

  return { start, end }
}

export function DateRangeFilter({ onRangeChange, defaultPreset = "today" }: DateRangeFilterProps) {
  const initialRange = getPresetRange(defaultPreset)

  const [selectedPreset, setSelectedPreset] = useState<string>(defaultPreset)
  const [startDate, setStartDate] = useState<Date | undefined>(initialRange.start)
  const [endDate, setEndDate] = useState<Date | undefined>(initialRange.end)

  useEffect(() => {
    if (selectedPreset === "custom") {
      // Emit only complete custom ranges to avoid half-state filter glitches.
      if (startDate && endDate) {
        onRangeChange?.({ start: startDate, end: endDate })
      }
      return
    }

    onRangeChange?.({ start: startDate, end: endDate })
  }, [selectedPreset, startDate, endDate, onRangeChange])

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value)

    if (value === "custom") {
      if (!startDate || !endDate) {
        const fallback = getPresetRange("today")
        setStartDate(fallback.start)
        setEndDate(fallback.end)
      }
      return
    }

    const { start, end } = getPresetRange(value)
    setStartDate(start)
    setEndDate(end)
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presetRanges.map((range) => (
            <SelectItem key={range.value} value={range.value}>
              {range.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedPreset === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
              <Calendar className="mr-2 h-4 w-4" />
              {startDate && endDate ? (
                <>
                  {format(startDate, "LLL dd, y")} - {format(endDate, "LLL dd, y")}
                </>
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <DatePicker
                  date={startDate}
                  onDateChange={(date) => {
                    setStartDate(date)
                    setSelectedPreset("custom")
                  }}
                  placeholder="Select start date"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <DatePicker
                  date={endDate}
                  onDateChange={(date) => {
                    setEndDate(date)
                    setSelectedPreset("custom")
                  }}
                  placeholder="Select end date"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {selectedPreset !== "custom" && startDate && endDate && (
        <span className="text-sm text-muted-foreground">
          {format(startDate, "MMM dd")} - {format(endDate, "MMM dd, yyyy")}
        </span>
      )}
    </div>
  )
}
