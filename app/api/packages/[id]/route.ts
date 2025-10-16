import { createClient } from "@supabase/supabase-js"

export const runtime = 'nodejs'
import { NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sgbrlqcquoydwgugaiqn.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnYnJscWNxdW95ZHdndWdhaXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODg4NjksImV4cCI6MjA3Mzg2NDg2OX0.QdfVq-AWsAoufIWe0d4OyursigMHYcerrqVezp7LhKs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
      .from("packages")
      .select("*, package_items(items(*))")
      .eq("id", params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      description: data.description,
      priceExclVat: data.price_excl_vat,
      priceInclVat: data.price_incl_vat,
      items: data.package_items?.map((pi: { items: unknown }) => pi.items) || [],
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const body = await request.json()

    const { name, description, price_excl_vat, price_incl_vat } = body

    const { data, error } = await supabase
      .from("packages")
      .update({
        name,
        description: description || null,
        price_excl_vat,
        price_incl_vat,
      })
      .eq("id", params.id)
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // First delete package items relationships
    await supabase
      .from("package_items")
      .delete()
      .eq("package_id", params.id)

    // Then delete the package
    const { error } = await supabase
      .from("packages")
      .delete()
      .eq("id", params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}