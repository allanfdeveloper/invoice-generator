import { NextRequest } from "next/server"
import { withErrorHandler, withRateLimit } from "@/lib/error-handler"
import { QuoteService } from "@/lib/services/quote-service"
import { HTTP_STATUS } from "@/lib/types/api"
import { z } from "zod"

// Validation schema for updates
const updateQuoteSchema = z.object({
  clientId: z.string().uuid("Invalid client ID").optional(),
  status: z.enum(["draft", "sent", "accepted", "declined", "expired"]).optional(),
  items: z.array(z.object({
    id: z.string().uuid("Invalid item ID"),
    description: z.string().min(1, "Description is required"),
    unitPrice: z.number().min(0, "Unit price must be positive"),
    qty: z.number().min(1, "Quantity must be positive"),
    taxable: z.boolean().default(true),
    itemType: z.enum(["fixed", "hourly", "expense"]),
    unit: z.string().default("unit")
  })).optional(),
  validUntil: z.string().optional(),
  depositPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  termsText: z.string().optional()
})

// GET /api/quotes/[id] - Get specific quote
export const GET = withErrorHandler(
  withRateLimit(100, 60 * 1000)(async (
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

    const quoteService = new QuoteService(userId)
    const result = await quoteService.getById(id)

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
      data: result.data
    })
  })
)

// PUT /api/quotes/[id] - Update quote
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
    const validationResult = updateQuoteSchema.safeParse(body)
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
    const result = await quoteService.update(id, validationResult.data)

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
      message: "Quote updated successfully"
    })
  })
)

// DELETE /api/quotes/[id] - Delete quote
export const DELETE = withErrorHandler(
  withRateLimit(10, 60 * 1000)(async (
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

    const quoteService = new QuoteService(userId)
    const result = await quoteService.delete(id)

    if (!result.success) {
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
      data: { deleted: true },
      message: "Quote deleted successfully"
    })
  })
)