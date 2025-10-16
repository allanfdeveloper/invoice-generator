'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Invoice, InvoiceItem, Client, Company } from '@/lib/invoice-types'
import { getToken } from '@/lib/auth'

interface InvoicePDFPreviewProps {
  invoice: Invoice & {
    client: Client
    company: Company
    invoice_items: (InvoiceItem & {
      item: {
        id: string
        name: string
        description?: string
      }
    })[]
  }
  showPreview?: boolean
}

export function InvoicePDFPreview({ invoice, showPreview = false }: InvoicePDFPreviewProps) {
  const [isVisible, setIsVisible] = useState(showPreview)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice.company.currency || 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const generatePDF = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const token = getToken()
      if (!token) {
        throw new Error('Authentication required')
      }

      // Dynamically import jsPDF and html2canvas for client-side use
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ])

      // Get HTML from API
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate PDF')
      }

      const htmlContent = await response.text()

      // Create a temporary div to render HTML
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = htmlContent
      tempDiv.style.position = 'absolute'
      tempDiv.style.left = '-9999px'
      tempDiv.style.top = '-9999px'
      tempDiv.style.width = '800px'
      document.body.appendChild(tempDiv)

      try {
        // Convert HTML to canvas
        const canvas = await html2canvas(tempDiv, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
        })

        // Create PDF
        const pdf = new jsPDF('p', 'mm', 'a4')
        const imgData = canvas.toDataURL('image/png')

        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)

        // Download the PDF
        const pdfBlob = pdf.output('blob')
        const url = URL.createObjectURL(pdfBlob)

        const a = document.createElement('a')
        a.href = url
        a.download = `invoice-${invoice.invoice_number}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        // Clean up
        URL.revokeObjectURL(url)
      } finally {
        // Clean up temp div
        document.body.removeChild(tempDiv)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          onClick={() => setIsVisible(!isVisible)}
          variant="outline"
          size="sm"
        >
          {isVisible ? (
            <>
              <EyeOff className="w-4 h-4 mr-2" />
              Hide Preview
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-2" />
              Show Preview
            </>
          )}
        </Button>

        <Button
          onClick={generatePDF}
          disabled={isGenerating}
          size="sm"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Download PDF
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isVisible && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invoice Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={previewRef}
              className="bg-white p-8 rounded-lg border"
              style={{ maxWidth: '800px', margin: '0 auto' }}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-blue-600 mb-2">INVOICE</h1>
                  <p className="text-sm text-gray-500">#{invoice.invoice_number}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold mb-2">{invoice.company.name}</h2>
                  <p className="text-sm">{invoice.company.address || ''}</p>
                  <p className="text-sm">
                    {invoice.company.city || ''}, {invoice.company.state || ''} {invoice.company.zip_code || ''}
                  </p>
                  <p className="text-sm">{invoice.company.email || ''}</p>
                  <p className="text-sm">{invoice.company.phone || ''}</p>
                </div>
              </div>

              {/* Bill To */}
              <div className="mb-8">
                <h3 className="text-base font-semibold text-gray-700 mb-4">Bill To:</h3>
                <p className="font-medium mb-2">{invoice.client.name}</p>
                <p className="text-sm">{invoice.client.address || ''}</p>
                <p className="text-sm">
                  {invoice.client.city || ''}, {invoice.client.state || ''} {invoice.client.zip_code || ''}
                </p>
                <p className="text-sm">{invoice.client.email || ''}</p>
                <p className="text-sm">{invoice.client.phone || ''}</p>
              </div>

              {/* Invoice Details */}
              <div className="flex justify-between mb-8">
                <div>
                  <p className="text-sm"><strong>Issue Date:</strong> {formatDate(invoice.issue_date)}</p>
                  <p className="text-sm"><strong>Due Date:</strong> {formatDate(invoice.due_date)}</p>
                </div>
                <div>
                  <p className="text-sm"><strong>Status:</strong> {invoice.status}</p>
                  <p className="text-sm">
                    <strong>Quote Reference:</strong> {invoice.created_from_quote_id ? `#${invoice.created_from_quote_id}` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse mb-8">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-3 text-left border-b border-gray-200 text-xs font-bold">Description</th>
                    <th className="p-3 text-center border-b border-gray-200 text-xs font-bold">Qty</th>
                    <th className="p-3 text-right border-b border-gray-200 text-xs font-bold">Unit Price</th>
                    <th className="p-3 text-right border-b border-gray-200 text-xs font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.invoice_items.map((item) => (
                    <tr key={item.id}>
                      <td className="p-3 text-left border-b border-gray-200 text-sm">
                        {item.item.name}
                        {item.item.description && (
                          <>
                            <br />
                            <span className="text-gray-500 text-xs">{item.item.description}</span>
                          </>
                        )}
                      </td>
                      <td className="p-3 text-center border-b border-gray-200 text-sm">{item.quantity}</td>
                      <td className="p-3 text-right border-b border-gray-200 text-sm">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="p-3 text-right border-b border-gray-200 text-sm">
                        {formatCurrency(item.total_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary */}
              <div className="flex justify-end mb-8">
                <div className="w-80">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Subtotal:</span>
                    <span className="text-sm">{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {invoice.tax_amount > 0 && (
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Tax:</span>
                      <span className="text-sm">{formatCurrency(invoice.tax_amount)}</span>
                    </div>
                  )}
                  {invoice.discount_amount > 0 && (
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Discount:</span>
                      <span className="text-sm">-{formatCurrency(invoice.discount_amount)}</span>
                    </div>
                  )}
                  {invoice.deposit_amount > 0 && (
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Deposit ({invoice.deposit_percentage}%):</span>
                      <span className="text-sm">-{formatCurrency(invoice.deposit_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between mt-4 pt-4 border-t-2 border-gray-700">
                    <span className="text-base font-bold">Total:</span>
                    <span className="text-base font-bold">{formatCurrency(invoice.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Terms and Notes */}
              {invoice.terms && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Terms & Conditions</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{invoice.terms}</p>
                </div>
              )}
              {invoice.notes && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{invoice.notes}</p>
                </div>
              )}

              {/* Footer */}
              <div className="text-center mt-12 pt-6 border-t border-gray-200 text-xs text-gray-500">
                <p>Thank you for your business!</p>
                <p>Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}