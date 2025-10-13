import { BaseService, ServiceResponse, PaginatedResponse } from "./base-service"
import { getSupabaseServer, createTransaction } from "@/lib/supabase-server"
import { Invoice, InvoiceStatus, Item, PaymentInstructions } from "@/lib/invoice-types"

export interface CreateInvoiceRequest {
  clientId: string
  items: Omit<Item, "id" | "createdAt">[]
  dueDate?: string
  depositRequired?: boolean
  depositPercentage?: number
  notes?: string
  termsText?: string
  createdFromQuoteId?: string
}

export interface UpdateInvoiceRequest {
  clientId?: string
  status?: InvoiceStatus
  items?: Omit<Item, "id" | "createdAt">[]
  dueDate?: string
  depositRequired?: boolean
  depositPercentage?: number
  notes?: string
  termsText?: string
}

export interface InvoiceWithRelations extends Invoice {
  client: {
    id: string
    name: string
    email: string
  }
  items: Item[]
  company?: {
    id: string
    name: string
    email: string
    phone: string
    address: string
    logoUrl: string | null
  }
}

export interface PaymentUpdateRequest {
  amount: number
  paymentDate?: string
  notes?: string
}

export class InvoiceService extends BaseService {
  getTableName(): string {
    return "invoices"
  }

  async getById(id: string): Promise<ServiceResponse<InvoiceWithRelations>> {
    try {
      if (!this.isValidUUID(id)) {
        return this.createErrorResponse("Invalid invoice ID format")
      }

      const supabase = getSupabaseServer()

      // Get invoice with related client, company, and items
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          client:clients(id, name, email, phone),
          company:companies(id, name, email, phone, address, logo_url),
          invoice_items(
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
        return this.createErrorResponse("Invoice not found")
      }

      // Transform the data to match our expected structure
      const invoice: InvoiceWithRelations = {
        ...data,
        items: data.invoice_items?.map((ii: any) => ({
          ...ii.item,
          id: ii.item.id,
          qty: ii.quantity,
          unitPrice: ii.unit_price,
          taxable: ii.item.taxable,
          itemType: ii.item.item_type,
          unit: ii.item.unit,
          createdAt: data.created_at
        })) || [],
        company: data.company ? {
          id: data.company.id,
          name: data.company.name,
          email: data.company.email,
          phone: data.company.phone,
          address: data.company.address,
          logoUrl: data.company.logo_url
        } : undefined,
        paymentInstructions: data.payment_instructions as PaymentInstructions
      }

      return this.createSuccessResponse(invoice)
    } catch (error) {
      console.error("Error fetching invoice:", error)
      return this.createErrorResponse("Failed to fetch invoice")
    }
  }

