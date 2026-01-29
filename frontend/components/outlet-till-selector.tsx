import { useBusinessStore } from "@/stores/businessStore"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Building, Monitor } from "lucide-react"

export function OutletTillSelector() {
  const { currentOutlet, currentTill, outlets, tills, setCurrentOutlet, setCurrentTill } = useBusinessStore()

  return (
    <div className="flex gap-4 items-center">
      {/* Outlet Selector */}
      {outlets.length > 1 && (
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          <Select value={currentOutlet?.id || ""} onValueChange={setCurrentOutlet}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select outlet" />
            </SelectTrigger>
            <SelectContent>
              {outlets.map((outlet) => (
                <SelectItem key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Till Selector */}
      {tills.length > 0 && (
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <Select value={currentTill?.id || ""} onValueChange={setCurrentTill}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select till" />
            </SelectTrigger>
            <SelectContent>
              {tills.map((till) => (
                <SelectItem key={till.id} value={till.id}>
                  {till.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Display current selections if only one outlet/till */}
      {outlets.length === 1 && currentOutlet && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm">
          <Building className="h-4 w-4" />
          <span>{currentOutlet.name}</span>
        </div>
      )}

      {tills.length === 1 && currentTill && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm">
          <Monitor className="h-4 w-4" />
          <span>{currentTill.name}</span>
        </div>
      )}

      {/* Warning if no till selected */}
      {currentOutlet && tills.length > 0 && !currentTill && (
        <div className="text-sm text-destructive">
          ⚠️ Please select a till
        </div>
      )}
    </div>
  )
}
