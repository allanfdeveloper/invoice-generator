import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export async function GET() {
  try {
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

    const { data: slaServices, error } = await supabase
      .from("sla_services")
      .select(`
        *,
        client:clients(*)
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching SLA services:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ slaServices })
  } catch (error) {
    console.error("SLA services API error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
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

    // Validate required fields
    if (!body.name || !body.clientId) {
      return NextResponse.json(
        { error: "Name and client ID are required" },
        { status: 400 }
      )
    }

    const { data: slaService, error } = await supabase
      .from("sla_services")
      .insert([
        {
          name: body.name,
          description: body.description || null,
          client_id: body.clientId,
          availability_target: body.availabilityTarget || 99.9,
          response_time_target: body.responseTimeTarget || null,
          resolution_time_target: body.resolutionTimeTarget || null,
          monthly_service_fee: body.monthlyServiceFee || 0,
          is_active: body.isActive !== undefined ? body.isActive : true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("Error creating SLA service:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ slaService }, { status: 201 })
  } catch (error) {
    console.error("Create SLA service error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}