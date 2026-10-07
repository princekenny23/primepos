"use client"

import { LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageLoadingProps {
  label: string
  className?: string
}

export function PageLoading({ label, className }: PageLoadingProps) {
  return (
    <div className={cn("flex min-h-64 items-center justify-center gap-3 text-muted-foreground", className)} role="status" aria-live="polite">
      <LoaderCircle className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
      <span className="animate-pulse">{label}</span>
    </div>
  )
}