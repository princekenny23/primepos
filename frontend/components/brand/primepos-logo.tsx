"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface PrimePOSLogoProps {
  variant?: "full" | "icon"
  size?: "sm" | "md" | "lg"
  className?: string
  version?: 1 | 2 | 3
}

const sizeMap = {
  sm: { full: "w-32 h-7", icon: "w-6 h-6" },
  md: { full: "w-40 h-9", icon: "w-8 h-8" },
  lg: { full: "w-48 h-11", icon: "w-10 h-10" },
}

export function PrimePOSLogo({ 
  variant = "full", 
  size = "md",
  className,
  version = 1 
}: PrimePOSLogoProps) {
  const sizeClasses = sizeMap[size][variant]

  return (
    <div className={cn(sizeClasses, variant === "full" && "scale-150 origin-left", className)}>
      <img
        src="/logo.png"
        alt="PrimePOS"
        className={cn("h-full", variant === "icon" ? "w-full object-contain" : "w-auto object-contain")}
      />
    </div>
  )
}