  async create(invoiceData: CreateInvoiceRequest): Promise<ServiceResponse<InvoiceWithRelations>> {
    try {
      const supabase = getSupabaseServer()
      const transaction = createTransaction(supabase)

      const result = await transaction.execute(async (client) => {
        // Generate invoice number
        const invoiceNumber = await this.generateInvoiceNumber(client)

        // Calculate financial totals
        const { subtotal, vatAmount, totalAmount } = this.calculateTotals(invoiceData.items)

        // Calculate deposit amount if required
        const depositRequired = invoiceData.depositRequired || false
        const depositPercentage = invoiceData.depositPercentage || 0
        const depositAmount = depositRequired ? (totalAmount * depositPercentage) / 100 : 0

        // Create the invoice
        const { data: invoice, error: invoiceError } = await client
          .from("invoices")
          .insert({
            invoice_number: invoiceNumber,
            client_id: invoiceData.clientId,
            created_by_user_id: this.userId,
            date_issued: new Date().toISOString(),
            due_date: invoiceData.dueDate || this.getDefaultDueDate(),
            status: InvoiceStatus.Draft,
            subtotal_excl_vat: subtotal,
            vat_amount: vatAmount,
            total_incl_vat: totalAmount,
            deposit_required: depositRequired,
            deposit_amount: depositAmount,
            balance_remaining: totalAmount - depositAmount,
            notes: invoiceData.notes || "",
            terms_text: invoiceData.termsText || "",
            created_from_quote_id: invoiceData.createdFromQuoteId || null
          })
          .select()
          .single()

        if (invoiceError) {
          throw new Error(this.handleSupabaseError(invoiceError))
        }

        // Create invoice items
        if (invoiceData.items.length > 0) {
          const itemsToInsert = invoiceData.items.map(item => ({
            invoice_id: invoice.id,
            item_id: item.id,
            quantity: item.qty,
            unit_price: item.unitPrice,
            total_price: item.unitPrice * item.qty
          }))

          const { error: itemsError } = await client
            .from("invoice_items")
            .insert(itemsToInsert)

          if (itemsError) {
            throw new Error(this.handleSupabaseError(itemsError))
          }
        }

        // Update quote status if created from quote
        if (invoiceData.createdFromQuoteId) {
          await client
            .from("quotes")
            .update({ status: "converted" })
            .eq("id", invoiceData.createdFromQuoteId)
        }

        return invoice.id
      })

      // Fetch the complete invoice with relations
      return await this.getById(result)
    } catch (error) {
      console.error("Error creating invoice:", error)
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to create invoice"
      )
    }
  }

  async update(id: string, updateData: UpdateInvoiceRequest): Promise<ServiceResponse<InvoiceWithRelations>> {
    try {
      if (!this.isValidUUID(id)) {
        return this.createErrorResponse("Invalid invoice ID format")
      }

      const supabase = getSupabaseServer()
      const transaction = createTransaction(supabase)

      await transaction.execute(async (client) => {
        // Check if invoice can be updated (not paid or overdue)
        const { data: currentInvoice } = await client
          .from("invoices")
          .select("status")
          .eq("id", id)
          .single()

        if (currentInvoice?.status === InvoiceStatus.Paid) {
          throw new Error("Cannot update a paid invoice")
        }

        // Prepare update object
        const updateFields: any = {}

        if (updateData.clientId) updateFields.client_id = updateData.clientId
        if (updateData.status) updateFields.status = updateData.status
        if (updateData.dueDate) updateFields.due_date = updateData.dueDate
        if (updateData.depositRequired !== undefined) {
          updateFields.deposit_required = updateData.depositRequired
        }
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

          // Recalculate deposit and balance
          const depositAmount = updateData.depositRequired
            ? (totalAmount * (updateData.depositPercentage || 0)) / 100
            : 0
          updateFields.deposit_amount = depositAmount
          updateFields.balance_remaining = totalAmount - depositAmount
        }

        // Update the invoice
        const { error: updateError } = await client
          .from("invoices")
          .update(updateFields)
          .eq("id", id)

        if (updateError) {
          throw new Error(this.handleSupabaseError(updateError))
        }

        // Update items if provided
        if (updateData.items) {
          // Delete existing items
          await client.from("invoice_items").delete().eq("invoice_id", id)

          // Insert new items
          if (updateData.items.length > 0) {
            const itemsToInsert = updateData.items.map(item => ({
              invoice_id: id,
              item_id: item.id,
              quantity: item.qty,
              unit_price: item.unitPrice,
              total_price: item.unitPrice * item.qty
            }))

            const { error: itemsError } = await client
              .from("invoice_items")
              .insert(itemsToInsert)

            if (itemsError) {
              throw new Error(this.handleSupabaseError(itemsError))
            }
          }
        }

        return true
      })

      // Fetch the updated invoice with relations
      return await this.getById(id)
    } catch (error) {
      console.error("Error updating invoice:", error)
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to update invoice"
      )
    }
  }

  async delete(id: string): Promise<ServiceResponse<boolean>> {
    try {
      if (!this.isValidUUID(id)) {
        return this.createErrorResponse("Invalid invoice ID format")
      }

      const supabase = getSupabaseServer()

      // Check if invoice exists and can be deleted
      const { data: invoice, error: fetchError } = await supabase
        .from("invoices")
        .select("status")
        .eq("id", id)
        .single()

      if (fetchError) {
        return this.createErrorResponse(this.handleSupabaseError(fetchError))
      }

      if (!invoice) {
        return this.createErrorResponse("Invoice not found")
      }

      // Don't allow deletion of paid invoices
      if (invoice.status === InvoiceStatus.Paid) {
        return this.createErrorResponse("Cannot delete a paid invoice")
      }

      // Delete invoice (cascade will handle invoice_items)
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", id)

      if (error) {
        return this.createErrorResponse(this.handleSupabaseError(error))
      }

      return this.createSuccessResponse(true)
    } catch (error) {
      console.error("Error deleting invoice:", error)
      return this.createErrorResponse("Failed to delete invoice")
    }
  }

  async list(
    options: {
      page: number
      limit: number
      filters?: {
        status?: InvoiceStatus
        clientId?: string
        search?: string
        dateFrom?: string
        dateTo?: string
        overdue?: boolean
      }
    }
  ): Promise<PaginatedResponse<InvoiceWithRelations>> {
    try {
      const supabase = getSupabaseServer()
      const { page, limit } = options
      const filters = options.filters || {}

      let query = supabase
        .from("invoices")
        .select(`
          id,
          invoice_number,
          status,
          date_issued,
          due_date,
          total_incl_vat,
          balance_remaining,
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

      if (filters.overdue) {
        query = query
          .eq("status", InvoiceStatus.Sent)
          .lt("due_date", new Date().toISOString())
      }

      return await this.executeWithPagination(query, page, limit)
    } catch (error) {
      console.error("Error listing invoices:", error)
      return this.createErrorResponse("Failed to fetch invoices")
    }
  }

  async updateStatus(invoiceId: string, status: InvoiceStatus): Promise<ServiceResponse<InvoiceWithRelations>> {
    try {
      if (!this.isValidUUID(invoiceId)) {
        return this.createErrorResponse("Invalid invoice ID format")
      }

      const supabase = getSupabaseServer()

      const updateFields: any = { status, updated_at: new Date().toISOString() }

      // If marking as sent, update the issue date
      if (status === InvoiceStatus.Sent) {
        updateFields.date_issued = new Date().toISOString()
      }

      const { error } = await supabase
        .from("invoices")
        .update(updateFields)
        .eq("id", invoiceId)

      if (error) {
        return this.createErrorResponse(this.handleSupabaseError(error))
      }

      return await this.getById(invoiceId)
    } catch (error) {
      console.error("Error updating invoice status:", error)
      return this.createErrorResponse("Failed to update invoice status")
    }
  }

  async recordPayment(
    invoiceId: string,
    paymentData: PaymentUpdateRequest
  ): Promise<ServiceResponse<InvoiceWithRelations>> {
    try {
      if (!this.isValidUUID(invoiceId)) {
        return this.createErrorResponse("Invalid invoice ID format")
      }

      const supabase = getSupabaseServer()
      const transaction = createTransaction(supabase)

      await transaction.execute(async (client) => {
        // Get current invoice
        const { data: invoice, error: fetchError } = await client
          .from("invoices")
          .select("balance_remaining, total_incl_vat, deposit_amount")
          .eq("id", invoiceId)
          .single()

        if (fetchError || !invoice) {
          throw new Error("Invoice not found")
        }

        // Validate payment amount
        if (paymentData.amount > invoice.balance_remaining) {
          throw new Error("Payment amount exceeds remaining balance")
        }

        // Calculate new balance
        const newBalance = invoice.balance_remaining - paymentData.amount

        // Update invoice
        const newStatus = newBalance <= 0 ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid

        const { error: updateError } = await client
          .from("invoices")
          .update({
            balance_remaining: newBalance,
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", invoiceId)

        if (updateError) {
          throw new Error(this.handleSupabaseError(updateError))
        }

        // Create payment record (if you have a payments table)
        // This would be added in a future implementation

        return true
      })

      return await this.getById(invoiceId)
    } catch (error) {
      console.error("Error recording payment:", error)
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to record payment"
      )
    }
  }

  // Helper methods
  private async generateInvoiceNumber(supabase: any): Promise<string> {
    const { data } = await supabase
      .from("company_settings")
      .select("next_invoice_number, numbering_format_invoice")
      .single()

    const nextNumber = data?.next_invoice_number || 1
    const format = data?.numbering_format_invoice || "INV-{year}-{number:04d}"

    // Update next number
    await supabase
      .from("company_settings")
      .update({ next_invoice_number: nextNumber + 1 })

    // Generate invoice number
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

  private getDefaultDueDate(): string {
    const date = new Date()
    date.setDate(date.getDate() + 30) // Default 30 days
    return date.toISOString()
  }

  // Override applyFilters for invoices-specific filtering
  protected applyFilters(query: any, filters: any): any {
    query = super.applyFilters(query, filters)

    if (filters.search) {
      query = query.or(`
        invoice_number.ilike.%${filters.search}%,
        client.name.ilike.%${filters.search}%
      `)
    }

    return query
  }
}