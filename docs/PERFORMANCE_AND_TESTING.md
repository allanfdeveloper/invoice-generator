# Performance Optimization and Testing Guide

## Overview

This document provides comprehensive guidelines for testing and optimizing the Invoice Generator backend API for production deployment.

## Testing Strategy

### 1. Unit Testing

#### Service Layer Tests
Test individual service methods with mocked dependencies:

```typescript
// Example: QuoteService.test.ts
import { QuoteService } from '@/lib/services/quote-service'
import { getSupabaseServer } from '@/lib/supabase-server'

jest.mock('@/lib/supabase-server')

describe('QuoteService', () => {
  let quoteService: QuoteService
  let mockSupabase: jest.MockedFunction<typeof getSupabaseServer>

  beforeEach(() => {
    mockSupabase = getSupabaseServer as jest.MockedFunction<typeof getSupabaseServer>
    quoteService = new QuoteService('test-user-id')
  })

  it('should create a quote with auto-generated number', async () => {
    // Mock Supabase responses
    mockSupabase.mockReturnValue({
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockQuote, error: null })
    })

    const result = await quoteService.create(quoteData)

    expect(result.success).toBe(true)
    expect(result.data.quoteNumber).toMatch(/^QUOTE-\d{4}-\d{4}$/)
  })
})
```

#### Database Function Tests
Test stored procedures and database functions:

```typescript
// Example: DatabaseFunctions.test.ts
import { getSupabaseServer } from '@/lib/supabase-server'

describe('Database Functions', () => {
  it('should convert quote to invoice', async () => {
    const supabase = getSupabaseServer()

    const { data, error } = await supabase
      .rpc('convert_quote_to_invoice', { p_quote_id: 'test-quote-id' })

    expect(error).toBeNull()
    expect(data.success).toBe(true)
    expect(data.invoice_id).toBeDefined()
  })
})
```

### 2. Integration Testing

#### API Endpoint Tests
Test complete API workflows:

```typescript
// Example: QuotesAPI.test.ts
import { createApp } from '@/app/api/quotes/route'
import { NextRequest } from 'next/server'

describe('/api/quotes', () => {
  it('should create and retrieve a quote', async () => {
    // Create quote
    const createRequest = new NextRequest('http://localhost/api/quotes', {
      method: 'POST',
      headers: { 'x-user-id': 'test-user-id' },
      body: JSON.stringify(quoteData)
    })

    const createResponse = await createApp(createRequest)
    const createdQuote = await createResponse.json()

    expect(createResponse.status).toBe(201)
    expect(createdQuote.success).toBe(true)

    // Retrieve quote
    const getRequest = new NextRequest(`http://localhost/api/quotes/${createdQuote.data.id}`)
    const getResponse = await createApp(getRequest)

    expect(getResponse.status).toBe(200)
  })
})
```

#### Database Integration Tests
Test database operations with real data:

```typescript
// Example: DatabaseIntegration.test.ts
describe('Database Integration', () => {
  let supabase: SupabaseClient

  beforeAll(async () => {
    supabase = getSupabaseServer()
  })

  it('should maintain referential integrity', async () => {
    // Create client
    const { data: client } = await supabase
      .from('clients')
      .insert({ name: 'Test Client', company: 'Test Co', email: 'test@example.com', created_by_user_id: 'test-user' })
      .select()
      .single()

    // Create quote with client
    const { data: quote } = await supabase
      .from('quotes')
      .insert({ client_id: client.id, created_by_user_id: 'test-user' })
      .select()
      .single()

    expect(quote.client_id).toBe(client.id)

    // Verify RLS policies
    const { data: userQuotes } = await supabase
      .from('quotes')
      .select('*')

    expect(userQuotes.every(q => q.created_by_user_id === 'test-user')).toBe(true)
  })
})
```

### 3. End-to-End Testing

#### Complete User Workflows
Test real user scenarios:

```typescript
// Example: E2EWorkflows.test.ts
describe('Complete Workflows', () => {
  it('should handle quote-to-invoice conversion workflow', async () => {
    // 1. Create client
    const client = await createClient(clientData)

    // 2. Create quote
    const quote = await createQuote({ clientId: client.id, ...quoteData })

    // 3. Add items to quote
    await addItemsToQuote(quote.id, itemsData)

    // 4. Convert quote to invoice
    const invoice = await convertQuoteToInvoice(quote.id)

    // 5. Send invoice email
    await sendInvoiceEmail(invoice.id)

    // 6. Record payment
    await recordPayment(invoice.id, paymentData)

    // Verify final state
    const finalInvoice = await getInvoice(invoice.id)
    expect(finalInvoice.status).toBe('paid')
  })
})
```

### 4. Performance Testing

#### Load Testing
Test API performance under load:

```typescript
// Example: LoadTesting.test.ts
describe('Load Testing', () => {
  it('should handle 100 concurrent quote requests', async () => {
    const requests = Array(100).fill(null).map(() =>
      fetch('/api/quotes', {
        method: 'POST',
        headers: { 'x-user-id': `user-${Math.random()}` },
        body: JSON.stringify(quoteData)
      })
    )

    const startTime = Date.now()
    const responses = await Promise.all(requests)
    const endTime = Date.now()

    const responseTime = endTime - startTime
    const successRate = responses.filter(r => r.ok).length / responses.length

    expect(responseTime).toBeLessThan(5000) // 5 seconds max
    expect(successRate).toBeGreaterThan(0.95) // 95% success rate
  })
})
```

#### Database Performance
Test database query performance:

```sql
-- Performance test queries
EXPLAIN ANALYZE
SELECT q.*, c.name as client_name
FROM quotes q
JOIN clients c ON q.client_id = c.id
WHERE q.created_by_user_id = 'test-user-id'
AND q.status = 'draft'
ORDER BY q.created_at DESC
LIMIT 10;

