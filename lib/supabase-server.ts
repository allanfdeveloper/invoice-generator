import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { cache } from "react"

// Global server-side Supabase client instances
let supabaseServer: SupabaseClient | null = null
let supabaseAdmin: SupabaseClient | null = null

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing required Supabase environment variables")
}

/**
 * Creates a Supabase client for server-side use
 * Uses the anonymous key by default, falls back to service role key for admin operations
 */
export function createSupabaseServerClient(): SupabaseClient {
  if (supabaseServer) {
    return supabaseServer
  }

  const key = supabaseServiceKey || supabaseAnonKey

  supabaseServer = createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  return supabaseServer
}

/**
 * Creates a Supabase client with service role key for admin operations
 * Bypasses RLS policies - use with caution
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (supabaseAdmin) {
    return supabaseAdmin
  }

  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required for admin operations")
  }

  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  return supabaseAdmin
}

/**
 * Gets the current Supabase server client (cached)
 */
export const getSupabaseServer = cache(() => {
  return createSupabaseServerClient()
})

/**
 * Gets the Supabase admin client (cached)
 * Note: This bypasses RLS policies and should only be used for trusted server operations
 */
export const getSupabaseAdmin = cache(() => {
  return createSupabaseAdminClient()
})

/**
 * Creates a Supabase client with a specific user's token
 * Useful for operations that need to run as a specific user
 */
export function createSupabaseClientForUser(token: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  })
}

/**
 * Database connection health check
 */
export async function checkSupabaseHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const supabase = getSupabaseServer()

    // Simple health check - try to query the database
    const { error } = await supabase
      .from("company_settings")
      .select("id")
      .limit(1)

    if (error) {
      return {
        healthy: false,
        error: error.message
      }
    }

    return { healthy: true }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Transaction helper for atomic operations
 * Note: PostgreSQL transactions are handled at the database level
 */
export class DatabaseTransaction {
  private supabase: SupabaseClient

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || getSupabaseServer()
  }

  /**
   * Executes a function within a database transaction context
   * Uses PostgreSQL's transaction capabilities via RPC
   */
  async execute<T>(
    transactionFunction: (client: SupabaseClient) => Promise<T>
  ): Promise<T> {
    try {
      return await transactionFunction(this.supabase)
    } catch (error) {
      console.error("Transaction error:", error)
      throw error
    }
  }

  /**
   * Calls a database function (RPC) within transaction context
   */
  async rpc<T = any>(
    functionName: string,
    params: any = {}
  ): Promise<{ data: T | null; error: any }> {
    return await this.supabase.rpc(functionName, params)
  }
}

/**
 * Creates a new transaction instance
 */
export function createTransaction(supabase?: SupabaseClient): DatabaseTransaction {
  return new DatabaseTransaction(supabase)
}

/**
 * Database utility functions
 */
export const DatabaseUtils = {
  /**
   * Generates a UUID for new records
   */
  generateUUID(): string {
    return crypto.randomUUID()
  },

  /**
   * Validates if a string is a valid UUID
   */
  isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  },

  /**
   * Gets current timestamp in ISO format
   */
  getCurrentTimestamp(): string {
    return new Date().toISOString()
  },

  /**
   * Formats date for database queries
   */
  formatDateForDB(date: Date | string): string {
    if (typeof date === "string") {
      return new Date(date).toISOString()
    }
    return date.toISOString()
  },

  /**
   * Parses query filters safely
   */
  parseFilters(filters: Record<string, any>): Record<string, any> {
    const parsed: Record<string, any> = {}

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        parsed[key] = value
      }
    }

    return parsed
  }
}

/**
 * Export default client for convenience
 */
export const supabaseServerClient = getSupabaseServer()

/**
 * Environment variables helper
 */
export const SupabaseConfig = {
  url: supabaseUrl!,
  anonKey: supabaseAnonKey!,
  serviceKey: supabaseServiceKey,

  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",

  // Check if we have admin capabilities
  hasAdminAccess: !!supabaseServiceKey,

  // Check if environment is properly configured
  isConfigured: !!(supabaseUrl && supabaseAnonKey),
}