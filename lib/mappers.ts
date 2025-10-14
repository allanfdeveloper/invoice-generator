import { supabase } from "@/lib/supabase"
import {
  CompanySettings,
  Client,
  Quote,
  Invoice,
  Item,
  QuoteStatus,
  InvoiceStatus,
  ItemType,
  PaymentInstructions,
  SlaService,
  SlaConfiguration,
  SlaIncident,
  SlaMetric,
  SlaCredit,
  SlaReport,
  SlaMetricType,
  SlaIncidentSeverity,
  SlaIncidentStatus,
  SlaReportType
} from "@/lib/invoice-types"

function toItem(row: unknown): Item {
  const item = row as {
    id: string
    description: string
    unit_price: number
    qty: number
    taxable: boolean
    item_type: string
    unit: string
    created_at: string
  }
  
  return {
    id: item.id,
    description: item.description,
    unitPrice: item.unit_price,
    qty: item.qty,
    taxable: item.taxable,
    itemType: item.item_type as ItemType,
    unit: item.unit,
    createdAt: item.created_at,
  }
}

export function mapSettingsRow(row: unknown): CompanySettings {
  const settings = row as {
    id: string
    company_name: string
    address: string
    email: string
    phone: string
    logo_url: string
    currency: string
    vat_percentage: number
    numbering_format_invoice: string
    numbering_format_quote: string
    next_quote_number: number
    next_invoice_number: number
    terms_text: string
    payment_instructions: PaymentInstructions
  }
  
  return {
    id: settings.id,
    companyName: settings.company_name,
    address: settings.address,
    email: settings.email,
    phone: settings.phone,
    logoUrl: settings.logo_url,
    currency: settings.currency,
    vatPercentage: settings.vat_percentage,
    numberingFormatInvoice: settings.numbering_format_invoice,
    numberingFormatQuote: settings.numbering_format_quote,
    nextQuoteNumber: settings.next_quote_number,
    nextInvoiceNumber: settings.next_invoice_number,
    termsText: settings.terms_text,
    paymentInstructions: {
      bank: settings.payment_instructions.bank,
      accountName: settings.payment_instructions.accountName,
      accountNumber: settings.payment_instructions.accountNumber,
      branchCode: settings.payment_instructions.branchCode,
      swift: settings.payment_instructions.swift,
    },
  }
}

export function mapClientRow(row: unknown): Client {
  const client = row as {
    id: string
    name: string
    company: string
    email: string
    billing_address: string
    delivery_address: string
    vat_number: string | null
    phone: string
    created_at: string
    updated_at: string
  }
  
  return {
    id: client.id,
    name: client.name,
    company: client.company,
    email: client.email,
    billingAddress: client.billing_address,
    deliveryAddress: client.delivery_address,
    vatNumber: client.vat_number ?? undefined,
    phone: client.phone,
    createdAt: client.created_at,
    updatedAt: client.updated_at,
  }
}

export function mapQuoteRow(row: unknown): Quote {
  const quote = row as {
    id: string
    quote_number: string
    created_by_user_id: string
    date_issued: string
    valid_until: string
    client_id: string
    quote_items: Array<{
      quote_id: string
      item_id: string
      updated_at: string
      items: {
        id: string
        description: string
        unit_price: number
        qty: number
        taxable: boolean
        item_type: string
        unit: string
        created_at: string
      }
    }>
    subtotal_excl_vat: number
    vat_amount: number
    total_incl_vat: number
    deposit_percentage: number
    deposit_amount: number
    balance_remaining: number
    status: string
    terms_text: string
    notes: string
    created_at: string
    updated_at: string
  }

  const items =
    quote.quote_items?.map((qi) => qi.items ? toItem(qi.items) : null).filter(Boolean) ?? []

  return {
    id: quote.id,
    quoteNumber: quote.quote_number,
    createdByUserId: quote.created_by_user_id,
    dateIssued: quote.date_issued,
    validUntil: quote.valid_until,
    clientId: quote.client_id,
    items,
    subtotalExclVat: quote.subtotal_excl_vat,
    vatAmount: quote.vat_amount,
    totalInclVat: quote.total_incl_vat,
    depositPercentage: quote.deposit_percentage ?? 0,
    depositAmount: quote.deposit_amount ?? 0,
    balanceRemaining:
      quote.balance_remaining ?? (quote.total_incl_vat ?? 0) - (quote.deposit_amount ?? 0),
    status: (quote.status as string).toLowerCase() as QuoteStatus,
    termsText: quote.terms_text ?? "",
    notes: quote.notes ?? "",
    createdAt: quote.created_at,
    updatedAt: quote.updated_at,
  }
}

