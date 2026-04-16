import React from "react"
import Link from "next/link"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-blue-900">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <img
              src="/icon.jpg"
              alt="PrimePOS"
              width={40}
              height={40}
              className="h-10 w-10 rounded-md object-cover"
            />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 bg-muted/20">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} PrimePOS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

