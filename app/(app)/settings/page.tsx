"use client"

import * as React from "react"
import { useEffect, useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Save } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { fetchCompanySettings } from "@/lib/mappers"
import { supabase } from "@/lib/supabase"
import type { CompanySettings } from "@/lib/invoice-types"

const companySettingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  address: z.string().min(1, "Address is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(1, "Phone number is required"),
  currency: z.string().min(1, "Currency is required"),
  vatPercentage: z.number().min(0).max(100),
  numberingFormatInvoice: z.string().min(1, "Invoice numbering format is required"),
  numberingFormatQuote: z.string().min(1, "Quote numbering format is required"),
  nextInvoiceNumber: z.number().min(1),
  nextQuoteNumber: z.number().min(1),
  termsText: z.string().min(1, "Terms text is required"),
  bank: z.string().min(1, "Bank name is required"),
  accountName: z.string().min(1, "Account name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  branchCode: z.string().min(1, "Branch code is required"),
  swift: z.string().min(1, "SWIFT code is required"),
})

type CompanySettingsFormValues = z.infer<typeof companySettingsSchema>

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<CompanySettings | null>(null)

  const form = useForm<CompanySettingsFormValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      companyName: "",
      address: "",
      email: "",
      phone: "",
      currency: "ZAR",
      vatPercentage: 15,
      numberingFormatInvoice: "INV-{seq:04d}",
      numberingFormatQuote: "Q-{seq:04d}",
      nextInvoiceNumber: 1,
      nextQuoteNumber: 1,
      termsText: "",
      bank: "",
      accountName: "",
      accountNumber: "",
      branchCode: "",
      swift: "",
    },
    mode: "onTouched",
  })

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchCompanySettings()
      if (data) {
        setSettings(data)
        form.reset({
          companyName: data.companyName,
          address: data.address,
          email: data.email,
          phone: data.phone,
          currency: data.currency,
          vatPercentage: data.vatPercentage,
          numberingFormatInvoice: data.numberingFormatInvoice,
          numberingFormatQuote: data.numberingFormatQuote,
          nextInvoiceNumber: data.nextInvoiceNumber,
          nextQuoteNumber: data.nextQuoteNumber,
          termsText: data.termsText,
          bank: data.paymentInstructions.bank,
          accountName: data.paymentInstructions.accountName,
          accountNumber: data.paymentInstructions.accountNumber,
          branchCode: data.paymentInstructions.branchCode,
          swift: data.paymentInstructions.swift,
        })
      }
    } catch (error) {
      console.error("Failed to load settings:", error)
      toast.error("Failed to load company settings")
    } finally {
      setLoading(false)
    }
  }, [form])

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: CompanySettingsFormValues) {
    try {
      const settingsData = {
        company_name: values.companyName,
        address: values.address,
        email: values.email,
        phone: values.phone,
        currency: values.currency,
        vat_percentage: values.vatPercentage,
        numbering_format_invoice: values.numberingFormatInvoice,
        numbering_format_quote: values.numberingFormatQuote,
        next_invoice_number: values.nextInvoiceNumber,
        next_quote_number: values.nextQuoteNumber,
        terms_text: values.termsText,
        payment_instructions: {
          bank: values.bank,
          accountName: values.accountName,
          accountNumber: values.accountNumber,
          branchCode: values.branchCode,
          swift: values.swift,
        },
      }

      if (settings) {
        // Update existing settings
        const { error } = await supabase
          .from("company_settings")
          .update(settingsData)
          .eq("id", settings.id)

        if (error) throw error
      } else {
        // Create new settings
        const { error } = await supabase
          .from("company_settings")
          .insert(settingsData)

        if (error) throw error
      }

      toast.success("Company settings saved successfully")
      await loadSettings() // Reload to get updated data
    } catch (error: unknown) {
      console.error("Failed to save settings:", error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Failed to save settings: ${errorMessage}`)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Company Settings</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Settings</CardTitle>
          <CardDescription>Configure your company information, financial settings, and payment details.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Company Information</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel htmlFor="companyName">Company Name</FormLabel>
                        <FormControl>
                          <Input
                            id="companyName"
                            placeholder="Your Company Name"
                            aria-invalid={!!fieldState.error}
                            aria-describedby={fieldState.error ? "companyName-error" : undefined}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel htmlFor="email">Email</FormLabel>
                        <FormControl>
                          <Input
                            id="email"
                            type="email"
                            placeholder="company@example.com"
                            autoComplete="email"
                            aria-invalid={!!fieldState.error}
                            aria-describedby={fieldState.error ? "email-error" : undefined}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel htmlFor="phone">Phone</FormLabel>
                        <FormControl>
                          <Input
                            id="phone"
                            placeholder="+27 21 123 4567"
                            aria-invalid={!!fieldState.error}
                            aria-describedby={fieldState.error ? "phone-error" : undefined}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel htmlFor="currency">Currency</FormLabel>
                        <FormControl>
                          <Input
                            id="currency"
                            placeholder="ZAR"
                            aria-invalid={!!fieldState.error}
                            aria-describedby={fieldState.error ? "currency-error" : undefined}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel htmlFor="address">Address</FormLabel>
                      <FormControl>
                        <Textarea
                          id="address"
                          placeholder="Company address"
                          className="min-h-[80px]"
                          aria-invalid={!!fieldState.error}
                          aria-describedby={fieldState.error ? "address-error" : undefined}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Financial Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Financial Settings</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="vatPercentage"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel htmlFor="vatPercentage">VAT Percentage</FormLabel>
                        <FormControl>
                          <Input
                            id="vatPercentage"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            aria-invalid={!!fieldState.error}
                            aria-describedby={fieldState.error ? "vatPercentage-error" : undefined}
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Numbering Formats</label>
                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="numberingFormatInvoice"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel htmlFor="numberingFormatInvoice" className="text-xs">Invoice Format</FormLabel>
                            <FormControl>
                              <Input
                                id="numberingFormatInvoice"
                                placeholder="INV-{seq:04d}"
                                aria-invalid={!!fieldState.error}
                                aria-describedby={fieldState.error ? "numberingFormatInvoice-error" : undefined}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="numberingFormatQuote"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel htmlFor="numberingFormatQuote" className="text-xs">Quote Format</FormLabel>
                            <FormControl>
                              <Input
                                id="numberingFormatQuote"
                                placeholder="Q-{seq:04d}"
                                aria-invalid={!!fieldState.error}
                                aria-describedby={fieldState.error ? "numberingFormatQuote-error" : undefined}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="nextInvoiceNumber"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel htmlFor="nextInvoiceNumber">Next Invoice Number</FormLabel>
                        <FormControl>
                          <Input
                            id="nextInvoiceNumber"
                            type="number"
                            min="1"
                            aria-invalid={!!fieldState.error}
                            aria-describedby={fieldState.error ? "nextInvoiceNumber-error" : undefined}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nextQuoteNumber"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel htmlFor="nextQuoteNumber">Next Quote Number</FormLabel>
                        <FormControl>
                          <Input
                            id="nextQuoteNumber"
                            type="number"
                            min="1"
                            aria-invalid={!!fieldState.error}
                            aria-describedby={fieldState.error ? "nextQuoteNumber-error" : undefined}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Payment Instructions */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Payment Instructions</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="bank"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel htmlFor="bank">Bank Name</FormLabel>
                        <FormControl>
                          <Input
                            id="bank"
                            placeholder="Bank Name"
                            aria-invalid={!!fieldState.error}
                            aria-describedby={fieldState.error ? "bank-error" : undefined}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountName"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel htmlFor="accountName">Account Name</FormLabel>
                        <FormControl>
                          <Input
                            id="accountName"
                            placeholder="Account Holder Name"
                            aria-invalid={!!fieldState.error}
                            aria-describedby={fieldState.error ? "accountName-error" : undefined}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel htmlFor="accountNumber">Account Number</FormLabel>
                        <FormControl>
                          <Input
                            id="accountNumber"
                            placeholder="Account Number"
                            aria-invalid={!!fieldState.error}
                            aria-describedby={fieldState.error ? "accountNumber-error" : undefined}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="branchCode"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel htmlFor="branchCode">Branch Code</FormLabel>
                        <FormControl>
                          <Input
                            id="branchCode"
                            placeholder="Branch Code"
                            aria-invalid={!!fieldState.error}
                            aria-describedby={fieldState.error ? "branchCode-error" : undefined}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="swift"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel htmlFor="swift">SWIFT Code</FormLabel>
                        <FormControl>
                          <Input
                            id="swift"
                            placeholder="SWIFT Code"
                            aria-invalid={!!fieldState.error}
                            aria-describedby={fieldState.error ? "swift-error" : undefined}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Terms */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Terms & Conditions</h3>
                <FormField
                  control={form.control}
                  name="termsText"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel htmlFor="termsText">Terms Text</FormLabel>
                      <FormControl>
                        <Textarea
                          id="termsText"
                          placeholder="Enter your terms and conditions..."
                          className="min-h-[120px]"
                          aria-invalid={!!fieldState.error}
                          aria-describedby={fieldState.error ? "termsText-error" : undefined}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}