export function mapInvoiceRow(row: unknown): Invoice {
  const invoice = row as {
    id: string
    invoice_number: string
    created_by_user_id: string
    date_issued: string
    due_date: string
    client_id: string
    status: string
    subtotal_excl_vat: number
    vat_amount: number
    total_incl_vat: number
    deposit_amount: number
    created_from_quote_id: string | null
    created_at: string
    updated_at: string
    invoice_items: Array<{
      id: string
      invoice_id: string
      item_id: string
      quantity: number
      unit_price: number
      total_price: number
      created_at: string
      updated_at: string
      items: {
        id: string
        description: string
        unit_price: number
        qty: number
        taxable: boolean
        item_type: string
        unit: string
        created_at: string
      }
    }>
  }

  const items =
    invoice.invoice_items?.map((ii) => ii.items ? ({
      ...toItem(ii.items),
      qty: ii.quantity, // Use quantity from invoice_items instead of items
      unitPrice: ii.unit_price, // Use unit_price from invoice_items instead of items
    }) : null).filter(Boolean) ?? []

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    createdByUserId: invoice.created_by_user_id,
    dateIssued: invoice.date_issued,
    dueDate: invoice.due_date,
    clientId: invoice.client_id,
    items,
    subtotalExclVat: invoice.subtotal_excl_vat,
    vatAmount: invoice.vat_amount,
    totalInclVat: invoice.total_incl_vat,
    depositRequired: invoice.deposit_amount > 0,
    depositAmount: invoice.deposit_amount || 0,
    balanceRemaining: invoice.total_incl_vat - (invoice.deposit_amount || 0),
    status: invoice.status as InvoiceStatus,
    paymentInstructions: {
      bank: "",
      accountName: "",
      accountNumber: "",
      branchCode: "",
      swift: "",
    },
    createdFromQuoteId: invoice.created_from_quote_id,
    createdAt: invoice.created_at,
    updatedAt: invoice.updated_at,
  }
}

export async function fetchCompanySettings(): Promise<CompanySettings | null> {
  const { data, error } = await supabase.from("company_settings").select("*").limit(1)
  if (error) {
    console.error("fetchCompanySettings error:", error)
    return null
  }
  if (!data || data.length === 0) return null
  return mapSettingsRow(data[0])
}

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("*")
  if (error) {
    console.error("fetchClients error:", error)
    return []
  }
  return (data ?? []).map(mapClientRow)
}

