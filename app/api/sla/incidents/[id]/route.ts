import { NextResponse } from "next/server"

export const runtime = 'nodejs'
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
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

    const { data: incident, error } = await supabase
      .from("sla_incidents")
      .select(`
        *,
        sla_service:sla_services(
          *,
          client:clients(*)
        )
      `)
      .eq("id", params.id)
      .single()

    if (error) {
      console.error("Error fetching SLA incident:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 })
    }

    return NextResponse.json({ incident })
  } catch (error) {
    console.error("SLA incident API error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
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
      .eq("id", params.id)
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

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
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

    const { error } = await supabase
      .from("sla_incidents")
      .delete()
      .eq("id", params.id)

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