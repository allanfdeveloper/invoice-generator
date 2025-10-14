import { BaseService, ServiceResponse, PaginatedResponse } from "./base-service"
import { getSupabaseServer, createTransaction } from "@/lib/supabase-server"
import { Quote, QuoteStatus, Item } from "@/lib/invoice-types"

export interface CreateQuoteRequest {
  clientId: string
  items: Omit<Item, "id" | "createdAt">[]
  validUntil?: string
  depositPercentage?: number
  notes?: string
  termsText?: string
}

export interface UpdateQuoteRequest {
  clientId?: string
  status?: QuoteStatus
  items?: Omit<Item, "id" | "createdAt">[]
  validUntil?: string
  depositPercentage?: number
  notes?: string
  termsText?: string
}

export interface QuoteWithRelations extends Quote {
  client: {
    id: string
    name: string
    email: string
  }
  items: Item[]
}

export class QuoteService extends BaseService {
  getTableName(): string {
    return "quotes"
  }

  async getById(id: string): Promise<ServiceResponse<QuoteWithRelations>> {
    try {
      if (!this.isValidUUID(id)) {
        return this.createErrorResponse("Invalid quote ID format")
      }

      const supabase = getSupabaseServer()

      // Get quote with related client and items
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          client:clients(id, name, email, phone),
          quote_items(
            id,
            quantity,
            unit_price,
            total_price,
            item:items(id, description, unit, taxable, item_type)
          )
        `)
        .eq("id", id)
        .single()

      if (error) {
        return this.createErrorResponse(this.handleSupabaseError(error))
      }

      if (!data) {
        return this.createErrorResponse("Quote not found")
      }

      // Transform the data to match our expected structure
      const quote: QuoteWithRelations = {
        ...data,
        items: data.quote_items?.map((qi: any) => ({
          ...qi.item,
          id: qi.item.id,
          qty: qi.quantity,
          unitPrice: qi.unit_price,
          taxable: qi.item.taxable,
          itemType: qi.item.item_type,
          unit: qi.item.unit,
          createdAt: data.created_at
        })) || []
      }

      return this.createSuccessResponse(quote)
    } catch (error) {
      console.error("Error fetching quote:", error)
      return this.createErrorResponse("Failed to fetch quote")
    }
  }

  async create(quoteData: CreateQuoteRequest): Promise<ServiceResponse<QuoteWithRelations>> {
    try {
      const supabase = getSupabaseServer()
      const transaction = createTransaction(supabase)

      const result = await transaction.execute(async (client) => {
        // Generate quote number
        const quoteNumber = await this.generateQuoteNumber(client)

        // Calculate financial totals
        const { subtotal, vatAmount, totalAmount } = this.calculateTotals(quoteData.items)

        // Create the quote
        const { data: quote, error: quoteError } = await client
          .from("quotes")
          .insert({
            quote_number: quoteNumber,
            client_id: quoteData.clientId,
            created_by_user_id: this.userId,
            date_issued: new Date().toISOString(),
            valid_until: quoteData.validUntil || this.getDefaultValidUntil(),
            status: QuoteStatus.Draft,
            subtotal_excl_vat: subtotal,
            vat_amount: vatAmount,
            total_incl_vat: totalAmount,
            deposit_percentage: quoteData.depositPercentage || 0,
            deposit_amount: (totalAmount * (quoteData.depositPercentage || 0)) / 100,
            balance_remaining: totalAmount,
            notes: quoteData.notes || "",
            terms_text: quoteData.termsText || ""
          })
          .select()
          .single()

        if (quoteError) {
          throw new Error(this.handleSupabaseError(quoteError))
        }

        // Create quote items
        if (quoteData.items.length > 0) {
          const itemsToInsert = quoteData.items.map(item => ({
            quote_id: quote.id,
            item_id: item.id,
            quantity: item.qty,
            unit_price: item.unitPrice,
            total_price: item.unitPrice * item.qty
          }))

          const { error: itemsError } = await client
            .from("quote_items")
            .insert(itemsToInsert)

          if (itemsError) {
            throw new Error(this.handleSupabaseError(itemsError))
          }
        }

        return quote.id
      })

      // Fetch the complete quote with relations
      return await this.getById(result)
    } catch (error) {
      console.error("Error creating quote:", error)
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to create quote"
      )
    }
  }

  async update(id: string, updateData: UpdateQuoteRequest): Promise<ServiceResponse<QuoteWithRelations>> {
    try {
      if (!this.isValidUUID(id)) {
        return this.createErrorResponse("Invalid quote ID format")
      }

      const supabase = getSupabaseServer()
      const transaction = createTransaction(supabase)

      await transaction.execute(async (client) => {
        // Prepare update object
        const updateFields: any = {}

        if (updateData.clientId) updateFields.client_id = updateData.clientId
        if (updateData.status) updateFields.status = updateData.status
        if (updateData.validUntil) updateFields.valid_until = updateData.validUntil
        if (updateData.depositPercentage !== undefined) {
          updateFields.deposit_percentage = updateData.depositPercentage
        }
        if (updateData.notes !== undefined) updateFields.notes = updateData.notes
        if (updateData.termsText !== undefined) updateFields.terms_text = updateData.termsText

        // Update financial totals if items changed
        if (updateData.items) {
          const { subtotal, vatAmount, totalAmount } = this.calculateTotals(updateData.items)
          updateFields.subtotal_excl_vat = subtotal
          updateFields.vat_amount = vatAmount
          updateFields.total_incl_vat = totalAmount
          updateFields.balance_remaining = totalAmount
        }

        // Update the quote
        const { error: updateError } = await client
          .from("quotes")
          .update(updateFields)
          .eq("id", id)

        if (updateError) {
          throw new Error(this.handleSupabaseError(updateError))
        }

        // Update items if provided
        if (updateData.items) {
          // Delete existing items
          await client.from("quote_items").delete().eq("quote_id", id)

          // Insert new items
          if (updateData.items.length > 0) {
            const itemsToInsert = updateData.items.map(item => ({
              quote_id: id,
              item_id: item.id,
              quantity: item.qty,
              unit_price: item.unitPrice,
              total_price: item.unitPrice * item.qty
            }))

            const { error: itemsError } = await client
              .from("quote_items")
              .insert(itemsToInsert)

            if (itemsError) {
              throw new Error(this.handleSupabaseError(itemsError))
            }
          }
        }

        return true
      })

      // Fetch the updated quote with relations
      return await this.getById(id)
    } catch (error) {
      console.error("Error updating quote:", error)
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to update quote"
      )
    }
  }

  async delete(id: string): Promise<ServiceResponse<boolean>> {
    try {
      if (!this.isValidUUID(id)) {
        return this.createErrorResponse("Invalid quote ID format")
      }

      const supabase = getSupabaseServer()

      // Check if quote exists and can be deleted
      const { data: quote, error: fetchError } = await supabase
        .from("quotes")
        .select("status")
        .eq("id", id)
        .single()

      if (fetchError) {
        return this.createErrorResponse(this.handleSupabaseError(fetchError))
      }

      if (!quote) {
        return this.createErrorResponse("Quote not found")
      }

      // Don't allow deletion of accepted or converted quotes
      if (quote.status === QuoteStatus.Accepted || quote.status === "converted") {
        return this.createErrorResponse("Cannot delete an accepted or converted quote")
      }

      // Delete quote (cascade will handle quote_items)
      const { error } = await supabase
        .from("quotes")
        .delete()
        .eq("id", id)

      if (error) {
        return this.createErrorResponse(this.handleSupabaseError(error))
      }

      return this.createSuccessResponse(true)
    } catch (error) {
      console.error("Error deleting quote:", error)
      return this.createErrorResponse("Failed to delete quote")
    }
  }

  async list(
    options: {
      page: number
      limit: number
      filters?: {
        status?: QuoteStatus
        clientId?: string
        search?: string
        dateFrom?: string
        dateTo?: string
      }
    }
  ): Promise<PaginatedResponse<QuoteWithRelations>> {
    try {
      const supabase = getSupabaseServer()
      const { page, limit } = options
      const filters = options.filters || {}

      let query = supabase
        .from("quotes")
        .select(`
          id,
          quote_number,
          status,
          date_issued,
          valid_until,
          total_incl_vat,
          client:clients(id, name, email),
          created_at
        `, { count: "exact" })

      // Apply filters
      query = this.applyFilters(query, filters)

      if (filters.status) {
        query = query.eq("status", filters.status)
      }

      if (filters.clientId) {
        query = query.eq("client_id", filters.clientId)
      }

      return await this.executeWithPagination(query, page, limit)
    } catch (error) {
      console.error("Error listing quotes:", error)
      return this.createErrorResponse("Failed to fetch quotes")
    }
  }

  async convertToInvoice(quoteId: string): Promise<ServiceResponse<string>> {
    try {
      if (!this.isValidUUID(quoteId)) {
        return this.createErrorResponse("Invalid quote ID format")
      }

      const supabase = getSupabaseServer()

      // Call the database function to convert quote to invoice
      const { data, error } = await supabase.rpc("convert_quote_to_invoice", {
        p_quote_id: quoteId
      })

      if (error) {
        return this.createErrorResponse(this.handleSupabaseError(error))
      }

      if (!data || !data[0]?.success) {
        return this.createErrorResponse(data?.[0]?.message || "Failed to convert quote to invoice")
      }

      return this.createSuccessResponse(data[0].invoice_id, "Quote converted to invoice successfully")
    } catch (error) {
      console.error("Error converting quote to invoice:", error)
      return this.createErrorResponse("Failed to convert quote to invoice")
    }
  }

  async updateStatus(quoteId: string, status: QuoteStatus): Promise<ServiceResponse<QuoteWithRelations>> {
    try {
      if (!this.isValidUUID(quoteId)) {
        return this.createErrorResponse("Invalid quote ID format")
      }

      const supabase = getSupabaseServer()

      const { error } = await supabase
        .from("quotes")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", quoteId)

      if (error) {
        return this.createErrorResponse(this.handleSupabaseError(error))
      }

      return await this.getById(quoteId)
    } catch (error) {
      console.error("Error updating quote status:", error)
      return this.createErrorResponse("Failed to update quote status")
    }
  }

  // Helper methods
  private async generateQuoteNumber(supabase: any): Promise<string> {
    const { data } = await supabase
      .from("company_settings")
      .select("next_quote_number, numbering_format_quote")
      .single()

    const nextNumber = data?.next_quote_number || 1
    const format = data?.numbering_format_quote || "QUOTE-{year}-{number:04d}"

    // Update next number
    await supabase
      .from("company_settings")
      .update({ next_quote_number: nextNumber + 1 })

    // Generate quote number
    const year = new Date().getFullYear()
    return format
      .replace("{year}", year.toString())
      .replace("{number:04d}", nextNumber.toString().padStart(4, "0"))
  }

  private calculateTotals(items: Omit<Item, "id" | "createdAt">[]): {
    subtotal: number
    vatAmount: number
    total: number
  } {
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0)
    const vatAmount = items.reduce(
      (sum, item) => sum + (item.taxable ? item.unitPrice * item.qty * 0.15 : 0),
      0
    )
    const total = subtotal + vatAmount

    return { subtotal, vatAmount, total }
  }

  private getDefaultValidUntil(): string {
    const date = new Date()
    date.setDate(date.getDate() + 30) // Default 30 days
    return date.toISOString()
  }

  // Override applyFilters for quotes-specific filtering
  protected applyFilters(query: any, filters: any): any {
    query = super.applyFilters(query, filters)

    if (filters.search) {
      query = query.or(`
        quote_number.ilike.%${filters.search}%,
        client.name.ilike.%${filters.search}%
      `)
    }

    return query
  }
}