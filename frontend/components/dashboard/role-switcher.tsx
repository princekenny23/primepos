"use client"

import { useRole } from "@/contexts/role-context"
import { Shield } from "lucide-react"

export function RoleSwitcher() {
  const { role } = useRole()

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg border bg-muted/50">
      <Shield className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-medium capitalize">{role || "staff"}</span>
    </div>
  )
}