export async function fetchQuotes(): Promise<Quote[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select(`
      *,
      client:clients(*),
      quote_items(
        *,
        items:items(*)
      )
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("fetchQuotes error:", error)
    return []
  }
  return (data ?? []).map(mapQuoteRow)
}

export async function fetchInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      created_by_user_id,
      date_issued,
      due_date,
      client_id,
      status,
      subtotal_excl_vat,
      vat_amount,
      total_incl_vat,
      deposit_amount,
      created_from_quote_id,
      created_at,
      updated_at,
      invoice_items(
        *,
        items(*)
      )
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("fetchInvoices error:", error)
    return []
  }

  console.log("Debug - raw invoice data from database:", data)
  const mapped = (data ?? []).map(mapInvoiceRow)
  console.log("Debug - mapped invoice data:", mapped)
  return mapped
}

export async function fetchPackages(): Promise<Array<{
  id: string
  name: string
  description: string
  items: Item[]
  priceExclVat: number
  priceInclVat: number
}>> {
  const { data, error } = await supabase
    .from("packages")
    .select("*, package_items(items(*))")
    .order("name")

  if (error) {
    console.error("fetchPackages error:", error)
    return []
  }
  return (data ?? []).map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    items: pkg.package_items?.map((pi: {
      id: string
      package_id: string
      item_id: string
      items: {
        id: string
        description: string
        unit_price: number
        qty: number
        taxable: boolean
        item_type: string
        unit: string
        created_at: string
      }
    }) => toItem(pi.items)) ?? [],
    priceExclVat: pkg.price_excl_vat,
    priceInclVat: pkg.price_incl_vat,
  }))
}

// Utilities for UI
export function formatDateISO(dateStr: string | Date) {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr
  return new Date(d).toLocaleDateString("en-CA")
}

export function formatCurrency(amount: number, currency = "ZAR") {
  try {
    return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(amount ?? 0)
  } catch {
    return `${currency} ${Number(amount ?? 0).toFixed(2)}`
  }
}

export function humanizeStatus(status: string) {
  return status.replace(/_/g, " ")
}

export async function fetchQuoteById(quoteId: string, userId: string) {
  console.log("fetchQuoteById called with:", { quoteId, userId })

  let query = supabase
    .from("quotes")
    .select(`
      *,
      client:clients(*),
      quote_items(
        *,
        items:items(*)
      )
    `)
    .eq("id", quoteId)

  // Only add user filter if userId is provided
  if (userId) {
    query = query.eq("created_by_user_id", userId)
  }

  const { data: quote, error } = await query.single()

  if (error) {
    console.error("fetchQuoteById detailed error:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      quoteId,
      userId
    })
    return null
  }

  if (!quote) {
    console.log("fetchQuoteById: No quote found for:", { quoteId, userId })
    return null
  }

  console.log("fetchQuoteById: Quote found, fetching company settings...")

  // Fetch company settings separately
  const settings = await fetchCompanySettings()

  if (!settings) {
    console.log("fetchQuoteById: No company settings found, using defaults")
  }

  return {
    quote: mapQuoteRow(quote),
    client: mapClientRow(quote.client),
    settings: settings
  }
}

export async function fetchInvoiceById(invoiceId: string, userId: string) {
  console.log("fetchInvoiceById called with:", { invoiceId, userId })

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`
      *,
      client:clients(*),
      invoice_items(
        *,
        items:items(*)
      )
    `)
    .eq("id", invoiceId)
    .eq("created_by_user_id", userId)
    .single()

  if (error) {
    console.error("fetchInvoiceById detailed error:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      invoiceId,
      userId
    })
    return null
  }

  if (!invoice) {
    console.log("fetchInvoiceById: No invoice found for:", { invoiceId, userId })
    return null
  }

  console.log("fetchInvoiceById: Invoice found, fetching company settings...")

  // Fetch company settings separately
  const settings = await fetchCompanySettings()

  if (!settings) {
    console.log("fetchInvoiceById: No company settings found, using defaults")
  }

  return {
    invoice: mapInvoiceRow(invoice),
    client: mapClientRow(invoice.client),
    settings: settings
  }
}
// SLA Mapper Functions
export function mapSlaServiceRow(row: unknown): SlaService {
  const slaService = row as {
    id: string
    name: string
    description: string | null
    client_id: string
    availability_target: number
    response_time_target: number | null
    resolution_time_target: number | null
    monthly_service_fee: number
    is_active: boolean
    created_at: string
    updated_at: string
    client?: {
      id: string
      name: string
      company: string
      email: string
      phone: string
    }
    sla_configurations?: Array<{
      id: string
      credit_tiers: Array<{ threshold: number; credit: number }>
      check_interval_seconds: number
      alert_thresholds: Record<string, number | string>
      business_hours_only: boolean
      exclude_maintenance_windows: boolean
      notification_emails: string[]
    }>
  }

  return {
    id: slaService.id,
    name: slaService.name,
    description: slaService.description ?? undefined,
    clientId: slaService.client_id,
    availabilityTarget: slaService.availability_target,
    responseTimeTarget: slaService.response_time_target ?? undefined,
    resolutionTimeTarget: slaService.resolution_time_target ?? undefined,
    monthlyServiceFee: slaService.monthly_service_fee,
    isActive: slaService.is_active,
    createdAt: slaService.created_at,
    updatedAt: slaService.updated_at,
    client: slaService.client ? mapClientRow(slaService.client) : undefined,
    configuration: slaService.sla_configurations?.[0] ? mapSlaConfigurationRow(slaService.sla_configurations[0]) : undefined,
  }
}

export function mapSlaConfigurationRow(row: unknown): SlaConfiguration {
  const config = row as {
    id: string
    sla_service_id: string
    credit_tiers: Array<{ threshold: number; credit: number }>
    check_interval_seconds: number
    alert_thresholds: Record<string, number | string>
    business_hours_only: boolean
    exclude_maintenance_windows: boolean
    notification_emails: string[]
    created_at: string
    updated_at: string
  }

  return {
    id: config.id,
    slaServiceId: config.sla_service_id,
    creditTiers: config.credit_tiers || [],
    checkIntervalSeconds: config.check_interval_seconds,
    alertThresholds: config.alert_thresholds || {},
    businessHoursOnly: config.business_hours_only,
    excludeMaintenanceWindows: config.exclude_maintenance_windows,
    notificationEmails: config.notification_emails || [],
    createdAt: config.created_at,
    updatedAt: config.updated_at,
  }
}

export function mapSlaIncidentRow(row: unknown): SlaIncident {
  const incident = row as {
    id: string
    sla_service_id: string
    title: string
    description: string
    severity: string
    status: string
    started_at: string
    resolved_at: string | null
    assigned_to: string | null
    affected_users: number
    estimated_revenue_impact: number
    resolution_notes: string | null
    created_at: string
    updated_at: string
    sla_service?: {
      id: string
      name: string
      client_id: string
    }
  }

  return {
    id: incident.id,
    slaServiceId: incident.sla_service_id,
    title: incident.title,
    description: incident.description,
    severity: incident.severity as SlaIncidentSeverity,
    status: incident.status as SlaIncidentStatus,
    startedAt: incident.started_at,
    resolvedAt: incident.resolved_at ?? undefined,
    assignedTo: incident.assigned_to ?? undefined,
    affectedUsers: incident.affected_users,
    estimatedRevenueImpact: incident.estimated_revenue_impact,
    resolutionNotes: incident.resolution_notes ?? undefined,
    createdAt: incident.created_at,
    updatedAt: incident.updated_at,
    slaService: incident.sla_service ? mapSlaServiceRow(incident.sla_service) : undefined,
  }
}

export function mapSlaMetricRow(row: unknown): SlaMetric {
  const metric = row as {
    id: string
    sla_service_id: string
    metric_type: string
    recorded_at: string
    value: number
    unit: string
    total_checks: number
    successful_checks: number
    failed_checks: number
    monitoring_source: string
    notes: string | null
    created_at: string
    sla_service?: {
      id: string
      name: string
    }
  }

  return {
    id: metric.id,
    slaServiceId: metric.sla_service_id,
    metricType: metric.metric_type as SlaMetricType,
    recordedAt: metric.recorded_at,
    value: metric.value,
    unit: metric.unit,
    totalChecks: metric.total_checks,
    successfulChecks: metric.successful_checks,
    failedChecks: metric.failed_checks,
    monitoringSource: metric.monitoring_source,
    notes: metric.notes ?? undefined,
    createdAt: metric.created_at,
    slaService: metric.sla_service ? {
      id: metric.sla_service.id,
      name: metric.sla_service.name,
    } : undefined,
  }
}

export function mapSlaCreditRow(row: unknown): SlaCredit {
  const credit = row as {
    id: string
    sla_service_id: string
    billing_period_start: string
    billing_period_end: string
    credit_percentage: number
    credit_amount: number
    applied_to_invoice_id: string | null
    created_at: string
    updated_at: string
    sla_service?: {
      id: string
      name: string
      client_id: string
    }
  }

  return {
    id: credit.id,
    slaServiceId: credit.sla_service_id,
    billingPeriodStart: credit.billing_period_start,
    billingPeriodEnd: credit.billing_period_end,
    creditPercentage: credit.credit_percentage,
    creditAmount: credit.credit_amount,
    appliedToInvoiceId: credit.applied_to_invoice_id ?? undefined,
    createdAt: credit.created_at,
    updatedAt: credit.updated_at,
    slaService: credit.sla_service ? mapSlaServiceRow(credit.sla_service) : undefined,
  }
}

export function mapSlaReportRow(row: unknown): SlaReport {
  const report = row as {
    id: string
    sla_service_id: string
    report_type: string
    period_start: string
    period_end: string
    availability_percentage: number
    total_incidents: number
    average_response_time: number
    average_resolution_time: number
    credits_earned: number
    report_data: Record<string, unknown>
    generated_at: string
    created_at: string
    updated_at: string
    sla_service?: {
      id: string
      name: string
      client_id: string
    }
  }

  return {
    id: report.id,
    slaServiceId: report.sla_service_id,
    reportType: report.report_type as SlaReportType,
    periodStart: report.period_start,
    periodEnd: report.period_end,
    availabilityPercentage: report.availability_percentage,
    totalIncidents: report.total_incidents,
    averageResponseTime: report.average_response_time,
    averageResolutionTime: report.average_resolution_time,
    creditsEarned: report.credits_earned,
    reportData: report.report_data || {},
    generatedAt: report.generated_at,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
    slaService: report.sla_service ? mapSlaServiceRow(report.sla_service) : undefined,
  }
}

// SLA fetch functions following existing patterns
export async function fetchSlaServices(): Promise<SlaService[]> {
  const { data, error } = await supabase
    .from("sla_services")
    .select(`
      *,
      client:clients(*),
      sla_configurations(
        id,
        credit_tiers,
        check_interval_seconds,
        alert_thresholds,
        business_hours_only,
        exclude_maintenance_windows,
        notification_emails
      )
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("fetchSlaServices error:", error)
    return []
  }
  return (data ?? []).map(mapSlaServiceRow)
}

