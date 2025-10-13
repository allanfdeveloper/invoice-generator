import { NextResponse } from "next/server"
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

    // Get sla_service_id from query parameters
    const { searchParams } = new URL(req.url)
    const slaServiceId = searchParams.get("sla_service_id")

    let query = supabase
      .from("sla_configurations")
      .select("*")
      .order("created_at", { ascending: false })

    // Filter by sla_service_id if provided
    if (slaServiceId) {
      query = query.eq("sla_service_id", slaServiceId)
    }

    const { data: configurations, error } = await query

    if (error) {
      console.error("Error fetching SLA configurations:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ configurations })
  } catch (error) {
    console.error("SLA configurations API error:", error)
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
    if (!body.sla_service_id) {
      return NextResponse.json(
        { error: "SLA service ID is required" },
        { status: 400 }
      )
    }

    // Validate and parse JSONB fields
    let creditTiers = body.credit_tiers || []
    let alertThresholds = body.alert_thresholds || {}
    let maintenanceWindows = body.maintenance_windows || []
    let notificationEmails = body.notification_emails || []

    // Ensure JSONB fields are valid JSON
    if (typeof creditTiers === "string") {
      try {
        creditTiers = JSON.parse(creditTiers)
      } catch (e) {
        return NextResponse.json(
          { error: "Invalid credit_tiers JSON format" },
          { status: 400 }
        )
      }
    }

    if (typeof alertThresholds === "string") {
      try {
        alertThresholds = JSON.parse(alertThresholds)
      } catch (e) {
        return NextResponse.json(
          { error: "Invalid alert_thresholds JSON format" },
          { status: 400 }
        )
      }
    }

    if (typeof maintenanceWindows === "string") {
      try {
        maintenanceWindows = JSON.parse(maintenanceWindows)
      } catch (e) {
        return NextResponse.json(
          { error: "Invalid maintenance_windows JSON format" },
          { status: 400 }
        )
      }
    }

    if (typeof notificationEmails === "string") {
      try {
        notificationEmails = JSON.parse(notificationEmails)
      } catch (e) {
        return NextResponse.json(
          { error: "Invalid notification_emails JSON format" },
          { status: 400 }
        )
      }
    }

    const { data: configuration, error } = await supabase
      .from("sla_configurations")
      .insert([
        {
          sla_service_id: body.sla_service_id,
          credit_tiers: creditTiers,
          check_interval_seconds: body.check_interval_seconds || 300, // Default 5 minutes
          alert_thresholds: alertThresholds,
          business_hours_only: body.business_hours_only || false,
          exclude_maintenance_windows: body.exclude_maintenance_windows || false,
          maintenance_windows: maintenanceWindows,
          notification_emails: notificationEmails,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("Error creating SLA configuration:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ configuration }, { status: 201 })
  } catch (error) {
    console.error("Create SLA configuration error:", error)
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

    // Validate required fields
    if (!body.id) {
      return NextResponse.json(
        { error: "Configuration ID is required" },
        { status: 400 }
      )
    }

    const { id, ...updateData } = body

    // Validate and parse JSONB fields if present
    let creditTiers = updateData.credit_tiers
    let alertThresholds = updateData.alert_thresholds
    let maintenanceWindows = updateData.maintenance_windows
    let notificationEmails = updateData.notification_emails

    if (creditTiers !== undefined) {
      if (typeof creditTiers === "string") {
        try {
          creditTiers = JSON.parse(creditTiers)
        } catch (e) {
          return NextResponse.json(
            { error: "Invalid credit_tiers JSON format" },
            { status: 400 }
          )
        }
      }
      updateData.credit_tiers = creditTiers
    }

    if (alertThresholds !== undefined) {
      if (typeof alertThresholds === "string") {
        try {
          alertThresholds = JSON.parse(alertThresholds)
        } catch (e) {
          return NextResponse.json(
            { error: "Invalid alert_thresholds JSON format" },
            { status: 400 }
          )
        }
      }
      updateData.alert_thresholds = alertThresholds
    }

    if (maintenanceWindows !== undefined) {
      if (typeof maintenanceWindows === "string") {
        try {
          maintenanceWindows = JSON.parse(maintenanceWindows)
        } catch (e) {
          return NextResponse.json(
            { error: "Invalid maintenance_windows JSON format" },
            { status: 400 }
          )
        }
      }
      updateData.maintenance_windows = maintenanceWindows
    }

    if (notificationEmails !== undefined) {
      if (typeof notificationEmails === "string") {
        try {
          notificationEmails = JSON.parse(notificationEmails)
        } catch (e) {
          return NextResponse.json(
            { error: "Invalid notification_emails JSON format" },
            { status: 400 }
          )
        }
      }
      updateData.notification_emails = notificationEmails
    }

    // Add updated timestamp
    updateData.updated_at = new Date().toISOString()

    const { data: configuration, error } = await supabase
      .from("sla_configurations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating SLA configuration:", error)
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
    console.error("Update SLA configuration error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}