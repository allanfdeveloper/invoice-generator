import { NextResponse } from "next/server"

export const runtime = 'nodejs'
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = cookies()
    const token = cookieStore.get("sb-access-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Set the auth token
    supabase.auth.setSession(token)

    const { data: slaService, error } = await supabase
      .from("sla_services")
      .select(`
        *,
        client:clients(*),
        sla_configurations!inner(
          credit_tiers,
          check_interval_seconds,
          alert_thresholds,
          business_hours_only,
          exclude_maintenance_windows,
          notification_emails
        )
      `)
      .eq("id", id)
      .single()

    if (error) {
      console.error("Error fetching SLA service:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!slaService) {
      return NextResponse.json({ error: "SLA service not found" }, { status: 404 })
    }

    return NextResponse.json({ slaService })
  } catch (error) {
    console.error("SLA service API error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = cookies()
    const token = cookieStore.get("sb-access-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Set the auth token
    supabase.auth.setSession(token)

    const body = await req.json()
    const { id: _, ...updateData } = body

    const { data: slaService, error } = await supabase
      .from("sla_services")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating SLA service:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!slaService) {
      return NextResponse.json({ error: "SLA service not found" }, { status: 404 })
    }

    return NextResponse.json({ slaService })
  } catch (error) {
    console.error("Update SLA service error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = cookies()
    const token = cookieStore.get("sb-access-token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Set the auth token
    supabase.auth.setSession(token)

    const { error } = await supabase
      .from("sla_services")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting SLA service:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete SLA service error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}