import { NextRequest } from "next/server"

export const runtime = 'nodejs'
import { withErrorHandler, withRateLimit } from "@/lib/error-handler"
import { CompanySettingsService } from "@/lib/services/company-settings-service"
import { HTTP_STATUS } from "@/lib/types/api"
import { z } from "zod"

// Validation schemas
const updateSettingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required").optional(),
  address: z.string().optional(),
  email: z.string().email("Invalid email format").optional(),
  phone: z.string().optional(),
  currency: z.string().length(3, "Currency must be 3 characters").optional(),
  vatPercentage: z.number().min(0).max(100).optional(),
  numberingFormatInvoice: z.string().optional(),
  numberingFormatQuote: z.string().optional(),
  termsText: z.string().optional(),
  logoUrl: z.string().url().nullable().optional(),
  paymentInstructions: z.object({
    bank: z.string().min(1, "Bank name is required"),
    accountName: z.string().min(1, "Account name is required"),
    accountNumber: z.string().min(1, "Account number is required"),
    branchCode: z.string().optional(),
    swift: z.string().optional()
  }).optional()
})

// GET /api/company/settings - Get company settings
export const GET = withErrorHandler(
  withRateLimit(100, 60 * 1000)(async (req: NextRequest) => {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return Response.json(
        { success: false, error: "User authentication required" },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    const settingsService = new CompanySettingsService(userId)
    const result = await settingsService.getSettings()

    if (!result.success || !result.data) {
      return Response.json(
        { success: false, error: result.error },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return Response.json({
      success: true,
      data: result.data
    })
  })
)

// PUT /api/company/settings - Update company settings
export const PUT = withErrorHandler(
  withRateLimit(20, 60 * 1000)(async (req: NextRequest) => {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return Response.json(
        { success: false, error: "User authentication required" },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    const body = await req.json()

    // Validate request body
    const validationResult = updateSettingsSchema.safeParse(body)
    if (!validationResult.success) {
      return Response.json(
        {
          success: false,
          error: "Validation failed",
          errors: validationResult.error.errors.map(err => ({
            field: err.path.join("."),
            message: err.message
          }))
        },
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      )
    }

    const settingsService = new CompanySettingsService(userId)
    const result = await settingsService.updateSettings(validationResult.data)

    if (!result.success || !result.data) {
      return Response.json(
        { success: false, error: result.error },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return Response.json({
      success: true,
      data: result.data,
      message: "Company settings updated successfully"
    })
  })
)