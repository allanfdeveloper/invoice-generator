import { NextRequest } from "next/server"

export const runtime = 'nodejs'
import { withErrorHandler, withRateLimit } from "@/lib/error-handler"
import { EmailService } from "@/lib/services/email-service"
import { HTTP_STATUS } from "@/lib/types/api"
import { z } from "zod"

// Validation schema for payment reminder
const paymentReminderSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID")
})

// POST /api/emails/payment-reminder - Send payment reminder
export const POST = withErrorHandler(
  withRateLimit(5, 60 * 1000)(async (req: NextRequest) => {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return Response.json(
        { success: false, error: "User authentication required" },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    const body = await req.json()

    // Validate request body
    const validationResult = paymentReminderSchema.safeParse(body)
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

    const emailService = new EmailService(userId)
    const result = await emailService.sendPaymentReminder(validationResult.data.invoiceId)

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return Response.json({
      success: true,
      message: "Payment reminder sent successfully"
    })
  })
)