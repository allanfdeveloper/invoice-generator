import { BaseService, ServiceResponse } from "./base-service"
import { getSupabaseServer } from "@/lib/supabase-server"
import { CompanySettings, PaymentInstructions } from "@/lib/invoice-types"

export interface UpdateCompanySettingsRequest {
  companyName?: string
  address?: string
  email?: string
  phone?: string
  currency?: string
  vatPercentage?: number
  numberingFormatInvoice?: string
  numberingFormatQuote?: string
  termsText?: string
  logoUrl?: string | null
  paymentInstructions?: PaymentInstructions
}

export interface LogoUploadResponse {
  url: string
  filename: string
  size: number
  contentType: string
}

export class CompanySettingsService extends BaseService {
  getTableName(): string {
    return "company_settings"
  }

  async getSettings(): Promise<ServiceResponse<CompanySettings>> {
    try {
      const supabase = getSupabaseServer()

      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .single()

      if (error) {
        return this.createErrorResponse(this.handleSupabaseError(error))
      }

      if (!data) {
        return this.createErrorResponse("Company settings not found")
      }

      // Transform the data to match our expected structure
      const settings: CompanySettings = {
        id: data.id,
        companyName: data.company_name,
        address: data.address,
        email: data.email,
        phone: data.phone,
        logoUrl: data.logo_url,
        currency: data.currency,
        vatPercentage: data.vat_percentage,
        numberingFormatInvoice: data.numbering_format_invoice,
        numberingFormatQuote: data.numbering_format_quote,
        nextInvoiceNumber: data.next_invoice_number,
        nextQuoteNumber: data.next_quote_number,
        termsText: data.terms_text,
        paymentInstructions: data.payment_instructions as PaymentInstructions
      }

      return this.createSuccessResponse(settings)
    } catch (error) {
      console.error("Error fetching company settings:", error)
      return this.createErrorResponse("Failed to fetch company settings")
    }
  }

