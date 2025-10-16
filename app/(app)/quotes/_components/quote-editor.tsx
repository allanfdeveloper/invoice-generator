"use client"

import * as React from "react"
import { useEffect, useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Trash2, Eye, Save, Package, Calculator, AlertCircle, FileText, Receipt } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"

import type { Quote, Client, CompanySettings, Item, Package as PackageType } from "@/lib/invoice-types"
import { QuoteStatus, ItemType } from "@/lib/invoice-types"
import { fetchClients, fetchCompanySettings, formatCurrency, fetchPackages } from "@/lib/mappers"
import { supabase } from "@/lib/supabase"
import { QuotePDFPreview } from "@/components/ui/quote-pdf-preview"
import { getToken } from "@/lib/auth"


const quoteSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  dateIssued: z.string().min(1, "Date issued is required"),
  validUntil: z.string().min(1, "Valid until date is required"),
  status: z.nativeEnum(QuoteStatus),
  depositPercentage: z.number().min(0, "Deposit must be 0% or higher").max(100, "Deposit cannot exceed 100%"),
  notes: z.string().max(2000, "Notes too long").optional(),
  termsText: z.string().max(5000, "Terms text too long").optional(),
}).refine((data) => {
  const issuedDate = new Date(data.dateIssued)
  const validUntilDate = new Date(data.validUntil)
  return validUntilDate > issuedDate
}, {
  message: "Valid until date must be after the date issued",
  path: ["validUntil"],
})

type QuoteFormValues = z.infer<typeof quoteSchema>

interface QuoteEditorProps {
  quote?: Quote | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSaved: (quote: Quote) => void
  onCancel?: () => void
}

