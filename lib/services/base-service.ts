import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { PostgrestError } from "@supabase/supabase-js"

export interface PaginationOptions {
  page: number
  limit: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface ServiceResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

export interface PaginatedResponse<T> extends ServiceResponse<T[]> {
  pagination: PaginationMeta | null
}

export interface FilterOptions {
  search?: string
  status?: string
  date_from?: string
  date_to?: string
  [key: string]: any
}

export abstract class BaseService {
  protected supabase: SupabaseClient
  protected userId: string | null = null

  constructor(userId?: string) {
    this.supabase = this.createSupabaseClient()
    this.userId = userId || null
  }

  private createSupabaseClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing required Supabase environment variables")
    }

    // Use service role key for backend operations (bypasses RLS for admin operations)
    // Fall back to anon key if service role key is not available
    const key = supabaseServiceKey || supabaseAnonKey

    return createClient(supabaseUrl, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }

  protected handleSupabaseError(error: PostgrestError): string {
    console.error("Supabase error:", error)

    // Handle common Supabase errors
    switch (error.code) {
      case "23505": // Unique violation
        return "This record already exists"
      case "23503": // Foreign key violation
        return "Referenced record does not exist"
      case "23502": // Not null violation
        return "Required field is missing"
      case "42501": // Insufficient privilege
        return "You don't have permission to perform this action"
      case "PGRST116": // Not found
        return "Record not found"
      default:
        return error.message || "An unexpected error occurred"
    }
  }

  protected createPaginationMeta(
    total: number,
    page: number,
    limit: number
  ): PaginationMeta {
    const pages = Math.ceil(total / limit)
    return {
      page,
      limit,
      total,
      pages,
      hasNextPage: page < pages,
      hasPreviousPage: page > 1
    }
  }

  protected createSuccessResponse<T>(data: T): ServiceResponse<T> {
    return {
      data,
      error: null,
      success: true
    }
  }

  protected createErrorResponse<T>(error: string): ServiceResponse<T> {
    return {
      data: null,
      error,
      success: false
    }
  }

  protected createPaginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): PaginatedResponse<T> {
    return {
      data,
      error: null,
      success: true,
      pagination: this.createPaginationMeta(total, page, limit)
    }
  }

  protected async executeWithPagination<T>(
    queryBuilder: any,
    page: number,
    limit: number
  ): Promise<PaginatedResponse<T>> {
    try {
      const offset = (page - 1) * limit

      // Get data with count
      const { data, error, count } = await queryBuilder
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false })

      if (error) {
        return this.createErrorResponse(error.message)
      }

      return this.createPaginatedResponse(
        data || [],
        count || 0,
        page,
        limit
      )
    } catch (error) {
      console.error("Pagination query error:", error)
      return this.createErrorResponse("Failed to fetch data")
    }
  }

  protected applyFilters(query: any, filters: FilterOptions): any {
    if (filters.search) {
      // Default search implementation - can be overridden in subclasses
      query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (filters.date_from) {
      query = query.gte("created_at", filters.date_from)
    }

    if (filters.date_to) {
      query = query.lte("created_at", filters.date_to)
    }

    // Apply user filter if userId is available
    if (this.userId) {
      query = query.eq("user_id", this.userId)
    }

    return query
  }

  protected setUserId(userId: string): void {
    this.userId = userId
  }

  protected getUserId(): string | null {
    return this.userId
  }

  // Utility method to validate UUID format
  protected isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  // Abstract methods that must be implemented by subclasses
  abstract getTableName(): string
  abstract getById(id: string): Promise<ServiceResponse<any>>
  abstract create(data: any): Promise<ServiceResponse<any>>
  abstract update(id: string, data: any): Promise<ServiceResponse<any>>
  abstract delete(id: string): Promise<ServiceResponse<boolean>>
  abstract list(
    options: PaginationOptions & { filters?: FilterOptions }
  ): Promise<PaginatedResponse<any>>
}