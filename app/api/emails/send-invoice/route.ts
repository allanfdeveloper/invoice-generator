import { NextRequest } from "next/server"
import { withErrorHandler, withRateLimit } from "@/lib/error-handler"
import { EmailService } from "@/lib/services/email-service"
import { HTTP_STATUS } from "@/lib/types/api"
import { z } from "zod"

// Validation schema for invoice email
const invoiceEmailSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid client email"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceTotal: z.number().min(0, "Invoice total must be positive"),
  dueDate: z.string().min(1, "Due date is required"),
  companyName: z.string().min(1, "Company name is required"),
  companyEmail: z.string().email("Invalid company email"),
  companyPhone: z.string().min(1, "Company phone is required"),
  invoiceUrl: z.string().url().optional()
})

// POST /api/emails/send-invoice - Send invoice email
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
    const validationResult = invoiceEmailSchema.safeParse(body)
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
    const result = await emailService.sendInvoiceEmail(validationResult.data)

    if (!result.success) {
      // Log failed email attempt
      await emailService.logEmailNotification(
        "invoice",
        validationResult.data.clientEmail,
        validationResult.data.invoiceId,
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
      "invoice",
      validationResult.data.clientEmail,
      validationResult.data.invoiceId,
      "sent"
    )

    return Response.json({
      success: true,
      message: "Invoice email sent successfully"
    })
  })
)