import { createClient } from "@supabase/supabase-js"

export const runtime = 'nodejs'
import { NextRequest, NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sgbrlqcquoydwgugaiqn.supabase.co"
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnYnJscWNxdW95ZHdndWdhaXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODg4NjksImV4cCI6MjA3Mzg2NDg2OX0.QdfVq-AWsAoufIWe0d4OyursigMHYcerrqVezp7LhKs"

// Create Supabase client with service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { table, operation, data, filters, options } = body

    let result

    switch (operation) {
      case 'select':
        let query = supabase.from(table).select(filters?.select || '*')

        if (filters?.eq) {
          Object.entries(filters.eq).forEach(([column, value]) => {
            query = query.eq(column, value)
          })
        }

        if (filters?.neq) {
          Object.entries(filters.neq).forEach(([column, value]) => {
            query = query.neq(column, value)
          })
        }

        if (filters?.gt) {
          Object.entries(filters.gt).forEach(([column, value]) => {
            query = query.gt(column, value)
          })
        }

        if (filters?.lt) {
          Object.entries(filters.lt).forEach(([column, value]) => {
            query = query.lt(column, value)
          })
        }

        if (filters?.gte) {
          Object.entries(filters.gte).forEach(([column, value]) => {
            query = query.gte(column, value)
          })
        }

        if (filters?.lte) {
          Object.entries(filters.lte).forEach(([column, value]) => {
            query = query.lte(column, value)
          })
        }

        if (filters?.like) {
          Object.entries(filters.like).forEach(([column, value]) => {
            query = query.like(column, value as string)
          })
        }

        if (filters?.ilike) {
          Object.entries(filters.ilike).forEach(([column, value]) => {
            query = query.ilike(column, value as string)
          })
        }

        if (filters?.in) {
          Object.entries(filters.in).forEach(([column, value]) => {
            query = query.in(column, value as readonly unknown[])
          })
        }

        if (filters?.order) {
          query = query.order(filters.order.column, { ascending: filters.order.ascending ?? true })
        }

        if (filters?.limit) {
          query = query.limit(filters.limit)
        }

        if (filters?.range) {
          query = query.range(filters.range.from, filters.range.to)
        }

        result = await query
        break

      case 'insert':
        result = await supabase.from(table).insert(data).select()
        break

      case 'update':
        let updateQuery = supabase.from(table).update(data)

        if (filters?.eq) {
          Object.entries(filters.eq).forEach(([column, value]) => {
            updateQuery = updateQuery.eq(column, value)
          })
        }

        if (filters?.neq) {
          Object.entries(filters.neq).forEach(([column, value]) => {
            updateQuery = updateQuery.neq(column, value)
          })
        }

        result = await updateQuery.select()
        break

      case 'delete':
        let deleteQuery = supabase.from(table).delete()

        if (filters?.eq) {
          Object.entries(filters.eq).forEach(([column, value]) => {
            deleteQuery = deleteQuery.eq(column, value)
          })
        }

        result = await deleteQuery
        break

      case 'upsert':
        result = await supabase.from(table).upsert(data, options).select()
        break

      case 'count':
        let countQuery = supabase.from(table).select('*', { count: 'exact', head: true })

        if (filters?.eq) {
          Object.entries(filters.eq).forEach(([column, value]) => {
            countQuery = countQuery.eq(column, value)
          })
        }

        const countResult = await countQuery
        result = { count: countResult.count }
        break

      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Supabase proxy error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
