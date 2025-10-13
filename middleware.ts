import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { TOKEN_COOKIE } from "@/lib/constants"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables")
}

// Use service role key for server-side authentication verification
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

const protectedRoutes = [
  "/dashboard",
  "/quotes",
  "/invoices",
  "/clients",
  "/sla",
  "/profile",
  "/settings"
]

const authRoutes = ["/login"]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip middleware for API routes, static files, and public routes
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public/")
  ) {
    return NextResponse.next()
  }

  // Get token from cookie or Authorization header
  const token = req.cookies.get(TOKEN_COOKIE)?.value ||
                req.headers.get("authorization")?.replace("Bearer ", "")

  // Redirect to login for protected routes if no token
  if (!token && protectedRoutes.some(route => pathname.startsWith(route))) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If no token and not accessing protected routes, allow
  if (!token) {
    return NextResponse.next()
  }

  try {
    // Verify token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      // Clear invalid token and redirect to login
      const response = NextResponse.redirect(new URL("/login", req.url))
      response.cookies.delete(TOKEN_COOKIE)
      response.cookies.delete("sb-refresh-token")
      return response
    }

    // Add user info to request headers for downstream usage
    const response = NextResponse.next()
    response.headers.set("x-user-id", user.id)
    response.headers.set("x-user-email", user.email || "")

    // Redirect authenticated users away from auth routes
    if (authRoutes.some(route => pathname === route)) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    return response
  } catch (error) {
    console.error("Middleware auth error:", error)
    return NextResponse.redirect(new URL("/login", req.url))
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}