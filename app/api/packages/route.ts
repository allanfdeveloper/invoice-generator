import { createClient } from "@supabase/supabase-js"

export const runtime = 'nodejs'
import { NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sgbrlqcquoydwgugaiqn.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnYnJscWNxdW95ZHdndWdhaXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODg4NjksImV4cCI6MjA3Mzg2NDg2OX0.QdfVq-AWsAoufIWe0d4OyursigMHYcerrqVezp7LhKs"

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
      .from("packages")
      .select("*, package_items(items(*))")
      .order("name")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const packages = data?.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      priceExclVat: pkg.price_excl_vat,
      priceInclVat: pkg.price_incl_vat,
      items: pkg.package_items?.map((pi: any) => pi.items) || [],
      createdAt: pkg.created_at,
      updatedAt: pkg.updated_at,
    })) || []

    return NextResponse.json(packages)
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const body = await request.json()

    const { name, description, price_excl_vat, price_incl_vat } = body

    if (!name || price_excl_vat === undefined || price_incl_vat === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("packages")
      .insert({
        name,
        description: description || null,
        price_excl_vat,
        price_incl_vat,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      description: data.description,
      priceExclVat: data.price_excl_vat,
      priceInclVat: data.price_incl_vat,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}