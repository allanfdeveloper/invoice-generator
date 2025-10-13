import { NextRequest } from "next/server"
import { withErrorHandler, withRateLimit } from "@/lib/error-handler"
import { QuoteService } from "@/lib/services/quote-service"
import { HTTP_STATUS } from "@/lib/types/api"
import { z } from "zod"

// Validation schema for status update
const updateStatusSchema = z.object({
  status: z.enum(["draft", "sent", "accepted", "declined", "expired"], {
    errorMap: () => ({ message: "Invalid status value" })
  })
})

// PUT /api/quotes/[id]/status - Update quote status
export const PUT = withErrorHandler(
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
    const validationResult = updateStatusSchema.safeParse(body)
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

    const quoteService = new QuoteService(userId)
    const result = await quoteService.updateStatus(id, validationResult.data.status)

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
      message: `Quote status updated to ${validationResult.data.status}`
    })
  })
)