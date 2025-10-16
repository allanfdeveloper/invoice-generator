"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { QuoteEditor } from "../../_components/quote-editor"
import type { Quote } from "@/lib/invoice-types"
import { fetchQuotes } from "@/lib/mappers"

export default function EditQuotePage() {
  const router = useRouter()
  const params = useParams()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadQuote = async () => {
      if (!params.id) return

      try {
        const quotes = await fetchQuotes()
        const foundQuote = quotes.find(q => q.id === params.id)
        if (foundQuote) {
          setQuote(foundQuote)
        } else {
          router.push("/quotes")
        }
      } catch (error) {
        console.error("Failed to load quote:", error)
        router.push("/quotes")
      } finally {
        setLoading(false)
      }
    }

    loadQuote()
  }, [params.id, router])

  const handleSave = () => {
    router.push("/quotes")
  }

  const handleCancel = () => {
    router.back()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Quote not found</h1>
          <p className="text-muted-foreground">The quote you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  return (
    <QuoteEditor
      quote={quote}
      onSaved={handleSave}
      onCancel={handleCancel}
    />
  )
}