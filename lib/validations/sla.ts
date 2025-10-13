import { z } from "zod"

// SLA Service Form Validation
export const slaServiceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Service name is required")
    .max(200, "Service name must be less than 200 characters"),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be less than 1000 characters")
    .optional(),
  clientId: z
    .string()
    .uuid("Please select a valid client"),
  availabilityTarget: z
    .number()
    .min(0, "Availability target must be at least 0%")
    .max(100, "Availability target cannot exceed 100%"),
  responseTimeTarget: z
    .number()
    .min(0, "Response time target must be positive")
    .nullable()
    .optional(),
  resolutionTimeTarget: z
    .number()
    .min(0, "Resolution time target must be positive")
    .nullable()
    .optional(),
  monthlyServiceFee: z
    .number()
    .min(0, "Monthly service fee must be at least 0"),
  isActive: z.boolean().default(true),
})

export type SlaServiceFormValues = z.input<typeof slaServiceSchema>
export type SlaServiceValues = z.output<typeof slaServiceSchema>

// SLA Configuration Form Validation
export const slaConfigurationSchema = z.object({
  creditTiers: z.array(
    z.object({
      threshold: z
        .number()
        .min(0, "Threshold must be at least 0")
        .max(100, "Threshold cannot exceed 100"),
      credit: z
        .number()
        .min(0, "Credit must be at least 0")
        .max(100, "Credit cannot exceed 100"),
    })
  ).min(1, "At least one credit tier is required"),
  checkIntervalSeconds: z
    .number()
    .min(30, "Check interval must be at least 30 seconds")
    .max(3600, "Check interval cannot exceed 1 hour"),
  alertThresholds: z.record(z.any()).default({}),
  businessHoursOnly: z.boolean().default(false),
  excludeMaintenanceWindows: z.boolean().default(true),
  maintenanceWindows: z.array(
    z.object({
      start: z.string().min(1, "Start time is required"),
      end: z.string().min(1, "End time is required"),
      description: z.string().min(1, "Description is required"),
    })
  ).default([]),
  notificationEmails: z.array(z.string().email("Please enter a valid email")).default([]),
})

export type SlaConfigurationFormValues = z.input<typeof slaConfigurationSchema>
export type SlaConfigurationValues = z.output<typeof slaConfigurationSchema>

// SLA Incident Form Validation
export const slaIncidentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Incident title is required")
    .max(200, "Title must be less than 200 characters"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(2000, "Description must be less than 2000 characters"),
  severity: z.enum(["low", "medium", "high", "critical"], {
    errorMap: (issue, ctx) => {
      return { message: "Please select a valid severity level" }
    },
  }),
  status: z.enum(["open", "investigating", "resolved", "closed"], {
    errorMap: (issue, ctx) => {
      return { message: "Please select a valid status" }
    },
  }).default("open"),
  startedAt: z.string().min(1, "Start time is required"),
  assignedTo: z.string().uuid().nullable().optional(),
  affectedUsers: z.number().min(0, "Affected users must be at least 0").default(0),
  estimatedRevenueImpact: z.number().min(0, "Revenue impact must be at least 0").default(0),
})

export type SlaIncidentFormValues = z.input<typeof slaIncidentSchema>
export type SlaIncidentValues = z.output<typeof slaIncidentSchema>

// SLA Metrics Form Validation (for manual entry)
export const slaMetricSchema = z.object({
  metricType: z.enum(["availability", "response_time", "resolution_time", "incident_count"], {
    errorMap: (issue, ctx) => {
      return { message: "Please select a valid metric type" }
    },
  }),
  recordedAt: z.string().min(1, "Recorded time is required"),
  value: z.number(),
  unit: z.string().default(""),
  totalChecks: z.number().min(0, "Total checks must be at least 0").default(0),
  successfulChecks: z.number().min(0, "Successful checks must be at least 0").default(0),
  failedChecks: z.number().min(0, "Failed checks must be at least 0").default(0),
  monitoringSource: z.string().default("manual"),
  notes: z.string().trim().max(1000, "Notes must be less than 1000 characters").optional(),
})

export type SlaMetricFormValues = z.input<typeof slaMetricSchema>
export type SlaMetricValues = z.output<typeof slaMetricSchema>

// Combined SLA Creation Form (Service + Configuration)
export const slaCreationSchema = slaServiceSchema.merge(
  z.object({
    configuration: slaConfigurationSchema,
  })
)

export type SlaCreationFormValues = z.input<typeof slaCreationSchema>
export type SlaCreationValues = z.output<typeof slaCreationSchema>

// SLA Report Filter Validation
export const slaReportFilterSchema = z.object({
  reportType: z.enum(["daily", "weekly", "monthly", "quarterly"], {
    errorMap: (issue, ctx) => {
      return { message: "Please select a valid report type" }
    },
  }).default("monthly"),
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  slaServiceIds: z.array(z.string().uuid()).optional(),
})

export type SlaReportFilterFormValues = z.input<typeof slaReportFilterSchema>
export type SlaReportFilterValues = z.output<typeof slaReportFilterSchema>