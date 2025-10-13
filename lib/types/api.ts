// Standard API response types for all endpoints

export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
  success?: boolean
}

export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export interface ValidationError {
  field: string
  message: string
}

export interface ApiError extends ApiResponse {
  errors?: ValidationError[]
}

export interface CountResponse {
  count: number
}

export interface DeleteResponse {
  success: boolean
  deleted: number
}

export interface BulkOperationResponse<T> {
  created: T[]
  updated: T[]
  failed: Array<{
    item: any
    error: string
  }>
  summary: {
    total: number
    created: number
    updated: number
    failed: number
  }
}

// HTTP status codes mapping
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

// Success response creators
export function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    data,
    success: true,
    message
  }
}

export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginatedApiResponse<T>["pagination"],
  message?: string
): PaginatedApiResponse<T> {
  return {
    data,
    success: true,
    message,
    pagination
  }
}

// Error response creators
export function createErrorResponse(error: string, status?: keyof typeof HTTP_STATUS): ApiError {
  return {
    success: false,
    error
  }
}

export function createValidationErrorResponse(
  errors: ValidationError[]
): ApiError {
  return {
    success: false,
    error: "Validation failed",
    errors
  }
}

// Common error messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: "Unauthorized access",
  FORBIDDEN: "Access forbidden",
  NOT_FOUND: "Resource not found",
  VALIDATION_FAILED: "Validation failed",
  INTERNAL_ERROR: "Internal server error",
  DATABASE_ERROR: "Database operation failed",
  INVALID_UUID: "Invalid ID format",
  MISSING_REQUIRED_FIELD: "Required field is missing",
  DUPLICATE_RECORD: "Record already exists",
  FOREIGN_KEY_CONSTRAINT: "Referenced record does not exist",
  RATE_LIMIT_EXCEEDED: "Too many requests, please try again later",
} as const

// Query parameter types for API endpoints
export interface PaginationParams {
  page?: string
  limit?: string
}

export interface SearchParams {
  search?: string
  status?: string
  date_from?: string
  date_to?: string
  sort_by?: string
  sort_order?: "asc" | "desc"
}

export interface CommonQueryParams extends PaginationParams, SearchParams {
  [key: string]: string | string[] | undefined
}

// Default pagination values
export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 100,
} as const

// Helper function to parse pagination parameters
export function parsePaginationParams(params: CommonQueryParams) {
  const page = Math.max(parseInt(params.page || "1", 10), 1)
  const limit = Math.min(
    Math.max(parseInt(params.limit || "10", 10), 1),
    DEFAULT_PAGINATION.MAX_LIMIT
  )

  return { page, limit }
}

// Helper function to parse filters
export function parseFilters(params: CommonQueryParams) {
  const filters: Record<string, any> = {}

  if (params.search) filters.search = params.search
  if (params.status) filters.status = params.status
  if (params.date_from) filters.date_from = params.date_from
  if (params.date_to) filters.date_to = params.date_to

  return filters
}

// Type for Next.js route handlers
export type ApiHandler<T = any> = (
  req: Request,
  context?: { params?: Promise<any> }
) => Promise<Response>

// Export NextResponse helpers for consistent responses
import { NextResponse } from "next/server"

export function createApiNextResponse<T>(
  data: T,
  status: number = HTTP_STATUS.OK,
  message?: string
) {
  return NextResponse.json(
    createSuccessResponse(data, message),
    { status }
  )
}

export function createPaginatedApiNextResponse<T>(
  data: T[],
  pagination: PaginatedApiResponse<T>["pagination"],
  status: number = HTTP_STATUS.OK,
  message?: string
) {
  return NextResponse.json(
    createPaginatedResponse(data, pagination, message),
    { status }
  )
}

export function createErrorApiNextResponse(
  error: string,
  status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR
) {
  return NextResponse.json(
    createErrorResponse(error),
    { status }
  )
}

export function createValidationErrorApiNextResponse(
  errors: ValidationError[],
  status: number = HTTP_STATUS.UNPROCESSABLE_ENTITY
) {
  return NextResponse.json(
    createValidationErrorResponse(errors),
    { status }
  )
}