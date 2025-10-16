import { NextResponse } from "next/server"

export const runtime = 'nodejs'
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export async function GET(req: Request) {
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

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const slaServiceId = searchParams.get("sla_service_id")

    let query = supabase
      .from("sla_incidents")
      .select(`
        *,
        sla_service:sla_services(
          *,
          client:clients(*)
        )
      `)
      .order("created_at", { ascending: false })

    // Filter by sla_service_id if provided
    if (slaServiceId) {
      query = query.eq("sla_service_id", slaServiceId)
    }

    const { data: incidents, error } = await query

    if (error) {
      console.error("Error fetching SLA incidents:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ incidents })
  } catch (error) {
    console.error("SLA incidents API error:", error)
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
    if (!body.sla_service_id || !body.title || !body.severity) {
      return NextResponse.json(
        { error: "SLA service ID, title, and severity are required" },
        { status: 400 }
      )
    }

    // Validate severity enum
    const validSeverities = ['low', 'medium', 'high', 'critical']
    if (!validSeverities.includes(body.severity)) {
      return NextResponse.json(
        { error: "Severity must be one of: low, medium, high, critical" },
        { status: 400 }
      )
    }

    // Validate status enum if provided
    if (body.status) {
      const validStatuses = ['open', 'investigating', 'resolved', 'closed']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: "Status must be one of: open, investigating, resolved, closed" },
          { status: 400 }
        )
      }
    }

    const { data: incident, error } = await supabase
      .from("sla_incidents")
      .insert([
        {
          sla_service_id: body.sla_service_id,
          title: body.title,
          description: body.description || null,
          severity: body.severity,
          status: body.status || 'open',
          started_at: body.started_at || new Date().toISOString(),
          resolved_at: body.resolved_at || null,
          assigned_to: body.assigned_to || null,
          affected_users: body.affected_users || 0,
          estimated_revenue_impact: body.estimated_revenue_impact || 0,
          resolution_notes: body.resolution_notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select(`
        *,
        sla_service:sla_services(
          *,
          client:clients(*)
        )
      `)
      .single()

    if (error) {
      console.error("Error creating SLA incident:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ incident }, { status: 201 })
  } catch (error) {
    console.error("Create SLA incident error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
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

    if (!body.id) {
      return NextResponse.json(
        { error: "Incident ID is required for updates" },
        { status: 400 }
      )
    }

    const { id, ...updateData } = body

    // Validate severity enum if provided
    if (updateData.severity) {
      const validSeverities = ['low', 'medium', 'high', 'critical']
      if (!validSeverities.includes(updateData.severity)) {
        return NextResponse.json(
          { error: "Severity must be one of: low, medium, high, critical" },
          { status: 400 }
        )
      }
    }

    // Validate status enum if provided
    if (updateData.status) {
      const validStatuses = ['open', 'investigating', 'resolved', 'closed']
      if (!validStatuses.includes(updateData.status)) {
        return NextResponse.json(
          { error: "Status must be one of: open, investigating, resolved, closed" },
          { status: 400 }
        )
      }
    }

    const { data: incident, error } = await supabase
      .from("sla_incidents")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        sla_service:sla_services(
          *,
          client:clients(*)
        )
      `)
      .single()

    if (error) {
      console.error("Error updating SLA incident:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 })
    }

    return NextResponse.json({ incident })
  } catch (error) {
    console.error("Update SLA incident error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
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

    const { searchParams } = new URL(req.url)
    const incidentId = searchParams.get("id")

    if (!incidentId) {
      return NextResponse.json(
        { error: "Incident ID is required for deletion" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("sla_incidents")
      .delete()
      .eq("id", incidentId)

    if (error) {
      console.error("Error deleting SLA incident:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete SLA incident error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}