export async function fetchSlaServiceById(slaServiceId: string): Promise<SlaService | null> {
  const { data, error } = await supabase
    .from("sla_services")
    .select(`
      *,
      client:clients(*),
      sla_configurations(
        id,
        credit_tiers,
        check_interval_seconds,
        alert_thresholds,
        business_hours_only,
        exclude_maintenance_windows,
        notification_emails
      )
    `)
    .eq("id", slaServiceId)
    .single()

  if (error) {
    console.error("fetchSlaServiceById error:", error)
    return null
  }
  return data ? mapSlaServiceRow(data) : null
}

export async function fetchSlaIncidents(slaServiceId?: string): Promise<SlaIncident[]> {
  let query = supabase
    .from("sla_incidents")
    .select(`
      *,
      sla_service:sla_services(id, name, client_id)
    `)
    .order("started_at", { ascending: false })

  if (slaServiceId) {
    query = query.eq("sla_service_id", slaServiceId)
  }

  const { data, error } = await query

  if (error) {
    console.error("fetchSlaIncidents error:", error)
    return []
  }
  return (data ?? []).map(mapSlaIncidentRow)
}

export async function fetchSlaMetrics(slaServiceId?: string, limit = 1000): Promise<SlaMetric[]> {
  let query = supabase
    .from("sla_metrics")
    .select(`
      *,
      sla_service:sla_services(id, name)
    `)
    .order("recorded_at", { ascending: false })
    .limit(limit)

  if (slaServiceId) {
    query = query.eq("sla_service_id", slaServiceId)
  }

  const { data, error } = await query

  if (error) {
    console.error("fetchSlaMetrics error:", error)
    return []
  }
  return (data ?? []).map(mapSlaMetricRow)
}

export async function fetchSlaCredits(slaServiceId?: string): Promise<SlaCredit[]> {
  let query = supabase
    .from("sla_credits")
    .select(`
      *,
      sla_service:sla_services(*)
    `)
    .order("billing_period_start", { ascending: false })

  if (slaServiceId) {
    query = query.eq("sla_service_id", slaServiceId)
  }

  const { data, error } = await query

  if (error) {
    console.error("fetchSlaCredits error:", error)
    return []
  }
  return (data ?? []).map(mapSlaCreditRow)
}

export async function fetchSlaReports(slaServiceId?: string): Promise<SlaReport[]> {
  let query = supabase
    .from("sla_reports")
    .select(`
      *,
      sla_service:sla_services(*)
    `)
    .order("generated_at", { ascending: false })

  if (slaServiceId) {
    query = query.eq("sla_service_id", slaServiceId)
  }

  const { data, error } = await query

  if (error) {
    console.error("fetchSlaReports error:", error)
    return []
  }
  return (data ?? []).map(mapSlaReportRow)
}