-- Test indexing effectiveness
EXPLAIN ANALYZE
SELECT * FROM quotes
WHERE created_by_user_id = 'test-user-id'
AND status = 'draft';

-- Test RLS policy performance
EXPLAIN ANALYZE
SELECT COUNT(*) FROM quotes
WHERE created_by_user_id = 'test-user-id';
```

## Performance Optimization

### 1. Database Optimization

#### Indexing Strategy
Ensure proper indexes exist:

```sql
-- User isolation indexes (already created)
CREATE INDEX CONCURRENTLY idx_quotes_user_created_at ON quotes(created_by_user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_invoices_user_created_at ON invoices(created_by_user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_clients_user_created_at ON clients(created_by_user_id, created_at DESC);

-- Business logic indexes
CREATE INDEX CONCURRENTLY idx_quotes_status_created ON quotes(status, created_at DESC);
CREATE INDEX CONCURRENTLY idx_invoices_status_due ON invoices(status, due_date);
CREATE INDEX CONCURRENTLY idx_quotes_client_status ON quotes(client_id, status);

-- Full-text search indexes
CREATE INDEX CONCURRENTLY idx_clients_search ON clients USING gin(to_tsvector('english', name || ' ' || company));
CREATE INDEX CONCURRENTLY idx_quotes_search ON quotes USING gin(to_tsvector('english', notes || ' ' || quote_number));
```

#### Query Optimization
Optimize common queries:

```typescript
// Optimized quote listing with proper joins and selects
async getQuotesOptimized(options: QuoteListOptions): Promise<PaginatedResponse<QuoteWithRelations>> {
  const supabase = getSupabaseServer()

  let query = supabase
    .from('quotes')
    .select(`
      id,
      quote_number,
      status,
      date_issued,
      valid_until,
      subtotal_excl_vat,
      vat_amount,
      total_incl_vat,
      created_at,
      client_id,
      clients!inner (
        id,
        name,
        company
      )
    `, { count: 'exact' })
    .eq('created_by_user_id', this.userId)

  // Apply filters efficiently
  if (options.status) {
    query = query.eq('status', options.status)
  }

  if (options.clientId) {
    query = query.eq('client_id', options.clientId)
  }

  // Search optimization
  if (options.search) {
    query = query.or(`quote_number.ilike.%${options.search}%,notes.ilike.%${options.search}%`)
  }

  // Pagination
  const from = (options.page - 1) * options.limit
  query = query.range(from, from + options.limit - 1)
    .order('created_at', { ascending: false })

  const { data, error, count } = await query

  return {
    success: !error,
    data: data || [],
    pagination: {
      page: options.page,
      limit: options.limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / options.limit)
    }
  }
}
```

### 2. Caching Strategy

#### API Response Caching
Implement caching for frequently accessed data:

```typescript
// Cache service for expensive operations
import { cache } from '@/lib/cache'

class CachedQuoteService extends QuoteService {
  async getQuote(id: string): Promise<ServiceResponse<QuoteWithRelations>> {
    const cacheKey = `quote:${this.userId}:${id}`

    // Try cache first
    const cached = await cache.get(cacheKey)
    if (cached) {
      return this.createSuccessResponse(cached)
    }

    // Fetch from database
    const result = await super.getQuote(id)

    // Cache successful results for 5 minutes
    if (result.success && result.data) {
      await cache.set(cacheKey, result.data, 300)
    }

    return result
  }
}
```

#### Database Query Caching
Cache expensive database queries:

```typescript
// Memoize expensive calculations
const memoize = (fn: Function) => {
  const cache = new Map()
  return (...args: any[]) => {
    const key = JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)
    }
    const result = fn(...args)
    cache.set(key, result)
    return result
  }
}

export const calculateQuoteTotals = memoize(async (quoteId: string) => {
  const supabase = getSupabaseServer()

  const { data } = await supabase
    .rpc('calculate_quote_totals', { p_quote_id: quoteId })

  return data
})
```

### 3. API Optimization

#### Response Optimization
Optimize API responses:

```typescript
// Optimize response payloads
interface QuoteListResponse {
  quotes: Array<{
    id: string
    quoteNumber: string
    status: string
    totalInclVat: number
    client: {
      id: string
      name: string
      company: string
    }
    createdAt: string
  }>
  pagination: PaginationInfo
}

