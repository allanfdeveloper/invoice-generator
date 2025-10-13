import { NextRequest } from "next/server"
import { withErrorHandler, withRateLimit } from "@/lib/error-handler"
import { InvoiceService } from "@/lib/services/invoice-service"
import { HTTP_STATUS } from "@/lib/types/api"
import { z } from "zod"

// Validation schema for payment
const paymentSchema = z.object({
  amount: z.number().min(0.01, "Payment amount must be positive"),
  paymentDate: z.string().optional(),
  notes: z.string().optional()
})

// POST /api/invoices/[id]/payments - Record payment for invoice
export const POST = withErrorHandler(
  withRateLimit(20, 60 * 1000)(async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params
    const userId = req.headers.get("x-user-id")

    if (!userId) {
      return Response.json(
        { success: false, error: "User authentication required" },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    const body = await req.json()

    // Validate request body
    const validationResult = paymentSchema.safeParse(body)
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

    const invoiceService = new InvoiceService(userId)
    const result = await invoiceService.recordPayment(id, validationResult.data)

    if (!result.success || !result.data) {
      if (result.error?.includes("not found")) {
        return Response.json(
          { success: false, error: result.error },
          { status: HTTP_STATUS.NOT_FOUND }
        )
      }

      return Response.json(
        { success: false, error: result.error },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return Response.json({
      success: true,
      data: result.data,
      message: `Payment of ${validationResult.data.amount} recorded successfully`
    })
  })
)