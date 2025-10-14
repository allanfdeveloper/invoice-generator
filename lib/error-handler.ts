import { NextRequest, NextResponse } from "next/server"
import { createErrorApiNextResponse, HTTP_STATUS, ERROR_MESSAGES } from "@/lib/types/api"
import { ZodError } from "zod"

export interface ErrorContext {
  userId?: string
  endpoint?: string
  method?: string
  ip?: string
  userAgent?: string
}

export class ApiError extends Error {
  public readonly statusCode: number
  public readonly code?: string
  public readonly context?: ErrorContext

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code?: string,
    context?: ErrorContext
  ) {
    super(message)
    this.name = "ApiError"
    this.statusCode = statusCode
    this.code = code
    this.context = context
  }
}

export class ValidationError extends ApiError {
  public readonly errors: Array<{ field: string; message: string }>

  constructor(errors: Array<{ field: string; message: string }>) {
    super("Validation failed", HTTP_STATUS.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR")
    this.name = "ValidationError"
    this.errors = errors
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, "NOT_FOUND")
    this.name = "NotFoundError"
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = ERROR_MESSAGES.UNAUTHORIZED) {
    super(message, HTTP_STATUS.UNAUTHORIZED, "UNAUTHORIZED")
    this.name = "UnauthorizedError"
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = ERROR_MESSAGES.FORBIDDEN) {
    super(message, HTTP_STATUS.FORBIDDEN, "FORBIDDEN")
    this.name = "ForbiddenError"
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = ERROR_MESSAGES.DUPLICATE_RECORD) {
    super(message, HTTP_STATUS.CONFLICT, "CONFLICT")
    this.name = "ConflictError"
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = ERROR_MESSAGES.RATE_LIMIT_EXCEEDED) {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, "RATE_LIMIT_EXCEEDED")
    this.name = "RateLimitError"
  }
}

export function handleApiError(error: unknown, context?: ErrorContext): NextResponse {
  // Log the error for debugging
  console.error("API Error:", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context
  })

  // Handle known API errors
  if (error instanceof ApiError) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          errors: error.errors
        },
        { status: error.statusCode }
      )
    }

    return createErrorApiNextResponse(error.message, error.statusCode)
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join("."),
      message: err.message
    }))

    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        errors: validationErrors
      },
      { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
    )
  }

  // Handle database errors
  if (isDatabaseError(error)) {
    const message = getDatabaseErrorMessage(error)
    const statusCode = getDatabaseErrorStatusCode(error)
    return createErrorApiNextResponse(message, statusCode)
  }

  // Handle generic errors
  const message = error instanceof Error ? error.message : "An unexpected error occurred"
  return createErrorApiNextResponse(message, HTTP_STATUS.INTERNAL_SERVER_ERROR)
}

function isDatabaseError(error: unknown): error is { code: string; message: string } {
  return typeof error === "object" && error !== null && "code" in error && "message" in error
}

function getDatabaseErrorMessage(error: { code: string; message: string }): string {
  switch (error.code) {
    case "23505":
      return ERROR_MESSAGES.DUPLICATE_RECORD
    case "23503":
      return ERROR_MESSAGES.FOREIGN_KEY_CONSTRAINT
    case "23502":
      return ERROR_MESSAGES.MISSING_REQUIRED_FIELD
    case "42501":
      return ERROR_MESSAGES.FORBIDDEN
    case "PGRST116":
      return ERROR_MESSAGES.NOT_FOUND
    default:
      return ERROR_MESSAGES.DATABASE_ERROR
  }
}

function getDatabaseErrorStatusCode(error: { code: string }): number {
  switch (error.code) {
    case "23505":
      return HTTP_STATUS.CONFLICT
    case "23503":
      return HTTP_STATUS.BAD_REQUEST
    case "23502":
      return HTTP_STATUS.BAD_REQUEST
    case "42501":
      return HTTP_STATUS.FORBIDDEN
    case "PGRST116":
      return HTTP_STATUS.NOT_FOUND
    default:
      return HTTP_STATUS.INTERNAL_SERVER_ERROR
  }
}

// Error context builder
export function createErrorContext(req: NextRequest): ErrorContext {
  return {
    ip: req.ip || req.headers.get("x-forwarded-for") || "unknown",
    userAgent: req.headers.get("user-agent") || "unknown",
    endpoint: req.url,
    method: req.method,
    userId: req.headers.get("x-user-id") || undefined
  }
}

// Async error wrapper for route handlers
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (error) {
      const req = args[0] as NextRequest
      const context = createErrorContext(req)
      return handleApiError(error, context)
    }
  }
}

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  req: NextRequest,
  limit: number = 100,
  windowMs: number = 60 * 1000 // 1 minute
): { success: boolean; remaining: number; resetTime: number } {
  const ip = req.ip || req.headers.get("x-forwarded-for") || "unknown"
  const now = Date.now()
  const windowStart = now - windowMs

  // Clean up old entries
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetTime < now) {
      rateLimitMap.delete(key)
    }
  }

  const current = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs }

  if (current.resetTime < now) {
    current.count = 0
    current.resetTime = now + windowMs
  }

  current.count++
  rateLimitMap.set(ip, current)

  return {
    success: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    resetTime: current.resetTime
  }
}

export function withRateLimit(
  limit: number = 100,
  windowMs: number = 60 * 1000
) {
  return function<T extends any[]>(
    handler: (...args: T) => Promise<Response>
  ) {
    return async (...args: T): Promise<Response> => {
      const req = args[0] as NextRequest
      const rateLimitResult = checkRateLimit(req, limit, windowMs)

      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED
          },
          {
            status: HTTP_STATUS.TOO_MANY_REQUESTS,
            headers: {
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
              "Retry-After": Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
            }
          }
        )
      }

      const response = await handler(...args)

      // Add rate limit headers to successful responses
      if (response.headers) {
        response.headers.set("X-RateLimit-Limit", limit.toString())
        response.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString())
        response.headers.set("X-RateLimit-Reset", rateLimitResult.resetTime.toString())
      }

      return response
    }
  }
}