import { BaseService, ServiceResponse } from "./base-service"
import { getSupabaseServer } from "@/lib/supabase-server"

export interface EmailNotificationData {
  to: string
  subject: string
  htmlBody: string
  textBody?: string
  fromName?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType: string
  }>
}

export interface QuoteEmailData {
  clientName: string
  clientEmail: string
  quoteNumber: string
  quoteTotal: number
  validUntil: string
  companyName: string
  companyEmail: string
  companyPhone: string
  quoteUrl?: string
}

export interface InvoiceEmailData {
  clientName: string
  clientEmail: string
  invoiceNumber: string
  invoiceTotal: number
  dueDate: string
  companyName: string
  companyEmail: string
  companyPhone: string
  invoiceUrl?: string
}

export class EmailService extends BaseService {
  getTableName(): string {
    return "email_notifications"
  }

  async sendQuoteEmail(data: QuoteEmailData): Promise<ServiceResponse<boolean>> {
    try {
      const { companyName, companyEmail, companyPhone } = data

      const subject = `Quote ${data.quoteNumber} from ${companyName}`

      const htmlBody = this.generateQuoteEmailHtml(data)
      const textBody = this.generateQuoteEmailText(data)

      const emailData: EmailNotificationData = {
        to: data.clientEmail,
        subject,
        htmlBody,
        textBody,
        fromName: companyName
      }

      const result = await this.sendEmail(emailData)
      return result
    } catch (error) {
      console.error("Error sending quote email:", error)
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to send quote email"
      )
    }
  }

  async sendInvoiceEmail(data: InvoiceEmailData): Promise<ServiceResponse<boolean>> {
    try {
      const { companyName, companyEmail, companyPhone } = data

      const subject = `Invoice ${data.invoiceNumber} from ${companyName}`

      const htmlBody = this.generateInvoiceEmailHtml(data)
      const textBody = this.generateInvoiceEmailText(data)

      const emailData: EmailNotificationData = {
        to: data.clientEmail,
        subject,
        htmlBody,
        textBody,
        fromName: companyName
      }

      const result = await this.sendEmail(emailData)
      return result
    } catch (error) {
      console.error("Error sending invoice email:", error)
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to send invoice email"
      )
    }
  }

  async sendPaymentReminder(invoiceId: string): Promise<ServiceResponse<boolean>> {
    try {
      const supabase = getSupabaseServer()

      // Get invoice details with client information
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select(`
          *,
          clients:client_id (
            name,
            email,
            company
          )
        `)
        .eq("id", invoiceId)
        .single()

      if (invoiceError || !invoice) {
        return this.createErrorResponse("Invoice not found")
      }

      // Get company settings
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("*")
        .eq("created_by_user_id", this.userId)
        .single()

      const emailData: InvoiceEmailData = {
        clientName: invoice.clients.name,
        clientEmail: invoice.clients.email,
        invoiceNumber: invoice.invoice_number,
        invoiceTotal: invoice.total_incl_vat,
        dueDate: invoice.due_date,
        companyName: companySettings?.company_name || "Your Company",
        companyEmail: companySettings?.email || "",
        companyPhone: companySettings?.phone || ""
      }

      return await this.sendInvoiceEmail(emailData)
    } catch (error) {
      console.error("Error sending payment reminder:", error)
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to send payment reminder"
      )
    }
  }

  private async sendEmail(data: EmailNotificationData): Promise<ServiceResponse<boolean>> {
    try {
      // For now, we'll use Resend or similar email service
      // This is a placeholder implementation

      // Log the email for development/testing
      console.log("Email would be sent:", {
        to: data.to,
        subject: data.subject,
        fromName: data.fromName,
        timestamp: new Date().toISOString()
      })

      // TODO: Integrate with actual email service like Resend, SendGrid, etc.
      // const resend = new Resend(process.env.RESEND_API_KEY)
      // await resend.emails.send({
      //   from: `${data.fromName} <noreply@yourcompany.com>`,
      //   to: [data.to],
      //   subject: data.subject,
      //   html: data.htmlBody,
      //   text: data.textBody,
      //   attachments: data.attachments
      // })

      return this.createSuccessResponse(true, "Email sent successfully")
    } catch (error) {
      console.error("Error sending email:", error)
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to send email"
      )
    }
  }

  private generateQuoteEmailHtml(data: QuoteEmailData): string {
    const {
      clientName,
      quoteNumber,
      quoteTotal,
      validUntil,
      companyName,
      companyEmail,
      companyPhone,
      quoteUrl
    } = data

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quote ${quoteNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #007bff; }
          .content { margin-bottom: 30px; }
          .quote-details { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .total { font-size: 24px; font-weight: bold; color: #007bff; text-align: right; }
          .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #666; }
          .btn { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">${companyName}</div>
            <p>${companyEmail} | ${companyPhone}</p>
          </div>

          <div class="content">
            <h2>Quote ${quoteNumber}</h2>
            <p>Dear ${clientName},</p>
            <p>Thank you for your interest in our services. Please find your quote details below:</p>

            <div class="quote-details">
              <p><strong>Quote Number:</strong> ${quoteNumber}</p>
              <p><strong>Valid Until:</strong> ${validUntil}</p>
              <p><strong>Total Amount:</strong> <span class="total">R${quoteTotal.toFixed(2)}</span></p>
            </div>

            <p>This quote is valid until ${validUntil}. Please review the attached quote and let us know if you have any questions.</p>

            ${quoteUrl ? `<p><a href="${quoteUrl}" class="btn">View Quote Online</a></p>` : ''}
          </div>

          <div class="footer">
            <p><strong>${companyName}</strong></p>
            <p>${companyEmail} | ${companyPhone}</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  private generateQuoteEmailText(data: QuoteEmailData): string {
    const {
      clientName,
      quoteNumber,
      quoteTotal,
      validUntil,
      companyName,
      companyEmail,
      companyPhone
    } = data

    return `
Quote ${quoteNumber}

Dear ${clientName},

Thank you for your interest in our services. Please find your quote details below:

Quote Number: ${quoteNumber}
Valid Until: ${validUntil}
Total Amount: R${quoteTotal.toFixed(2)}

This quote is valid until ${validUntil}. Please review the quote and let us know if you have any questions.

Best regards,
${companyName}
${companyEmail} | ${companyPhone}
    `
  }

  private generateInvoiceEmailHtml(data: InvoiceEmailData): string {
    const {
      clientName,
      invoiceNumber,
      invoiceTotal,
      dueDate,
      companyName,
      companyEmail,
      companyPhone,
      invoiceUrl
    } = data

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { border-bottom: 2px solid #28a745; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #28a745; }
          .content { margin-bottom: 30px; }
          .invoice-details { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .total { font-size: 24px; font-weight: bold; color: #28a745; text-align: right; }
          .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #666; }
          .btn { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">${companyName}</div>
            <p>${companyEmail} | ${companyPhone}</p>
          </div>

          <div class="content">
            <h2>Invoice ${invoiceNumber}</h2>
            <p>Dear ${clientName},</p>
            <p>Please find your invoice details below:</p>

            <div class="invoice-details">
              <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
              <p><strong>Due Date:</strong> ${dueDate}</p>
              <p><strong>Total Amount Due:</strong> <span class="total">R${invoiceTotal.toFixed(2)}</span></p>
            </div>

            <p>Please ensure payment is made by the due date. Payment details are attached to this invoice.</p>

            ${invoiceUrl ? `<p><a href="${invoiceUrl}" class="btn">View Invoice Online</a></p>` : ''}
          </div>

          <div class="footer">
            <p><strong>${companyName}</strong></p>
            <p>${companyEmail} | ${companyPhone}</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  private generateInvoiceEmailText(data: InvoiceEmailData): string {
    const {
      clientName,
      invoiceNumber,
      invoiceTotal,
      dueDate,
      companyName,
      companyEmail,
      companyPhone
    } = data

    return `
Invoice ${invoiceNumber}

Dear ${clientName},

Please find your invoice details below:

Invoice Number: ${invoiceNumber}
Due Date: ${dueDate}
Total Amount Due: R${invoiceTotal.toFixed(2)}

Please ensure payment is made by the due date. Payment details are attached to this invoice.

Best regards,
${companyName}
${companyEmail} | ${companyPhone}
    `
  }

  async logEmailNotification(
    type: 'quote' | 'invoice' | 'reminder',
    recipientEmail: string,
    entityId: string,
    status: 'sent' | 'failed' = 'sent',
    error?: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      const supabase = getSupabaseServer()

      const { error } = await supabase
        .from("email_notifications")
        .insert({
          type,
          recipient_email: recipientEmail,
          entity_id: entityId,
          status,
          error,
          created_by_user_id: this.userId,
          created_at: new Date().toISOString()
        })

      if (error) {
        return this.createErrorResponse(this.handleSupabaseError(error))
      }

      return this.createSuccessResponse(true, "Email notification logged successfully")
    } catch (error) {
      console.error("Error logging email notification:", error)
      return this.createErrorResponse("Failed to log email notification")
    }
  }
}