  async updateSettings(updateData: UpdateCompanySettingsRequest): Promise<ServiceResponse<CompanySettings>> {
    try {
      const supabase = getSupabaseServer()

      // Prepare update object with proper field mapping
      const updateFields: any = {}

      if (updateData.companyName !== undefined) {
        updateFields.company_name = updateData.companyName
      }
      if (updateData.address !== undefined) {
        updateFields.address = updateData.address
      }
      if (updateData.email !== undefined) {
        updateFields.email = updateData.email
      }
      if (updateData.phone !== undefined) {
        updateFields.phone = updateData.phone
      }
      if (updateData.currency !== undefined) {
        updateFields.currency = updateData.currency
      }
      if (updateData.vatPercentage !== undefined) {
        updateFields.vat_percentage = updateData.vatPercentage
      }
      if (updateData.numberingFormatInvoice !== undefined) {
        updateFields.numbering_format_invoice = updateData.numberingFormatInvoice
      }
      if (updateData.numberingFormatQuote !== undefined) {
        updateFields.numbering_format_quote = updateData.numberingFormatQuote
      }
      if (updateData.termsText !== undefined) {
        updateFields.terms_text = updateData.termsText
      }
      if (updateData.logoUrl !== undefined) {
        updateFields.logo_url = updateData.logoUrl
      }
      if (updateData.paymentInstructions !== undefined) {
        updateFields.payment_instructions = updateData.paymentInstructions
      }

      // Update the settings
      const { data, error } = await supabase
        .from("company_settings")
        .update(updateFields)
        .select()
        .single()

      if (error) {
        return this.createErrorResponse(this.handleSupabaseError(error))
      }

      if (!data) {
        return this.createErrorResponse("Failed to update company settings")
      }

      // Transform the response data
      const settings: CompanySettings = {
        id: data.id,
        companyName: data.company_name,
        address: data.address,
        email: data.email,
        phone: data.phone,
        logoUrl: data.logo_url,
        currency: data.currency,
        vatPercentage: data.vat_percentage,
        numberingFormatInvoice: data.numbering_format_invoice,
        numberingFormatQuote: data.numbering_format_quote,
        nextInvoiceNumber: data.next_invoice_number,
        nextQuoteNumber: data.next_quote_number,
        termsText: data.terms_text,
        paymentInstructions: data.payment_instructions as PaymentInstructions
      }

      return this.createSuccessResponse(settings, "Company settings updated successfully")
    } catch (error) {
      console.error("Error updating company settings:", error)
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to update company settings"
      )
    }
  }

  async uploadLogo(file: File): Promise<ServiceResponse<LogoUploadResponse>> {
    try {
      // Validate file
      if (!file) {
        return this.createErrorResponse("No file provided")
      }

      // Check file type (allow common image formats)
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/svg+xml"]
      if (!allowedTypes.includes(file.type)) {
        return this.createErrorResponse("Invalid file type. Only JPEG, PNG, WebP, and SVG files are allowed")
      }

      // Check file size (limit to 5MB)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        return this.createErrorResponse("File size must be less than 5MB")
      }

      // For now, we'll use Supabase Storage
      const supabase = getSupabaseServer()
      const fileName = `logo-${Date.now()}-${file.name}`
      const filePath = `logos/${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("logos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false
        })

      if (error) {
        return this.createErrorResponse(this.handleSupabaseError(error))
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(filePath)

      // Update company settings with new logo URL
      await this.updateSettings({ logoUrl: urlData.publicUrl })

      const uploadResponse: LogoUploadResponse = {
        url: urlData.publicUrl,
        filename: fileName,
        size: file.size,
        contentType: file.type
      }

      return this.createSuccessResponse(uploadResponse, "Logo uploaded successfully")
    } catch (error) {
      console.error("Error uploading logo:", error)
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to upload logo"
      )
    }
  }

  async deleteLogo(): Promise<ServiceResponse<boolean>> {
    try {
      const supabase = getSupabaseServer()

      // Get current settings to find logo URL
      const currentSettings = await this.getSettings()
      if (!currentSettings.success || !currentSettings.data?.logoUrl) {
        return this.createSuccessResponse(true) // No logo to delete
      }

      // Extract file path from URL
      const logoUrl = currentSettings.data.logoUrl
      const fileName = logoUrl.split('/').pop()

      if (fileName) {
        // Delete from Supabase Storage
        const { error } = await supabase.storage
          .from("logos")
          .remove([`logos/${fileName}`])

        if (error && error.message !== "Object not found") {
          console.error("Error deleting logo from storage:", error)
          // Don't fail the operation if storage deletion fails
        }
      }

      // Update company settings to remove logo URL
      await this.updateSettings({ logoUrl: null })

      return this.createSuccessResponse(true, "Logo deleted successfully")
    } catch (error) {
      console.error("Error deleting logo:", error)
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to delete logo"
      )
    }
  }

  async getNextNumber(type: "invoice" | "quote"): Promise<ServiceResponse<number>> {
    try {
      const supabase = getSupabaseServer()

      const field = type === "invoice" ? "next_invoice_number" : "next_quote_number"

      const { data, error } = await supabase
        .from("company_settings")
        .select(field)
        .single()

      if (error) {
        return this.createErrorResponse(this.handleSupabaseError(error))
      }

      if (!data) {
        // Create default settings if they don't exist
        const defaultSettings = {
          company_name: "Default Company",
          address: "",
          email: "",
          phone: "",
          currency: "USD",
          vat_percentage: 15,
          numbering_format_invoice: "INV-{year}-{number:04d}",
          numbering_format_quote: "QUOTE-{year}-{number:04d}",
          next_invoice_number: 1,
          next_quote_number: 1,
          terms_text: "Please pay within 30 days of receipt."
        }

        const { data: newSettings, error: createError } = await supabase
          .from("company_settings")
          .insert(defaultSettings)
          .select(field)
          .single()

        if (createError) {
          return this.createErrorResponse(this.handleSupabaseError(createError))
        }

        return this.createSuccessResponse(newSettings[field] || 1)
      }

      return this.createSuccessResponse(data[field] || 1)
    } catch (error) {
      console.error("Error getting next number:", error)
      return this.createErrorResponse("Failed to get next number")
    }
  }

  async incrementNumber(type: "invoice" | "quote"): Promise<ServiceResponse<number>> {
    try {
      const supabase = getSupabaseServer()

      const field = type === "invoice" ? "next_invoice_number" : "next_quote_number"

      // Get current number
      const { data: currentData } = await supabase
        .from("company_settings")
        .select(field)
        .single()

      const currentNumber = currentData?.[field] || 1
      const nextNumber = currentNumber + 1

      // Update the next number
      const { data, error } = await supabase
        .from("company_settings")
        .update({ [field]: nextNumber })
        .select(field)
        .single()

      if (error) {
        return this.createErrorResponse(this.handleSupabaseError(error))
      }

      return this.createSuccessResponse(data[field] || nextNumber)
    } catch (error) {
      console.error("Error incrementing number:", error)
      return this.createErrorResponse("Failed to increment number")
    }
  }

  async getPaymentInstructions(): Promise<ServiceResponse<PaymentInstructions>> {
    try {
      const settings = await this.getSettings()

      if (!settings.success || !settings.data) {
        return this.createErrorResponse("Payment instructions not found")
      }

      return this.createSuccessResponse(settings.data.paymentInstructions)
    } catch (error) {
      console.error("Error getting payment instructions:", error)
      return this.createErrorResponse("Failed to get payment instructions")
    }
  }

  async updatePaymentInstructions(instructions: PaymentInstructions): Promise<ServiceResponse<PaymentInstructions>> {
    try {
      const result = await this.updateSettings({ paymentInstructions: instructions })

      if (!result.success || !result.data) {
        return this.createErrorResponse(result.error || "Failed to update payment instructions")
      }

      return this.createSuccessResponse(result.data.paymentInstructions, "Payment instructions updated successfully")
    } catch (error) {
      console.error("Error updating payment instructions:", error)
      return this.createErrorResponse("Failed to update payment instructions")
    }
  }
}