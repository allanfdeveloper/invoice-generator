export enum Role {
  Admin = "admin",
  Sales = "sales",
  Viewer = "viewer",
}

export enum ItemType {
  Fixed = "fixed",
  Hourly = "hourly",
  Expense = "expense",
}

export enum QuoteStatus {
  Draft = "draft",
  Sent = "sent",
  Accepted = "accepted",
  Declined = "declined",
  Expired = "expired",
}

export enum InvoiceStatus {
  Draft = "draft",
  Sent = "sent",
  PartiallyPaid = "partially_paid",
  Paid = "paid",
  Overdue = "overdue",
}

export type Page = "dashboard" | "quotes" | "invoices" | "clients" | "sla" | "settings"

export interface PaymentInstructions {
  bank: string
  accountName: string
  accountNumber: string
  branchCode: string
  swift: string
}

export interface CompanySettings {
  id: string
  companyName: string
  address: string
  email: string
  phone: string
  logoUrl: string | null
  currency: string
  vatPercentage: number
  numberingFormatInvoice: string
  numberingFormatQuote: string
  nextInvoiceNumber: number
  nextQuoteNumber: number
  termsText: string
  paymentInstructions: PaymentInstructions
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface Client {
  id: string
  name: string
  company: string
  email: string
  billingAddress: string
  deliveryAddress: string
  vatNumber?: string
  phone: string
  createdAt?: string
  updatedAt?: string
}

export interface Item {
  id: string
  description: string
  unitPrice: number
  qty: number
  taxable: boolean
  itemType: ItemType
  unit: string
  createdAt?: string
}

export interface Package {
  id: string
  name: string
  description: string
  items: Omit<Item, "id">[]
  priceExclVat: number
  priceInclVat: number
}

export interface Quote {
  id: string
  quoteNumber: string
  createdByUserId: string
  dateIssued: string
  validUntil: string
  clientId: string
  items: Item[]
  subtotalExclVat: number
  vatAmount: number
  totalInclVat: number
  depositPercentage: number
  depositAmount: number
  balanceRemaining: number
  status: QuoteStatus
  termsText: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  createdByUserId: string
  dateIssued: string
  dueDate: string
  clientId: string
  items: Item[]
  subtotalExclVat: number
  vatAmount: number
  totalInclVat: number
  depositRequired: boolean
  depositAmount: number
  balanceRemaining: number
  status: InvoiceStatus
  paymentInstructions: PaymentInstructions
  createdFromQuoteId: string | null
  createdAt: string
  updatedAt: string
}
// SLA Related Enums
export enum SlaMetricType {
  Availability = "availability",
  ResponseTime = "response_time",
  ResolutionTime = "resolution_time",
  IncidentCount = "incident_count",
}

export enum IncidentSeverity {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export enum IncidentStatus {
  Open = "open",
  Investigating = "investigating",
  Resolved = "resolved",
  Closed = "closed",
}

export enum SlaReportType {
  Daily = "daily",
  Weekly = "weekly",
  Monthly = "monthly",
  Quarterly = "quarterly",
}

// SLA Related Interfaces
export interface SlaService {
  id: string
  name: string
  description: string
  clientId: string
  availabilityTarget: number
  responseTimeTarget: number | null
  resolutionTimeTarget: number | null
  monthlyServiceFee: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface SlaMetric {
  id: string
  slaServiceId: string
  metricType: SlaMetricType
  recordedAt: string
  value: number
  unit: string
  totalChecks: number
  successfulChecks: number
  failedChecks: number
  monitoringSource: string
  notes: string
  createdAt: string
}

export interface SlaIncident {
  id: string
  slaServiceId: string
  title: string
  description: string
  severity: IncidentSeverity
  status: IncidentStatus
  startedAt: string
  detectedAt: string
  resolvedAt: string | null
  assignedTo: string | null
  affectedUsers: number
  estimatedRevenueImpact: number
  createdAt: string
  updatedAt: string
}

export interface SlaConfiguration {
  id: string
  slaServiceId: string
  creditTiers: CreditTier[]
  checkIntervalSeconds: number
  alertThresholds: Record<string, any>
  businessHoursOnly: boolean
  excludeMaintenanceWindows: boolean
  maintenanceWindows: MaintenanceWindow[]
  notificationEmails: string[]
  createdAt: string
  updatedAt: string
}

export interface CreditTier {
  threshold: number
  credit: number
}

export interface MaintenanceWindow {
  start: string
  end: string
  description: string
}

export interface SlaReport {
  id: string
  slaServiceId: string
  reportType: SlaReportType
  periodStart: string
  periodEnd: string
  availabilityPercentage: number | null
  averageResponseTime: number | null
  averageResolutionTime: number | null
  totalIncidents: number
  totalDowntimeMinutes: number
  slaMet: boolean
  slaBreachDetails: Record<string, any>
  serviceCreditEarned: boolean
  creditPercentage: number
  creditAmount: number
  generatedAt: string
  processedForBilling: boolean
  processedAt: string | null
}

export interface SlaCredit {
  id: string
  slaReportId: string
  invoiceId: string | null
  creditAmount: number
  creditPercentage: number
  reason: string
  appliedToInvoice: boolean
  appliedAt: string | null
  createdAt: string
  createdBy: string | null
  notes: string
}
