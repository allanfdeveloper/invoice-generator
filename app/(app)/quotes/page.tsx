"use client"

import * as React from "react"
import { useEffect, useMemo, useState, useTransition, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { FilePlus2, Search, Receipt, ExternalLink } from "lucide-react"
import { fetchClients, fetchCompanySettings, fetchQuotes, fetchInvoices, formatCurrency, formatDateISO, humanizeStatus } from "@/lib/mappers"
import type { Client, CompanySettings, Quote, Invoice } from "@/lib/invoice-types"
import { AnimatePresence } from "framer-motion"
import { m } from "@/components/ui/motion"
import { InlineSpinner } from "@/components/ui/inline-spinner"
import { useRouter } from "next/navigation"

export default function QuotesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | Quote["status"]>("all")
  const [isPending, startUiTransition] = useTransition()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const [s, cs, qs, invs] = await Promise.all([fetchCompanySettings(), fetchClients(), fetchQuotes(), fetchInvoices()])
        if (!mounted) return
        setSettings(s)
        setClients(cs)
        setQuotes(qs)
        setInvoices(invs)
      } catch (e) {
        console.error(e)
        toast.error("Failed to load quotes")
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return quotes.filter((quote) => {
      const client = clients.find((c) => c.id === quote.clientId)
      const text = `${quote.quoteNumber} ${client?.company ?? ""}`.toLowerCase()
      const matchesQuery = text.includes(q)
      const matchesStatus = status === "all" ? true : quote.status === status
      return matchesQuery && matchesStatus
    })
  }, [quotes, clients, query, status])

  function statusBadgeVariant(s: Quote["status"]) {
    switch (s) {
      case "accepted":
        return "default" as const
      case "declined":
        return "destructive" as const
      case "expired":
        return "outline" as const
      case "sent":
        return "secondary" as const
      case "draft":
      default:
        return "secondary" as const
    }
  }

  const handleNewQuote = () => {
    router.push("/quotes/new")
  }

  const handleEditQuote = (quote: Quote) => {
    router.push(`/quotes/${quote.id}/edit`)
  }

  const getInvoiceForQuote = (quoteId: string) => {
    return invoices.find(invoice => invoice.createdFromQuoteId === quoteId)
  }

  const handleViewInvoice = (invoice: Invoice) => {
    router.push(`/invoices/${invoice.id}`)
  }

  return (
    <m.div
      className="space-y-6"
      initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Quotes</CardTitle>
          <CardDescription>Browse and manage sales quotes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Search quotes"
                placeholder="Search by quote # or client"
                className="pl-8 pr-8 transition-[border-color,box-shadow] duration-150"
                value={query}
                onChange={(e) =>
                  startUiTransition(() => {
                    setQuery(e.target.value)
                  })
                }
              />
              <div className="absolute right-2.5 top-2.5 text-muted-foreground">
                <AnimatePresence>
                  {isPending && <InlineSpinner size={14} />}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="sr-only">
                Status filter
              </label>
              <Select
                value={status}
                onValueChange={(v) =>
                  startUiTransition(() => {
                    setStatus(v as "all" | Quote["status"])
                  })
                }
              >
                <SelectTrigger id="status-filter" className="w-44">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grow" />

            <m.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
              <Button onClick={handleNewQuote}>
                <FilePlus2 className="mr-2 h-4 w-4" aria-hidden="true" />
                New Quote
              </Button>
            </m.div>
          </div>

          <Separator />

          {/* Table */}
          <Suspense fallback={<div className="rounded-md border p-6 text-sm text-muted-foreground">Loading…</div>}>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead className="w-[140px]">Quote #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-center">Invoice</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <tr>
                      <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                        Loading…
                      </TableCell>
                    </tr>
                  )}

                  {!loading && filtered.length === 0 && (
                    <AnimatePresence mode="wait">
                      <m.tr
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <TableCell colSpan={8} className="h-24 text-center">
                          <m.div
                            className="inline-flex flex-col items-center justify-center text-sm text-muted-foreground"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.18 }}
                          >
                            <m.svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              className="mb-1"
                              animate={{ y: [0, -2, 0] }}
                              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                              aria-hidden="true"
                            >
                              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                            </m.svg>
                            No quotes found.
                          </m.div>
                        </TableCell>
                      </m.tr>
                    </AnimatePresence>
                  )}

                  {!loading && filtered.length > 0 && (
                    <AnimatePresence initial={false}>
                      {filtered.map((q) => {
                        const client = clients.find((c) => c.id === q.clientId)
                        const invoice = getInvoiceForQuote(q.id)
                        return (
                          <m.tr
                            key={q.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -2 }}
                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <TableCell className="font-medium">{q.quoteNumber}</TableCell>
                            <TableCell>{client?.company ?? "—"}</TableCell>
                            <TableCell>{formatDateISO(q.dateIssued)}</TableCell>
                            <TableCell>{formatDateISO(q.validUntil)}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(q.totalInclVat, settings?.currency ?? "ZAR")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={statusBadgeVariant(q.status)} className="capitalize">
                                {humanizeStatus(q.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {invoice ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewInvoice(invoice)}
                                  className="text-green-600 border-green-600 hover:bg-green-50"
                                >
                                  <Receipt className="w-3 h-3 mr-1" />
                                  {invoice.invoiceNumber}
                                  <ExternalLink className="w-3 h-3 ml-1" />
                                </Button>
                              ) : q.status === "accepted" ? (
                                <span className="text-xs text-muted-foreground">Auto-generated</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => handleEditQuote(q)}>
                                Edit
                              </Button>
                            </TableCell>
                          </m.tr>
                        )
                      })}
                    </AnimatePresence>
                  )}
                </TableBody>
              </Table>
            </div>
          </Suspense>
        </CardContent>
      </Card>

    </m.div>
  )
}