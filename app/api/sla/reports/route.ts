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

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const slaServiceId = searchParams.get("sla_service_id")
    const reportType = searchParams.get("report_type")
    const limit = searchParams.get("limit")

    let query = supabase
      .from("sla_reports")
      .select(`
        *,
        sla_service:sla_services(
          *,
          client:clients(*)
        )
      `)
      .order("generated_at", { ascending: false })

    // Filter by sla_service_id if provided
    if (slaServiceId) {
      query = query.eq("sla_service_id", slaServiceId)
    }

    // Filter by report_type if provided
    if (reportType) {
      query = query.eq("report_type", reportType)
    }

    // Apply limit if provided
    if (limit) {
      query = query.limit(parseInt(limit))
    }

    const { data: reports, error } = await query

    if (error) {
      console.error("Error fetching SLA reports:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ reports })
  } catch (error) {
    console.error("SLA reports API error:", error)
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

    // Check if this is a report generation request
    if (body.action === "generate") {
      return await generateReport(body, supabase)
    }

    // Validate required fields for creating a report record
    if (!body.sla_service_id || !body.report_type || !body.period_start || !body.period_end) {
      return NextResponse.json(
        { error: "SLA service ID, report type, period start, and period end are required" },
        { status: 400 }
      )
    }

    // Validate report type enum
    const validReportTypes = ['monthly', 'quarterly', 'annual', 'custom']
    if (!validReportTypes.includes(body.report_type)) {
      return NextResponse.json(
        { error: "Report type must be one of: monthly, quarterly, annual, custom" },
        { status: 400 }
      )
    }

    const { data: report, error } = await supabase
      .from("sla_reports")
      .insert([
        {
          sla_service_id: body.sla_service_id,
          report_type: body.report_type,
          period_start: body.period_start,
          period_end: body.period_end,
          availability_percentage: body.availability_percentage || null,
          total_incidents: body.total_incidents || 0,
          average_response_time: body.average_response_time || null,
          average_resolution_time: body.average_resolution_time || null,
          credits_earned: body.credits_earned || 0,
          report_data: body.report_data || {},
          generated_at: new Date().toISOString(),
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
      console.error("Error creating SLA report:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ report }, { status: 201 })
  } catch (error) {
    console.error("Create SLA report error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

async function generateReport(body: any, supabase: any) {
  try {
    const { sla_service_id, report_type, period_start, period_end } = body

    if (!sla_service_id || !report_type || !period_start || !period_end) {
      return NextResponse.json(
        { error: "SLA service ID, report type, period start, and period end are required for report generation" },
        { status: 400 }
      )
    }

    // Get SLA service details
    const { data: slaService, error: serviceError } = await supabase
      .from("sla_services")
      .select("*")
      .eq("id", sla_service_id)
      .single()

    if (serviceError || !slaService) {
      return NextResponse.json(
        { error: "SLA service not found" },
        { status: 404 }
      )
    }

    // Get metrics for the period
    const { data: metrics, error: metricsError } = await supabase
      .from("sla_metrics")
      .select("*")
      .eq("sla_service_id", sla_service_id)
      .gte("recorded_at", period_start)
      .lte("recorded_at", period_end)

    if (metricsError) {
      console.error("Error fetching metrics for report:", metricsError)
      return NextResponse.json({ error: metricsError.message }, { status: 500 })
    }

    // Get incidents for the period
    const { data: incidents, error: incidentsError } = await supabase
      .from("sla_incidents")
      .select("*")
      .eq("sla_service_id", sla_service_id)
      .gte("started_at", period_start)
      .lte("started_at", period_end)

    if (incidentsError) {
      console.error("Error fetching incidents for report:", incidentsError)
      return NextResponse.json({ error: incidentsError.message }, { status: 500 })
    }

    // Calculate metrics
    const calculatedMetrics = calculateSLAMetrics(metrics, incidents, slaService)

    // Create report data object
    const reportData = {
      metrics_summary: {
        total_metrics: metrics?.length || 0,
        availability_checks: metrics?.filter(m => m.metric_type === 'availability').length || 0,
        response_time_checks: metrics?.filter(m => m.metric_type === 'response_time').length || 0,
        resolution_time_checks: metrics?.filter(m => m.metric_type === 'resolution_time').length || 0,
      },
      incidents_summary: {
        total_incidents: incidents?.length || 0,
        by_severity: incidents?.reduce((acc: any, incident: any) => {
          acc[incident.severity] = (acc[incident.severity] || 0) + 1
          return acc
        }, {}) || {},
        by_status: incidents?.reduce((acc: any, incident: any) => {
          acc[incident.status] = (acc[incident.status] || 0) + 1
          return acc
        }, {}) || {},
      },
      period_details: {
        sla_service: slaService,
        period_start,
        period_end,
        generated_at: new Date().toISOString(),
      },
      detailed_metrics: metrics || [],
      detailed_incidents: incidents || [],
    }

    // Create the report record
    const { data: report, error: reportError } = await supabase
      .from("sla_reports")
      .insert([
        {
          sla_service_id,
          report_type,
          period_start,
          period_end,
          availability_percentage: calculatedMetrics.availabilityPercentage,
          total_incidents: calculatedMetrics.totalIncidents,
          average_response_time: calculatedMetrics.averageResponseTime,
          average_resolution_time: calculatedMetrics.averageResolutionTime,
          credits_earned: calculatedMetrics.creditsEarned,
          report_data: reportData,
          generated_at: new Date().toISOString(),
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

    if (reportError) {
      console.error("Error creating generated report:", reportError)
      return NextResponse.json({ error: reportError.message }, { status: 500 })
    }

    return NextResponse.json({ report, generated: true }, { status: 201 })
  } catch (error) {
    console.error("Generate report error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

function calculateSLAMetrics(metrics: any[], incidents: any[], slaService: any) {
  // Calculate availability percentage
  const availabilityMetrics = metrics?.filter(m => m.metric_type === 'availability') || []
  let availabilityPercentage = 100 // Default to 100% if no metrics
  let creditsEarned = 0

  if (availabilityMetrics.length > 0) {
    const totalChecks = availabilityMetrics.reduce((sum, m) => sum + (m.total_checks || 0), 0)
    const successfulChecks = availabilityMetrics.reduce((sum, m) => sum + (m.successful_checks || 0), 0)

    if (totalChecks > 0) {
      availabilityPercentage = (successfulChecks / totalChecks) * 100
    }
  }

  // Calculate credits based on SLA breach
  const availabilityTarget = slaService.availability_target || 99.9
  if (availabilityPercentage < availabilityTarget) {
    const breachPercentage = availabilityTarget - availabilityPercentage
    // Simple credit calculation: 10% of monthly fee per 0.1% breach
    creditsEarned = (slaService.monthly_service_fee || 0) * (breachPercentage / 0.1) * 0.1
  }

  // Calculate average response time
  const responseTimeMetrics = metrics?.filter(m => m.metric_type === 'response_time') || []
  let averageResponseTime = null
  if (responseTimeMetrics.length > 0) {
    const totalTime = responseTimeMetrics.reduce((sum, m) => sum + (m.value || 0), 0)
    averageResponseTime = totalTime / responseTimeMetrics.length
  }

  // Calculate average resolution time
  const resolutionTimeMetrics = metrics?.filter(m => m.metric_type === 'resolution_time') || []
  let averageResolutionTime = null
  if (resolutionTimeMetrics.length > 0) {
    const totalTime = resolutionTimeMetrics.reduce((sum, m) => sum + (m.value || 0), 0)
    averageResolutionTime = totalTime / resolutionTimeMetrics.length
  }

  return {
    availabilityPercentage: Math.round(availabilityPercentage * 100) / 100,
    totalIncidents: incidents?.length || 0,
    averageResponseTime: averageResponseTime ? Math.round(averageResponseTime * 100) / 100 : null,
    averageResolutionTime: averageResolutionTime ? Math.round(averageResolutionTime * 100) / 100 : null,
    creditsEarned: Math.round(creditsEarned * 100) / 100,
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
        { error: "Report ID is required for updates" },
        { status: 400 }
      )
    }

    const { id, ...updateData } = body

    // Validate report type enum if provided
    if (updateData.report_type) {
      const validReportTypes = ['monthly', 'quarterly', 'annual', 'custom']
      if (!validReportTypes.includes(updateData.report_type)) {
        return NextResponse.json(
          { error: "Report type must be one of: monthly, quarterly, annual, custom" },
          { status: 400 }
        )
      }
    }

    const { data: report, error } = await supabase
      .from("sla_reports")
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
      console.error("Error updating SLA report:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error("Update SLA report error:", error)
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
    const reportId = searchParams.get("id")

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required for deletion" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("sla_reports")
      .delete()
      .eq("id", reportId)

    if (error) {
      console.error("Error deleting SLA report:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete SLA report error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}