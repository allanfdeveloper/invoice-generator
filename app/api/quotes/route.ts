import { NextRequest } from "next/server"

export const runtime = 'nodejs'
import { withErrorHandler, withRateLimit } from "@/lib/error-handler"
import { QuoteService } from "@/lib/services/quote-service"
import { parsePaginationParams, parseFilters } from "@/lib/types/api"
import { HTTP_STATUS } from "@/lib/types/api"
import { z } from "zod"

// Validation schemas
const createQuoteSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  items: z.array(z.object({
    id: z.string().uuid("Invalid item ID"),
    description: z.string().min(1, "Description is required"),
    unitPrice: z.number().min(0, "Unit price must be positive"),
    qty: z.number().min(1, "Quantity must be positive"),
    taxable: z.boolean().default(true),
    itemType: z.enum(["fixed", "hourly", "expense"]),
    unit: z.string().default("unit")
  })).min(1, "At least one item is required"),
  validUntil: z.string().optional(),
  depositPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  termsText: z.string().optional()
})

const updateQuoteSchema = createQuoteSchema.partial()

// GET /api/quotes - List quotes with pagination and filtering
export const GET = withErrorHandler(
  withRateLimit(100, 60 * 1000)(async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const { page, limit } = parsePaginationParams(Object.fromEntries(searchParams))
    const filters = parseFilters(Object.fromEntries(searchParams))

    // Get user ID from request headers (set by middleware)
    const userId = req.headers.get("x-user-id")
    if (!userId) {
      return Response.json(
        { success: false, error: "User authentication required" },
        { status: HTTP_STATUS.UNAUTHORIZED }
      )
    }

    const quoteService = new QuoteService(userId)
    const result = await quoteService.list({ page, limit, filters })

    if (!result.success || !result.data) {
      return Response.json(
        { success: false, error: result.error },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return Response.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    })
  })
)

// POST /api/quotes - Create new quote
export const POST = withErrorHandler(
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
    const validationResult = createQuoteSchema.safeParse(body)
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
    const result = await quoteService.create(validationResult.data)

    if (!result.success || !result.data) {
      return Response.json(
        { success: false, error: result.error },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return Response.json({
      success: true,
      data: result.data,
      message: "Quote created successfully"
    }, { status: HTTP_STATUS.CREATED })
  })
)