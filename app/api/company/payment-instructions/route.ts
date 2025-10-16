import { NextRequest } from "next/server"

export const runtime = 'nodejs'
import { withErrorHandler, withRateLimit } from "@/lib/error-handler"
import { CompanySettingsService } from "@/lib/services/company-settings-service"
import { HTTP_STATUS } from "@/lib/types/api"
import { z } from "zod"

// Validation schema for payment instructions
const paymentInstructionsSchema = z.object({
  bank: z.string().min(1, "Bank name is required"),
  accountName: z.string().min(1, "Account name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  branchCode: z.string().optional(),
  swift: z.string().optional()
})

// GET /api/company/payment-instructions - Get payment instructions
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
    const result = await settingsService.getPaymentInstructions()

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

// PUT /api/company/payment-instructions - Update payment instructions
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
    const validationResult = paymentInstructionsSchema.safeParse(body)
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
    const result = await settingsService.updatePaymentInstructions(validationResult.data)

    if (!result.success || !result.data) {
      return Response.json(
        { success: false, error: result.error },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return Response.json({
      success: true,
      data: result.data,
      message: "Payment instructions updated successfully"
    })
  })
)