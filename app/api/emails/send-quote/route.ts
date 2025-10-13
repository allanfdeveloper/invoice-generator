import { NextRequest } from "next/server"
import { withErrorHandler, withRateLimit } from "@/lib/error-handler"
import { EmailService } from "@/lib/services/email-service"
import { HTTP_STATUS } from "@/lib/types/api"
import { z } from "zod"

// Validation schema for quote email
const quoteEmailSchema = z.object({
  quoteId: z.string().uuid("Invalid quote ID"),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid client email"),
  quoteNumber: z.string().min(1, "Quote number is required"),
  quoteTotal: z.number().min(0, "Quote total must be positive"),
  validUntil: z.string().min(1, "Valid until date is required"),
  companyName: z.string().min(1, "Company name is required"),
  companyEmail: z.string().email("Invalid company email"),
  companyPhone: z.string().min(1, "Company phone is required"),
  quoteUrl: z.string().url().optional()
})

// POST /api/emails/send-quote - Send quote email
export const POST = withErrorHandler(
  withRateLimit(10, 60 * 1000)(async (req: NextRequest) => {
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return Response.json(
        { success: false, error: "User authentication required" },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    const body = await req.json()

    // Validate request body
    const validationResult = quoteEmailSchema.safeParse(body)
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
    const result = await emailService.sendQuoteEmail(validationResult.data)

    if (!result.success) {
      // Log failed email attempt
      await emailService.logEmailNotification(
        "quote",
        validationResult.data.clientEmail,
        validationResult.data.quoteId,
        "failed",
        result.error
      )

      return Response.json(
        { success: false, error: result.error },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    // Log successful email
    await emailService.logEmailNotification(
      "quote",
      validationResult.data.clientEmail,
      validationResult.data.quoteId,
      "sent"
    )

    return Response.json({
      success: true,
      message: "Quote email sent successfully"
    })
  })
)