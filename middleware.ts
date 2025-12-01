import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Role-based route permissions
const roleRoutes: Record<string, string[]> = {
  admin: [
    "/dashboard",
    "/dashboard/sales",
    "/dashboard/pos",
    "/dashboard/products",
    "/dashboard/inventory",
    "/dashboard/outlets",
    "/dashboard/reports",
    "/dashboard/customers",
    "/dashboard/staff",
    "/dashboard/settings",
    "/dashboard/notifications",
    "/dashboard/activity-log",
  ],
  cashier: [
    "/dashboard",
    "/dashboard/sales",
    "/dashboard/pos",
    "/dashboard/customers",
    "/dashboard/reports",
    "/dashboard/notifications",
  ],
  staff: [
    "/dashboard",
    "/dashboard/sales",
    "/dashboard/pos",
    "/dashboard/products",
    "/dashboard/inventory",
    "/dashboard/notifications",
  ],
  manager: [
    "/dashboard",
    "/dashboard/sales",
    "/dashboard/pos",
    "/dashboard/products",
    "/dashboard/inventory",
    "/dashboard/outlets",
    "/dashboard/reports",
    "/dashboard/customers",
    "/dashboard/notifications",
    "/dashboard/activity-log",
  ],
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for public routes
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname === "/" ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static")
  ) {
    return NextResponse.next()
  }

  // For dashboard routes, check role-based access
  if (pathname.startsWith("/dashboard")) {
    // In production, get role from session/cookie
    // For now, we'll allow access and handle it client-side
    // You can add server-side role checking here
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}

