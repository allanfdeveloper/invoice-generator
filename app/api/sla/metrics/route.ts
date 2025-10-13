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

    const { data: slaMetrics, error } = await supabase
      .from("sla_metrics")
      .select(`
        *,
        sla_service:sla_services(
          id,
          name,
          client_id
        )
      `)
      .order("recorded_at", { ascending: false })
      .limit(1000)

    if (error) {
      console.error("Error fetching SLA metrics:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ slaMetrics })
  } catch (error) {
    console.error("SLA metrics API error:", error)
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
    const metricsArray = Array.isArray(body) ? body : [body]

    const { data: slaMetrics, error } = await supabase
      .from("sla_metrics")
      .insert(
        metricsArray.map(metric => ({
          sla_service_id: metric.slaServiceId,
          metric_type: metric.metricType,
          recorded_at: metric.recordedAt || new Date().toISOString(),
          value: metric.value,
          unit: metric.unit || "",
          total_checks: metric.totalChecks || 0,
          successful_checks: metric.successfulChecks || 0,
          failed_checks: metric.failedChecks || 0,
          monitoring_source: metric.monitoringSource || "manual",
          notes: metric.notes || null,
          created_at: new Date().toISOString(),
        }))
      )
      .select()

    if (error) {
      console.error("Error creating SLA metrics:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ slaMetrics }, { status: 201 })
  } catch (error) {
    console.error("Create SLA metrics error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}