// Field selection for reduced payload
async getQuotesMinimal(options: QuoteListOptions): Promise<ServiceResponse<QuoteListResponse>> {
  const supabase = getSupabaseServer()

  const { data, error } = await supabase
    .from('quotes')
    .select(`
      id,
      quote_number,
      status,
      total_incl_vat,
      created_at,
      client_id,
      clients!inner(id, name, company)
    `)
    .eq('created_by_user_id', this.userId)
    .range((options.page - 1) * options.limit, options.page * options.limit - 1)

  return this.createSuccessResponse({
    quotes: data || [],
    pagination: { /* pagination data */ }
  })
}
```

#### Batch Operations
Implement batch operations for efficiency:

```typescript
// Batch item creation
async createQuoteItems(quoteId: string, items: CreateItemRequest[]): Promise<ServiceResponse<QuoteItem[]>> {
  const supabase = getSupabaseServer()

  // Prepare batch insert data
  const itemsData = items.map(item => ({
    quote_id: quoteId,
    item_id: item.id,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: item.quantity * item.unitPrice,
    created_at: new Date().toISOString()
  }))

  const { data, error } = await supabase
    .from('quote_items')
    .insert(itemsData)
    .select()

  return error
    ? this.createErrorResponse(this.handleSupabaseError(error))
    : this.createSuccessResponse(data)
}
```

### 4. Monitoring and Metrics

#### Performance Monitoring
Implement performance tracking:

```typescript
// Performance monitoring middleware
export function withPerformanceTracking<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  name: string
) {
  return async (...args: T): Promise<R> => {
    const startTime = performance.now()

    try {
      const result = await fn(...args)
      const duration = performance.now() - startTime

      // Log performance metrics
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`)

      // Send to monitoring service
      if (duration > 1000) { // Log slow operations
        console.warn(`[Slow Operation] ${name}: ${duration.toFixed(2)}ms`)
      }

      return result
    } catch (error) {
      const duration = performance.now() - startTime
      console.error(`[Error] ${name}: ${duration.toFixed(2)}ms`, error)
      throw error
    }
  }
}

// Usage
const optimizedGetQuotes = withPerformanceTracking(
  getQuotes.bind(this),
  'getQuotes'
)
```

#### Database Performance Metrics
Track database performance:

```sql
-- Create performance monitoring view
CREATE VIEW performance_metrics AS
SELECT
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public';

-- Monitor slow queries
CREATE TABLE slow_queries (
  id SERIAL PRIMARY KEY,
  query TEXT,
  duration NUMERIC,
  executed_at TIMESTAMP DEFAULT NOW(),
  user_id TEXT
);

-- Log slow queries (trigger function)
CREATE OR REPLACE FUNCTION log_slow_query()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.duration > 1000) THEN -- Log queries over 1 second
    INSERT INTO slow_queries (query, duration)
    VALUES (current_query(), NEW.duration);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Security Testing

### 1. Authentication Testing
```typescript
describe('Authentication Security', () => {
  it('should reject requests without authentication', async () => {
    const response = await fetch('/api/quotes', {
      method: 'GET'
      // No x-user-id header
    })

    expect(response.status).toBe(401)
  })

  it('should prevent user data access across accounts', async () => {
    // User A creates data
    const userAQuote = await createQuoteForUser('user-a')

    // User B tries to access User A's data
    const response = await fetch(`/api/quotes/${userAQuote.id}`, {
      headers: { 'x-user-id': 'user-b' }
    })

    expect(response.status).toBe(404)
  })
})
```

### 2. Input Validation Testing
```typescript
describe('Input Validation Security', () => {
  it('should prevent SQL injection', async () => {
    const maliciousInput = "'; DROP TABLE quotes; --"

    const response = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'x-user-id': 'test-user' },
      body: JSON.stringify({
        clientId: maliciousInput,
        // ... other fields
      })
    })

    expect(response.status).toBe(422) // Should be caught by validation

    // Verify quotes table still exists
    const quotes = await supabase.from('quotes').select('count')
    expect(quotes.error).toBeNull()
  })
})
```

## Deployment Checklist

### Pre-deployment Testing
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] End-to-end tests passing
- [ ] Performance benchmarks met
- [ ] Security tests passing
- [ ] Database migrations tested
- [ ] RLS policies verified
- [ ] Rate limiting tested
- [ ] Error handling verified
- [ ] Documentation updated

### Performance Benchmarks
- API response time < 200ms (95th percentile)
- Database queries < 100ms average
- Concurrent user support: 100+
- Memory usage < 512MB per instance
- CPU usage < 70% under normal load

### Security Verification
- All endpoints require authentication
- RLS policies prevent data leakage
- Input validation prevents injection
- Rate limiting prevents abuse
- HTTPS enforced in production
- Sensitive data encrypted

### Monitoring Setup
- Application performance monitoring
- Database performance metrics
- Error tracking and alerting
- Security event logging
- Resource utilization monitoring

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Test and Deploy

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Run performance tests
        run: npm run test:performance

      - name: Security audit
        run: npm audit --audit-level=high

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: echo "Deploy to production"
```

This comprehensive testing and optimization guide ensures the Invoice Generator API is production-ready with proper performance, security, and reliability measures in place.