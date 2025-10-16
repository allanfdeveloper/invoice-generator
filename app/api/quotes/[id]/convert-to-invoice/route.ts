import { NextRequest } from "next/server"

export const runtime = 'nodejs'
import { withErrorHandler, withRateLimit } from "@/lib/error-handler"
import { QuoteService } from "@/lib/services/quote-service"
import { getSupabaseServer } from "@/lib/supabase-server"
import { HTTP_STATUS } from "@/lib/types/api"

// POST /api/quotes/[id]/convert-to-invoice - Convert quote to invoice
export const POST = withErrorHandler(
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

    // Use the quote service to convert to invoice
    const quoteService = new QuoteService(userId)
    const result = await quoteService.convertToInvoice(id)

    if (!result.success || !result.data) {
      return Response.json(
        { success: false, error: result.error },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    // Fetch the created invoice with related data
    const supabase = getSupabaseServer()
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        client:clients(*),
        company:companies(*),
        invoice_items(
          *,
          item:items(*)
        )
      `)
      .eq("id", result.data)
      .single()

    if (invoiceError) {
      console.error("Error fetching created invoice:", invoiceError)
      return Response.json(
        {
          success: true,
          message: "Quote converted to invoice successfully, but failed to fetch invoice details",
          invoiceId: result.data
        },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return Response.json({
      success: true,
      message: result.message,
      invoice
    })
  })
)