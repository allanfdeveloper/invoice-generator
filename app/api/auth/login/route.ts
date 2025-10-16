import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sgbrlqcquoydwgugaiqn.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnYnJscWNxdW95ZHdndWdhaXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODg4NjksImV4cCI6MjA3Mzg2NDg2OX0.QdfVq-AWsAoufIWe0d4OyursigMHYcerrqVezp7LhKs"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

type LoginBody = {
  email?: string
  password?: string
  remember?: boolean
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody
    const { email, password } = body ?? {}

    console.log("Login attempt:", { email, password: password ? "***" : undefined })

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // Use Supabase auth for authentication
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    console.log("Supabase auth result:", { success: !error, error: error?.message })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    // Return the session and user data
    return NextResponse.json({
      success: true,
      user: data.user,
      session: data.session
    }, { status: 200 })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Bad Request" }, { status: 400 })
  }
}