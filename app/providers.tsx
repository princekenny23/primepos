"use client"

import { TenantProvider } from "@/contexts/tenant-context"
import { RoleProvider } from "@/contexts/role-context"
import { ShiftProvider } from "@/contexts/shift-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <RoleProvider>
        <ShiftProvider>
          {children}
        </ShiftProvider>
      </RoleProvider>
    </TenantProvider>
  )
}

