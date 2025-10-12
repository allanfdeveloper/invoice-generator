import { NextResponse } from "next/server"
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

    const { data: configuration, error } = await supabase
      .from("sla_configurations")
      .select(`
        *,
        sla_service:sla_services(
          id,
          name,
          client:clients(*)
        )
      `)
      .eq("id", params.id)
      .single()

    if (error) {
      console.error("Error fetching SLA configuration:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!configuration) {
      return NextResponse.json(
        { error: "SLA configuration not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ configuration })
  } catch (error) {
    console.error("SLA configuration API error:", error)
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
      .from("sla_configurations")
      .delete()
      .eq("id", params.id)

    if (error) {
      console.error("Error deleting SLA configuration:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete SLA configuration error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}