export function QuoteEditor({ quote, open = true, onOpenChange, onSaved, onCancel }: QuoteEditorProps) {
  const isPageMode = !onOpenChange // If no onOpenChange, we're in page mode
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [packages, setPackages] = useState<PackageType[]>([])
  const [items, setItems] = useState<Item[]>(quote?.items || [])
  const [selectedPackage, setSelectedPackage] = useState<string>("")
  const [isCalculating, setIsCalculating] = useState(false)
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      clientId: quote?.clientId || "",
      dateIssued: quote?.dateIssued ? new Date(quote.dateIssued).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      validUntil: quote?.validUntil ? new Date(quote.validUntil).toISOString().split('T')[0] : "",
      status: (quote?.status || QuoteStatus.Draft).toLowerCase() as QuoteStatus,
      depositPercentage: quote?.depositPercentage || 40,
      notes: quote?.notes || "",
      termsText: quote?.termsText || "",
    },
  })

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, loadData])

  useEffect(() => {
    if (quote) {
      form.reset({
        clientId: quote.clientId,
        dateIssued: new Date(quote.dateIssued).toISOString().split('T')[0],
        validUntil: new Date(quote.validUntil).toISOString().split('T')[0],
        status: quote.status.toLowerCase() as QuoteStatus,
        depositPercentage: quote.depositPercentage,
        notes: quote.notes,
        termsText: quote.termsText,
      })
      setItems(quote.items)
    } else {
      form.reset({
        clientId: "",
        dateIssued: new Date().toISOString().split('T')[0],
        validUntil: "",
        status: QuoteStatus.Draft.toLowerCase() as QuoteStatus,
        depositPercentage: 40,
        notes: "",
        termsText: "",
      })
      setItems([])
    }
  }, [quote, form])

  const loadData = useCallback(async () => {
    try {
      const [clientsData, settingsData, packagesData] = await Promise.all([
        fetchClients(),
        fetchCompanySettings(),
        fetchPackages(),
      ])
      setClients(clientsData)
      setSettings(settingsData)
      setPackages(packagesData)
    } catch (error) {
      console.error("Failed to load data:", error)
      toast.error("Failed to load data")
    }
  }, [])

  const convertQuoteToInvoice = async () => {
    if (!quote) {
      toast.error("Quote must be saved before converting to invoice")
      return
    }

    setIsConverting(true)
    try {
      const token = getToken()
      if (!token) {
        toast.error("Authentication required")
        return
      }

      const response = await fetch(`/api/quotes/${quote.id}/convert-to-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to convert quote to invoice')
      }

      const result = await response.json()

      if (result.success) {
        toast.success(`Invoice #${result.invoice.invoice_number} created successfully!`)

        // Optional: Navigate to the invoice page
        if (typeof window !== 'undefined') {
          window.open(`/invoices/${result.invoice.id}`, '_blank')
        }
      } else {
        toast.error(result.message || 'Failed to create invoice')
      }
    } catch (error) {
      console.error('Error converting quote to invoice:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to convert quote to invoice')
    } finally {
      setIsConverting(false)
    }
  }

  const calculateTotals = useCallback((currentItems: Item[], depositPercentage: number) => {
    console.log('calculateTotals called with items:', currentItems.length)
    const subtotalExclVat = currentItems.reduce((acc, item) => acc + item.unitPrice * item.qty, 0)
    const taxableAmount = currentItems.filter(i => i.taxable).reduce((acc, item) => acc + item.unitPrice * item.qty, 0)
    const vatPercentage = settings?.vatPercentage || 0
    const vatAmount = taxableAmount * (vatPercentage / 100)
    const totalInclVat = subtotalExclVat + vatAmount
    const depositAmount = totalInclVat * (depositPercentage / 100)
    const balanceRemaining = totalInclVat - depositAmount

    console.log('calculateTotals result:', {
      subtotalExclVat,
      vatAmount,
      totalInclVat,
      depositAmount,
      balanceRemaining
    })

    return {
      subtotalExclVat,
      vatAmount,
      totalInclVat,
      depositAmount,
      balanceRemaining,
    }
  }, [settings?.vatPercentage]);

  const depositPercentage = form.watch("depositPercentage")
  const totals = React.useMemo(() => calculateTotals(items, depositPercentage), [items, depositPercentage, calculateTotals]);

  // Generate preview quote data for PDF
  const generatePreviewQuote = useCallback(() => {
    const formValues = form.getValues()
    const selectedClient = clients.find(c => c.id === formValues.clientId)

    if (!selectedClient || !settings) return null

    const previewQuote: Quote = {
      id: quote?.id || "preview",
      quoteNumber: quote?.quoteNumber || "PREVIEW",
      createdByUserId: quote?.createdByUserId || "preview",
      dateIssued: formValues.dateIssued,
      validUntil: formValues.validUntil,
      clientId: formValues.clientId,
      items: items,
      subtotalExclVat: totals.subtotalExclVat,
      vatAmount: totals.vatAmount,
      totalInclVat: totals.totalInclVat,
      depositPercentage: formValues.depositPercentage,
      depositAmount: totals.depositAmount,
      balanceRemaining: totals.balanceRemaining,
      status: formValues.status,
      termsText: formValues.termsText || "",
      notes: formValues.notes || "",
      createdAt: quote?.createdAt || new Date().toISOString(),
      updatedAt: quote?.updatedAt || new Date().toISOString(),
    }

    return { quote: previewQuote, client: selectedClient, settings }
  }, [form, clients, settings, items, totals, quote])

  // Effect to manage the `isCalculating` state based on changes in items or form values
  useEffect(() => {
    let isMounted = true; // Flag to track if the component is mounted
    setIsCalculating(true);
    const timer = setTimeout(() => {
      if (isMounted) { // Only update state if the component is still mounted
        setIsCalculating(false);
      }
    }, 50); // Small delay to show calculation state

    return () => {
      isMounted = false; // Set flag to false when component unmounts
      clearTimeout(timer);
    };
  }, [items, depositPercentage]);

  const addItem = useCallback(() => {
    const newItem: Item = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description: "",
      unitPrice: 0,
      qty: 1,
      taxable: true,
      itemType: ItemType.Fixed,
      unit: "each",
    }
    setItems(prev => [...prev, newItem])
  }, [])

  const updateItem = useCallback((index: number, field: keyof Item, value: Item[keyof Item]) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ))
  }, [])

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handlePackageSelect = useCallback((packageId: string) => {
    const selectedPkg = packages.find(p => p.id === packageId)
    if (selectedPkg) {
      const packageItems: Item[] = selectedPkg.items.map((item, index) => ({
        ...item,
        id: `pkg-item-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      }))
      setItems(prev => [...prev, ...packageItems])
      toast.success(`Added ${selectedPkg.items.length} items from ${selectedPkg.name}`)
    }
    setSelectedPackage("")
  }, [packages])

  const handleSubmit = async (values: QuoteFormValues) => {
    if (items.length === 0) {
      toast.error("Please add at least one item")
      return
    }

    if (!settings) {
      toast.error("Company settings not loaded. Please try again.")
      return
    }

    setLoading(true)
    try {

      if (quote) {
        // Update existing quote
        console.log("=== DEBUG: Starting quote update process ===")
        console.log("Quote ID:", quote.id)
        console.log("Items to update:", items.length)

        // Update the quote first
        const statusToSend = values.status.toLowerCase()
        console.log("=== DEBUG: Status transformation ===")
        console.log("Original status:", values.status)
        console.log("Transformed status:", statusToSend)
        console.log("Status type:", typeof statusToSend)

        const updateData = {
            client_id: values.clientId,
            date_issued: values.dateIssued,
            valid_until: values.validUntil,
            status: statusToSend,
            deposit_percentage: values.depositPercentage,
            notes: values.notes,
            terms_text: values.termsText,
            subtotal_excl_vat: totals.subtotalExclVat,
            vat_amount: totals.vatAmount,
            total_incl_vat: totals.totalInclVat,
            deposit_amount: totals.depositAmount,
            balance_remaining: totals.balanceRemaining,
          }

        console.log("=== DEBUG: Complete update data ===")
        console.log("Update data:", JSON.stringify(updateData, null, 2))

        const { error: updateError } = await supabase
          .from("quotes")
          .update(updateData)
          .eq("id", quote.id)

        if (updateError) {
          console.error("Quote update error:", updateError)
          throw updateError
        }

        // Handle items update - need to manage the junction table
        console.log("=== DEBUG: Handling items update ===")

        // Get existing quote items
        const { data: existingQuoteItems, error: fetchError } = await supabase
          .from("quote_items")
          .select("item_id")
          .eq("quote_id", quote.id)

        if (fetchError) {
          console.error("Failed to fetch existing quote items:", fetchError)
          throw fetchError
        }

        console.log("Existing quote items:", existingQuoteItems?.length || 0)

        // Delete existing quote-item relationships
        const { error: deleteError } = await supabase
          .from("quote_items")
          .delete()
          .eq("quote_id", quote.id)

        if (deleteError) {
          console.error("Failed to delete existing quote items:", deleteError)
          throw deleteError
        }

        console.log("Deleted existing quote-item relationships")

        // Process items
        if (items.length > 0) {
          const itemsToInsert = items.map(item => ({
            description: item.description || "Untitled Item",
            unit_price: item.unitPrice || 0,
            qty: item.qty || 1,
            taxable: item.taxable !== false,
            item_type: item.itemType || "Fixed",
            unit: item.unit || "each",
          }))

          console.log("Inserting items:", itemsToInsert.length)

          // Insert new items
          const { data: insertedItems, error: itemsError } = await supabase
            .from("items")
            .insert(itemsToInsert)
            .select()

          if (itemsError) {
            console.error("Items insert error:", itemsError)
            throw itemsError
          }

          if (!insertedItems || insertedItems.length === 0) {
            throw new Error("No items were inserted")
          }

          console.log("Items inserted:", insertedItems.length)

          // Create new quote-item relationships
          const quoteItemInserts = insertedItems.map(item => ({
            quote_id: quote.id,
            item_id: item.id,
          }))

          const { error: quoteItemsError } = await supabase
            .from("quote_items")
            .insert(quoteItemInserts)

          if (quoteItemsError) {
            console.error("Quote items insert error:", quoteItemsError)
            throw quoteItemsError
          }

          console.log("Created new quote-item relationships")
        }

        const updatedQuote: Quote = {
          ...quote,
          clientId: values.clientId,
          dateIssued: values.dateIssued,
          validUntil: values.validUntil,
          status: values.status,
          depositPercentage: values.depositPercentage,
          notes: values.notes,
          termsText: values.termsText,
          items: items,
          ...totals,
        }

        console.log("=== DEBUG: Quote update completed successfully ===")
        onSaved(updatedQuote)
        toast.success("Quote updated successfully")
      } else {
        // Create new quote
        const currentYear = new Date().getFullYear().toString()
        // Generate the initial quote number
        const nextQuoteNumber = settings.numberingFormatQuote
          .replace('{YYYY}', currentYear)
          .replace('{seq:04d}', settings.nextQuoteNumber.toString().padStart(4, '0'))

        const statusToSend = values.status.toLowerCase()
        console.log("=== DEBUG: Status transformation (create) ===")
        console.log("Original status:", values.status)
        console.log("Transformed status:", statusToSend)

        const quoteInsertData = {
          quote_number: nextQuoteNumber,
          client_id: values.clientId,
          date_issued: values.dateIssued,
          valid_until: values.validUntil,
          status: statusToSend,
          deposit_percentage: values.depositPercentage,
          notes: values.notes || null,
          terms_text: values.termsText || null,
          subtotal_excl_vat: totals.subtotalExclVat,
          vat_amount: totals.vatAmount,
          total_incl_vat: totals.totalInclVat,
          deposit_amount: totals.depositAmount,
          balance_remaining: totals.balanceRemaining,
        }

        console.log("Creating quote with data:", quoteInsertData)

        // Test the connection and get current user
        try {
          console.log("=== DEBUG: Starting authentication and connection tests ===")

          // Check if we can get the current user
          const { data: { user }, error: userError } = await supabase.auth.getUser()

          console.log("Auth response:", { user: user?.id, userError })

          if (userError) {
            console.error("Auth user error:", userError)
            throw new Error(`Authentication error: ${userError.message}`)
          }

          if (!user) {
            console.error("No authenticated user found - checking session...")
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            console.log("Session data:", { session: session?.access_token?.substring(0, 20) + "...", sessionError })
            throw new Error("No authenticated user found")
          }

          console.log("Current user ID:", user.id)

          // Update the quote data with real user ID
          const userId = user.id
          console.log("Raw user ID from auth:", userId)

          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          if (!uuidRegex.test(userId)) {
            console.error("Invalid UUID format for user ID:", userId)
            throw new Error(`Invalid user ID format: ${userId}`)
          }

          quoteInsertData.created_by_user_id = userId
          console.log("Setting created_by_user_id to:", userId)

          // Test database connection with proper error handling
          console.log("Testing database connection...")
          const { data: testData, error: testError } = await supabase
            .from("quotes")
            .select("id, created_by_user_id")
            .limit(1)

          console.log("Connection test result:", { testData, testError })

          if (testError) {
            console.error("Connection test failed:", testError)
            throw new Error(`Database connection failed: ${testError.message}`)
          }

          console.log("Database connection test successful")

          // Check if user exists in the users table
          console.log("Checking if user exists in users table...")
          const { data: userExists, error: userCheckError } = await supabase
            .from("users")
            .select("id")
            .eq("id", userId)
            .single()

          console.log("User check result:", { userExists, userCheckError })

          // Check if user exists and handle appropriately
          console.log("User exists check:", {
            userExists: !!userExists,
            userCheckError: userCheckError,
            userCheckErrorKeys: userCheckError ? Object.keys(userCheckError) : [],
            userId: userId
          })

          // Only create user if they don't exist in the users table
          if (!userExists) {
            console.warn("User not found in users table. Creating user record...")

            // Create user record in the users table
            const { data: newUser, error: createError } = await supabase
              .from("users")
              .insert([
                {
                  id: userId,
                  email: user.email,
                  name: user.email?.split('@')[0] || 'User', // Use email prefix as name or fallback
                  role: 'viewer', // Default role for new users (valid: admin, sales, viewer)
                  created_at: new Date().toISOString()
                }
              ])
              .select()
              .single()

            if (createError) {
              console.error("Failed to create user record:", createError)
              throw new Error(`Failed to create user record: ${createError.message}`)
            }

            console.log("User record created successfully:", newUser)
          }

          console.log("Quote data to insert:", JSON.stringify(quoteInsertData, null, 2))
          console.log("=== DEBUG: About to perform insert ===")
        } catch (connError) {
          console.error("Connection test error:", connError)
          throw new Error(`Pre-insert validation failed: ${connError instanceof Error ? connError.message : String(connError)}`)
        }

        const { data, error } = await supabase
          .from("quotes")
          .insert(quoteInsertData)
          .select()
          .single()

        if (error) {
          console.error("=== DEBUG: Supabase insert error ===")
          console.error("Error object type:", typeof error)
          console.error("Error object keys:", Object.keys(error))
          console.error("Error stringified:", JSON.stringify(error))
          console.error("Error message:", error?.message)
          console.error("Error code:", error?.code)
          console.error("Error details:", error?.details)
          console.error("Error hint:", error?.hint)
          console.error("Full error object:", error)

          // Check for specific error types
          if (error.code === '23505') {
            if (error.message?.includes('quotes_quote_number_key')) {
              // Duplicate quote number - increment and retry
              console.log('Duplicate quote number detected, incrementing and retrying...')

              // Update next quote number in settings to skip the conflicting number
              try {
                const { error: updateError } = await supabase
                  .from("company_settings")
                  .update({
                    next_quote_number: settings.nextQuoteNumber + 1
                  })
                  .eq("id", settings.id)

                if (updateError) {
                  console.error("Failed to update next quote number:", updateError)
                } else {
                  console.log("Updated next quote number to:", settings.nextQuoteNumber + 1)
                  // Refresh settings to get the updated quote number
                  const { data: updatedSettings } = await supabase
                    .from("company_settings")
                    .select("*")
                    .single()

                  if (updatedSettings) {
                    setSettings(updatedSettings)
                  }
                }
              } catch (updateError) {
                console.error("Error updating next quote number:", updateError)
              }

              throw new Error('Quote number conflict detected. Please try again - the system has been updated to use the next available number.')
            } else {
              throw new Error('Duplicate entry detected - please check all unique fields')
            }
          } else if (error.code === '23503') {
            if (error.details?.includes('users')) {
              throw new Error('User validation failed - your user account may not be properly set up in the system')
            } else if (error.details?.includes('client')) {
              throw new Error('Invalid client reference - please select a valid client')
            } else {
              throw new Error('Foreign key constraint violated - please check all references')
            }
          } else if (error.code === '22P02') {
            throw new Error('Invalid data format - please check all field formats')
          } else if (error.code === '23514') {
            throw new Error('Data validation failed - please check all required fields')
          } else if (error.code === '42501') {
            throw new Error('Permission denied - you may not have the necessary permissions')
          } else {
            throw new Error(`Quote insert failed: ${error.message || JSON.stringify(error)}`)
          }
        }

        if (!data) {
          throw new Error("No data returned from quote insert")
        }

        console.log("Quote created successfully:", data.id)

        // First insert the items into the items table
        const itemInserts = items.map(item => ({
          description: item.description || "Untitled Item",
          unit_price: item.unitPrice || 0,
          qty: item.qty || 1,
          taxable: item.taxable !== false,
          item_type: item.itemType || "Fixed",
          unit: item.unit || "each",
        }))

        console.log("Inserting items:", itemInserts.length)

        const { data: insertedItems, error: itemsError } = await supabase
          .from("items")
          .insert(itemInserts)
          .select()

        if (itemsError) {
          console.error("Items insert error:", itemsError)
          throw itemsError
        }

        if (!insertedItems || insertedItems.length === 0) {
          throw new Error("No items were inserted")
        }

        console.log("Items inserted:", insertedItems.length)

        // Then create the junction records in quote_items
        const quoteItemInserts = insertedItems.map(item => ({
          quote_id: data.id,
          item_id: item.id,
        }))

        console.log("Creating quote-item relationships:", quoteItemInserts.length)

        const { error: quoteItemsError } = await supabase
          .from("quote_items")
          .insert(quoteItemInserts)

        if (quoteItemsError) {
          console.error("Quote items insert error:", quoteItemsError)
          throw quoteItemsError
        }

        const newQuote: Quote = {
          id: data.id,
          quoteNumber: data.quote_number,
          createdByUserId: data.created_by_user_id,
          dateIssued: data.date_issued,
          validUntil: data.valid_until,
          clientId: data.client_id,
          items,
          ...totals,
          depositPercentage: values.depositPercentage,
          status: data.status,
          termsText: data.terms_text,
          notes: data.notes,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }

        // Update the next quote number in settings
        try {
          const { error: updateSettingsError } = await supabase
            .from("company_settings")
            .update({
              next_quote_number: settings.nextQuoteNumber + 1
            })
            .eq("id", settings.id)

          if (updateSettingsError) {
            console.error("Failed to update next quote number:", updateSettingsError)
            // Don't throw here - the quote was created successfully, just log the warning
          } else {
            console.log("Updated next quote number to:", settings.nextQuoteNumber + 1)
            // Refresh settings to get the updated next quote number
            const { data: updatedSettings } = await supabase
              .from("company_settings")
              .select("*")
              .single()

            if (updatedSettings) {
              setSettings(updatedSettings)
              console.log("Settings refreshed with new next quote number:", updatedSettings.next_quote_number)
            }
          }
        } catch (updateError) {
          console.error("Error updating next quote number:", updateError)
          // Don't throw here - the quote was created successfully
        }

        onSaved(newQuote)
        toast.success("Quote created successfully")
      }

      if (onOpenChange) {
        onOpenChange(false)
      } else if (onCancel) {
        onCancel()
      }
    } catch (error: unknown) {
      console.error("Failed to save quote:", error)
      console.error("Error type:", typeof error)
      console.error("Error constructor:", error?.constructor?.name)

      let errorMessage = 'Unknown error occurred'

      if (error instanceof Error) {
        errorMessage = error.message
        console.error("Error message:", error.message)
        console.error("Error stack:", error.stack)
      } else if (typeof error === 'object' && error !== null) {
        try {
          errorMessage = JSON.stringify(error, null, 2)
          console.error("Error object:", errorMessage)
        } catch {
          errorMessage = 'Complex error object'
          console.error("Error object (stringify failed):", error)
        }
      } else {
        console.error("Error primitive:", error)
        errorMessage = String(error)
      }

      toast.error(`Failed to save quote: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const content = (
    <>
      <motion.div
      initial={{ opacity: 0, scale: isPageMode ? 1 : 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: isPageMode ? 1 : 0.95 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col ${isPageMode ? 'min-h-screen' : 'h-full'}`}
    >
      <div className={`${isPageMode ? 'px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60' : 'px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'}`}>
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {quote ? "Edit Quote" : "Create New Quote"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {quote ? "Update quote details and manage items" : "Build a professional quote with items, packages, and pricing"}
          </p>
        </motion.div>
      </div>

      <div className={`flex-1 overflow-y-auto ${isPageMode ? 'px-6 pb-6' : ''}`}>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 space-y-6">
                {/* Quote Details */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Quote Details
                      </CardTitle>
                      <CardDescription>
                        Configure the basic quote information and settings
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name="clientId"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel className="text-sm font-medium">Client *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="focus:ring-2 focus:ring-primary/20" aria-describedby="client-error">
                                    <SelectValue placeholder="Select a client" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <AnimatePresence>
                                    {clients.map((client) => (
                                      <motion.div
                                        key={client.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                      >
                                        <SelectItem value={client.id}>
                                          <div className="flex flex-col">
                                            <span className="font-medium">{client.company}</span>
                                            <span className="text-xs text-muted-foreground">{client.name}</span>
                                          </div>
                                        </SelectItem>
                                      </motion.div>
                                    ))}
                                  </AnimatePresence>
                                </SelectContent>
                              </Select>
                              <FormMessage id="client-error" role="alert" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Status</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="focus:ring-2 focus:ring-primary/20">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="draft">
                                    <Badge variant="secondary" className="mr-2">Draft</Badge>
                                  </SelectItem>
                                  <SelectItem value="sent">
                                    <Badge variant="default" className="mr-2">Sent</Badge>
                                  </SelectItem>
                                  <SelectItem value="accepted">
                                    <Badge variant="default" className="mr-2 bg-green-500">Accepted</Badge>
                                  </SelectItem>
                                  <SelectItem value="declined">
                                    <Badge variant="destructive" className="mr-2">Declined</Badge>
                                  </SelectItem>
                                  <SelectItem value="expired">
                                    <Badge variant="outline" className="mr-2">Expired</Badge>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="depositPercentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Deposit %</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    className="pr-8 focus:ring-2 focus:ring-primary/20"
                                    min="0"
                                    max="100"
                                    aria-describedby="deposit-help"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                                </div>
                              </FormControl>
                              <p id="deposit-help" className="text-xs text-muted-foreground">Required deposit percentage</p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name="dateIssued"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Date Issued *</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  {...field}
                                  className="focus:ring-2 focus:ring-primary/20"
                                  aria-describedby="date-issued-error"
                                />
                              </FormControl>
                              <FormMessage id="date-issued-error" role="alert" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="validUntil"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Valid Until *</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  {...field}
                                  className="focus:ring-2 focus:ring-primary/20"
                                  aria-describedby="valid-until-error"
                                />
                              </FormControl>
                              <FormMessage id="valid-until-error" role="alert" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Items Management */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Items & Services
                          </CardTitle>
                          <CardDescription>
                            Add individual items or select from predefined packages
                          </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          {packages.length > 0 && (
                            <Select value={selectedPackage} onValueChange={handlePackageSelect}>
                              <SelectTrigger className="w-full sm:w-48 focus:ring-2 focus:ring-primary/20">
                                <SelectValue placeholder="Add from package" />
                              </SelectTrigger>
                              <SelectContent>
                                <AnimatePresence>
                                  {packages.map((pkg) => (
                                    <motion.div
                                      key={pkg.id}
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      exit={{ opacity: 0, x: 10 }}
                                    >
                                      <SelectItem value={pkg.id}>
                                        <div className="flex flex-col">
                                          <span className="font-medium">{pkg.name}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {pkg.items.length} items • {formatCurrency(pkg.priceInclVat, settings?.currency)}
                                          </span>
                                        </div>
                                      </SelectItem>
                                    </motion.div>
                                  ))}
                                </AnimatePresence>
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            type="button"
                            onClick={addItem}
                            size="sm"
                            className="focus:ring-2 focus:ring-primary/20"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Item
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {items.length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-center py-12 border-2 border-dashed border-muted-foreground/25 rounded-lg"
                        >
                          <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                          <h3 className="text-lg font-medium text-muted-foreground mb-2">No items added yet</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Add individual items or select from packages to get started
                          </p>
                          <Button type="button" onClick={addItem} variant="outline">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Your First Item
                          </Button>
                        </motion.div>
                      ) : (
                        <div className="rounded-md border overflow-hidden max-h-[400px] overflow-y-auto">
                          <div className="min-w-full">
                            <Table>
                              <TableHeader className="sticky top-0 bg-background border-b z-10">
                                <TableRow className="bg-muted/50">
                                  <TableHead className="min-w-[200px] sm:min-w-[250px] w-[35%] sm:w-[40%]">Description</TableHead>
                                  <TableHead className="min-w-[60px] sm:min-w-[80px] w-[10%] hidden sm:table-cell">Unit</TableHead>
                                  <TableHead className="min-w-[60px] sm:min-w-[80px] w-[10%]">Qty</TableHead>
                                  <TableHead className="min-w-[80px] sm:min-w-[120px] w-[15%]">Price</TableHead>
                                  <TableHead className="min-w-[80px] sm:min-w-[120px] w-[15%] hidden sm:table-cell">Total</TableHead>
                                  <TableHead className="min-w-[60px] sm:min-w-[80px] w-[10%] sm:w-[5%]">Tax</TableHead>
                                  <TableHead className="w-[40px] sm:w-[50px] w-[5%]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <AnimatePresence>
                                  {items.map((item, index) => (
                                    <motion.tr
                                      key={item.id}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -10 }}
                                      transition={{ duration: 0.2 }}
                                      className="group hover:bg-muted/50"
                                    >
                                      <TableCell className="w-[35%] sm:w-[40%]">
                                        <Input
                                          value={item.description}
                                          onChange={(e) => updateItem(index, "description", e.target.value)}
                                          placeholder="Item description"
                                          className="w-full border-0 focus:ring-2 focus:ring-primary/20 bg-transparent"
                                          aria-label={`Description for item ${index + 1}`}
                                        />
                                      </TableCell>
                                      <TableCell className="w-[10%] hidden sm:table-cell">
                                        <Input
                                          value={item.unit}
                                          onChange={(e) => updateItem(index, "unit", e.target.value)}
                                          placeholder="each"
                                          className="w-full min-w-[60px] border-0 focus:ring-2 focus:ring-primary/20 bg-transparent"
                                          aria-label={`Unit for item ${index + 1}`}
                                        />
                                      </TableCell>
                                      <TableCell className="w-[10%]">
                                        <Input
                                          type="number"
                                          value={item.qty}
                                          onChange={(e) => updateItem(index, "qty", parseFloat(e.target.value) || 0)}
                                          className="w-full min-w-[60px] border-0 focus:ring-2 focus:ring-primary/20 bg-transparent"
                                          min="0.01"
                                          step="0.01"
                                          aria-label={`Quantity for item ${index + 1}`}
                                        />
                                      </TableCell>
                                      <TableCell className="w-[15%]">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={item.unitPrice}
                                          onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                                          className="w-full min-w-[80px] border-0 focus:ring-2 focus:ring-primary/20 bg-transparent"
                                          min="0"
                                          aria-label={`Unit price for item ${index + 1}`}
                                        />
                                      </TableCell>
                                      <TableCell className="w-[15%] font-medium hidden sm:table-cell">
                                        <motion.span
                                          key={item.unitPrice * item.qty}
                                          initial={{ scale: 1.1, color: "#22c55e" }}
                                          animate={{ scale: 1, color: "hsl(var(--foreground))" }}
                                          transition={{ duration: 0.2 }}
                                          className="font-mono"
                                        >
                                          {formatCurrency(item.unitPrice * item.qty, settings?.currency)}
                                        </motion.span>
                                      </TableCell>
                                      <TableCell className="w-[10%] sm:w-[5%]">
                                        <div className="flex justify-center">
                                          <Checkbox
                                            checked={item.taxable}
                                            onCheckedChange={(checked) => updateItem(index, "taxable", !!checked)}
                                            aria-label={`Taxable for item ${index + 1}`}
                                          />
                                        </div>
                                      </TableCell>
                                      <TableCell className="w-[5%]">
                                        <div className="flex justify-center">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeItem(index)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 h-8 w-8 p-0"
                                            aria-label={`Remove item ${index + 1}`}
                                          >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </motion.tr>
                                  ))}
                                </AnimatePresence>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Financial Summary */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Card className="shadow-sm border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Financial Summary
                      </CardTitle>
                      <CardDescription>
                        Automatic calculations with VAT and deposit requirements
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {isCalculating && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            Calculating...
                          </motion.div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <motion.div
                              className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-2"
                              key={`subtotal-${totals.subtotalExclVat}`}
                              initial={{ scale: 1.02 }}
                              animate={{ scale: 1 }}
                            >
                              <span className="text-sm font-medium">Subtotal (Excl. VAT)</span>
                              <span className="font-mono text-sm text-right">
                                {formatCurrency(totals.subtotalExclVat, settings?.currency)}
                              </span>
                            </motion.div>

                            <motion.div
                              className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-2"
                              key={`vat-${totals.vatAmount}`}
                              initial={{ scale: 1.02 }}
                              animate={{ scale: 1 }}
                            >
                              <span className="text-sm font-medium">
                                VAT ({settings?.vatPercentage}%)
                              </span>
                              <span className="font-mono text-sm text-right">
                                {formatCurrency(totals.vatAmount, settings?.currency)}
                              </span>
                            </motion.div>

                            <Separator />

                            <motion.div
                              className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-3"
                              key={`total-${totals.totalInclVat}`}
                              initial={{ scale: 1.05, color: "#22c55e" }}
                              animate={{ scale: 1, color: "hsl(var(--foreground))" }}
                              transition={{ duration: 0.3 }}
                            >
                              <span className="text-lg font-bold">Total (Incl. VAT)</span>
                              <span className="font-mono text-lg font-bold text-primary text-right">
                                {formatCurrency(totals.totalInclVat, settings?.currency)}
                              </span>
                            </motion.div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2">
                              <span className="text-sm font-medium">Deposit Required</span>
                              <FormField
                                control={form.control}
                                name="depositPercentage"
                                render={({ field }) => (
                                  <div className="flex items-center gap-2 ml-auto sm:ml-0">
                                    <Input
                                      type="number"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                      className="w-16 h-8 text-sm focus:ring-2 focus:ring-primary/20"
                                      min="0"
                                      max="100"
                                    />
                                    <span className="text-sm">%</span>
                                  </div>
                                )}
                              />
                            </div>

                            <motion.div
                              className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-2"
                              key={`deposit-${totals.depositAmount}`}
                              initial={{ scale: 1.02 }}
                              animate={{ scale: 1 }}
                            >
                              <span className="text-sm font-medium">Deposit Amount</span>
                              <span className="font-mono text-sm text-right">
                                {formatCurrency(totals.depositAmount, settings?.currency)}
                              </span>
                            </motion.div>

                            <motion.div
                              className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-2"
                              key={`balance-${totals.balanceRemaining}`}
                              initial={{ scale: 1.02 }}
                              animate={{ scale: 1 }}
                            >
                              <span className="text-sm font-medium">Balance Remaining</span>
                              <span className="font-mono text-sm text-right">
                                {formatCurrency(totals.balanceRemaining, settings?.currency)}
                              </span>
                            </motion.div>
                          </div>
                        </div>

                        {items.length === 0 && (
                          <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-lg flex items-center gap-3">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <p className="text-sm text-amber-800">
                              Add items to see financial calculations and totals.
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Additional Information */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Additional Information
                      </CardTitle>
                      <CardDescription>
                        Optional notes and terms that will appear on the quote
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Internal Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Internal notes (not visible to client)..."
                                className="min-h-[80px] focus:ring-2 focus:ring-primary/20 resize-none"
                                aria-describedby="notes-help"
                              />
                            </FormControl>
                            <p id="notes-help" className="text-xs text-muted-foreground">
                              These notes are for internal use only and won&apos;t appear on the quote
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="termsText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Terms & Conditions</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Terms and conditions that will appear on the quote..."
                                className="min-h-[100px] focus:ring-2 focus:ring-primary/20 resize-none"
                                aria-describedby="terms-help"
                              />
                            </FormControl>
                            <p id="terms-help" className="text-xs text-muted-foreground">
                              These terms will be visible to the client on the quote
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 -mb-6 px-6 pb-6"
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (onOpenChange) {
                        onOpenChange(false)
                      } else if (onCancel) {
                        onCancel()
                      }
                    }}
                    className="flex-1 sm:flex-none focus:ring-2 focus:ring-primary/20"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPdfPreviewOpen(true)}
                    disabled={loading || items.length === 0 || !form.getValues().clientId}
                    className="flex-1 sm:flex-none focus:ring-2 focus:ring-primary/20"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Preview PDF
                  </Button>
                  {quote && form.getValues().status === "accepted" && (
                    <Button
                      type="button"
                      onClick={convertQuoteToInvoice}
                      disabled={isConverting}
                      className="flex-1 sm:flex-none focus:ring-2 focus:ring-primary/20 bg-green-600 hover:bg-green-700"
                    >
                      {isConverting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Converting...
                        </>
                      ) : (
                        <>
                          <Receipt className="h-4 w-4 mr-2" />
                          Convert to Invoice
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={loading || items.length === 0}
                    className="flex-1 sm:flex-none focus:ring-2 focus:ring-primary/20"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {quote ? "Update Quote" : "Create Quote"}
                      </>
                    )}
                  </Button>
                </motion.div>
              </form>
            </Form>
          </div>
        </motion.div>
      {generatePreviewQuote() && (
        <QuotePDFPreview
          quote={generatePreviewQuote()!.quote}
          client={generatePreviewQuote()!.client}
          settings={generatePreviewQuote()!.settings}
          isOpen={pdfPreviewOpen}
          onOpenChange={setPdfPreviewOpen}
        />
      )}
      </>
  )

  if (isPageMode) {
    return content
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-none h-[95vh] max-h-[95vh] overflow-hidden p-0 gap-0">
        {content}
      </DialogContent>
    </Dialog>
  )
}