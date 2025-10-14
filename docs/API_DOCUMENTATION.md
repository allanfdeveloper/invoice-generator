# Invoice Generator API Documentation

## Overview

This document provides comprehensive documentation for the Invoice Generator REST API. The API provides complete CRUD operations for managing quotes, invoices, clients, items, packages, and company settings with proper user isolation and security.

## Base URL

```
https://your-domain.com/api
```

## Authentication

All API endpoints require authentication via the `x-user-id` header:

```
x-user-id: <user-id>
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": <response-data>,
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "errors": [
    {
      "field": "field_name",
      "message": "Validation error message"
    }
  ]
}
```

## HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Unprocessable Entity (Validation Error)
- `429` - Too Many Requests (Rate Limited)
- `500` - Internal Server Error

## API Endpoints

### Quotes API

#### Get All Quotes
```
GET /api/quotes
```

**Query Parameters:**
- `page` (number, default: 1) - Page number for pagination
- `limit` (number, default: 10) - Items per page
- `status` (string) - Filter by quote status
- `clientId` (string) - Filter by client ID
- `search` (string) - Search in quote number and notes

**Response:**
```json
{
  "success": true,
  "data": {
    "quotes": [
      {
        "id": "uuid",
        "quoteNumber": "QUOTE-2024-0001",
        "status": "draft",
        "dateIssued": "2024-01-01",
        "validUntil": "2024-01-31",
        "subtotalExclVat": 1000.00,
        "vatAmount": 150.00,
        "totalInclVat": 1150.00,
        "client": {
          "id": "uuid",
          "name": "Client Name",
          "company": "Client Company"
        },
        "items": [...],
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

#### Get Quote by ID
```
GET /api/quotes/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "quoteNumber": "QUOTE-2024-0001",
    "status": "draft",
    "dateIssued": "2024-01-01",
    "validUntil": "2024-01-31",
    "subtotalExclVat": 1000.00,
    "vatAmount": 150.00,
    "totalInclVat": 1150.00,
    "client": {...},
    "items": [...],
    "notes": "Optional notes",
    "termsText": "Custom terms",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Create Quote
```
POST /api/quotes
```

**Request Body:**
```json
{
  "clientId": "uuid",
  "dateIssued": "2024-01-01",
  "validUntil": "2024-01-31",
  "depositPercentage": 20.0,
  "notes": "Optional notes",
  "termsText": "Custom terms",
  "items": [
    {
      "description": "Web Development",
      "unitPrice": 1000.00,
      "quantity": 1,
      "taxable": true,
      "itemType": "fixed",
      "unit": "each"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "quoteNumber": "QUOTE-2024-0001",
    // ... full quote object
  },
  "message": "Quote created successfully"
}
```

#### Update Quote
```
PUT /api/quotes/{id}
```

**Request Body:** Same as create quote

#### Delete Quote
```
DELETE /api/quotes/{id}
```

#### Convert Quote to Invoice
```
POST /api/quotes/{id}/convert-to-invoice
```

**Request Body:**
```json
{
  "dueDate": "2024-02-01",
  "depositRequired": true,
  "paymentInstructions": {
    "bank": "Bank Name",
    "accountName": "Account Name",
    "accountNumber": "123456789"
  }
}
```

### Invoices API

#### Get All Invoices
```
GET /api/invoices
```

**Query Parameters:** Same as quotes API

#### Get Invoice by ID
```
GET /api/invoices/{id}
```

#### Create Invoice
```
POST /api/invoices
```

**Request Body:**
```json
{
  "clientId": "uuid",
  "dateIssued": "2024-01-01",
  "dueDate": "2024-02-01",
  "depositRequired": true,
  "paymentInstructions": {
    "bank": "Bank Name",
    "accountName": "Account Name",
    "accountNumber": "123456789",
    "branchCode": "1234",
    "swift": "ABCDZA"
  },
  "items": [
    {
      "description": "Web Development",
      "unitPrice": 1000.00,
      "quantity": 1,
      "taxable": true,
      "itemType": "fixed",
      "unit": "each"
    }
  ]
}
```

#### Update Invoice
```
PUT /api/invoices/{id}
```

#### Delete Invoice
```
DELETE /api/invoices/{id}
```

#### Record Payment
```
POST /api/invoices/{id}/record-payment
```

**Request Body:**
```json
{
  "amount": 500.00,
  "paymentDate": "2024-01-15",
  "notes": "Partial payment"
}
```

#### Update Invoice Status
```
PUT /api/invoices/{id}/status
```

**Request Body:**
```json
{
  "status": "sent"
}
```

### Clients API

#### Get All Clients
```
GET /api/clients
```

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 10)
- `search` (string) - Search in name, company, email

#### Get Client by ID
```
GET /api/clients/{id}
```

#### Create Client
```
POST /api/clients
```

**Request Body:**
```json
{
  "name": "John Doe",
  "company": "Client Company",
  "email": "john@clientcompany.com",
  "billingAddress": "123 Street, City, Country",
  "deliveryAddress": "456 Avenue, City, Country",
  "vatNumber": "VAT123456",
  "phone": "+27 21 123 4567"
}
```

#### Update Client
```
PUT /api/clients/{id}
```

#### Delete Client
```
DELETE /api/clients/{id}
```

### Items API

#### Get All Items
```
GET /api/items
```

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 10)
- `type` (string) - Filter by item type
- `search` (string) - Search in description

#### Get Item by ID
```
GET /api/items/{id}
```

#### Create Item
```
POST /api/items
```

**Request Body:**
```json
{
  "description": "Web Development Service",
  "unitPrice": 1000.00,
  "quantity": 1,
  "taxable": true,
  "itemType": "fixed",
  "unit": "each"
}
```

#### Update Item
```
PUT /api/items/{id}
```

#### Delete Item
```
DELETE /api/items/{id}
```

### Packages API

#### Get All Packages
```
GET /api/packages
```

#### Get Package by ID
```
GET /api/packages/{id}
```

#### Create Package
```
POST /api/packages
```

**Request Body:**
```json
{
  "name": "Web Development Package",
  "description": "Complete web development solution",
  "priceExclVat": 5000.00,
  "priceInclVat": 5750.00,
  "items": [
    {
      "description": "Frontend Development",
      "unitPrice": 2000.00,
      "quantity": 1,
      "taxable": true,
      "itemType": "fixed",
      "unit": "each"
    },
    {
      "description": "Backend Development",
      "unitPrice": 2500.00,
      "quantity": 1,
      "taxable": true,
      "itemType": "fixed",
      "unit": "each"
    }
  ]
}
```

#### Update Package
```
PUT /api/packages/{id}
```

#### Delete Package
```
DELETE /api/packages/{id}
```

### Company Settings API

#### Get Company Settings
```
GET /api/company/settings
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "companyName": "My Company",
    "address": "123 Business Street",
    "email": "business@company.com",
    "phone": "+27 21 123 4567",
    "logoUrl": "https://example.com/logo.png",
    "currency": "ZAR",
    "vatPercentage": 15.00,
    "numberingFormatInvoice": "INV-{year}-{number:04d}",
    "numberingFormatQuote": "QUOTE-{year}-{number:04d}",
    "nextInvoiceNumber": 1,
    "nextQuoteNumber": 1,
    "termsText": "Payment due within 30 days",
    "paymentInstructions": {
      "bank": "Bank Name",
      "accountName": "Account Name",
      "accountNumber": "123456789",
      "branchCode": "1234",
      "swift": "ABCDZA"
    }
  }
}
```

#### Update Company Settings
```
PUT /api/company/settings
```

**Request Body:**
```json
{
  "companyName": "My Company",
  "address": "123 Business Street",
  "email": "business@company.com",
  "phone": "+27 21 123 4567",
  "currency": "ZAR",
  "vatPercentage": 15.00,
  "numberingFormatInvoice": "INV-{year}-{number:04d}",
  "numberingFormatQuote": "QUOTE-{year}-{number:04d}",
  "termsText": "Payment due within 30 days",
  "paymentInstructions": {
    "bank": "Bank Name",
    "accountName": "Account Name",
    "accountNumber": "123456789",
    "branchCode": "1234",
    "swift": "ABCDZA"
  }
}
```

#### Upload Company Logo
```
POST /api/company/logo
```

**Request:** `multipart/form-data`
- `file` (File) - Image file (JPEG, PNG, WebP, SVG, max 5MB)

#### Delete Company Logo
```
DELETE /api/company/logo
```

#### Get Payment Instructions
```
GET /api/company/payment-instructions
```

#### Update Payment Instructions
```
PUT /api/company/payment-instructions
```

**Request Body:**
```json
{
  "bank": "Bank Name",
  "accountName": "Account Name",
  "accountNumber": "123456789",
  "branchCode": "1234",
  "swift": "ABCDZA"
}
```

### Email Notifications API

#### Send Quote Email
```
POST /api/emails/send-quote
```

**Request Body:**
```json
{
  "quoteId": "uuid",
  "clientName": "John Doe",
  "clientEmail": "john@example.com",
  "quoteNumber": "QUOTE-2024-0001",
  "quoteTotal": 1150.00,
  "validUntil": "2024-01-31",
  "companyName": "My Company",
  "companyEmail": "business@company.com",
  "companyPhone": "+27 21 123 4567",
  "quoteUrl": "https://example.com/quotes/uuid"
}
```

#### Send Invoice Email
```
POST /api/emails/send-invoice
```

**Request Body:**
```json
{
  "invoiceId": "uuid",
  "clientName": "John Doe",
  "clientEmail": "john@example.com",
  "invoiceNumber": "INV-2024-0001",
  "invoiceTotal": 1150.00,
  "dueDate": "2024-02-01",
  "companyName": "My Company",
  "companyEmail": "business@company.com",
  "companyPhone": "+27 21 123 4567",
  "invoiceUrl": "https://example.com/invoices/uuid"
}
```

#### Send Payment Reminder
```
POST /api/emails/payment-reminder
```

**Request Body:**
```json
{
  "invoiceId": "uuid"
}
```

## Error Handling

### Validation Errors (422)
```json
{
  "success": false,
  "error": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Authorization Errors (401)
```json
{
  "success": false,
  "error": "User authentication required"
}
```

### Not Found Errors (404)
```json
{
  "success": false,
  "error": "Quote not found"
}
```

### Rate Limiting (429)
```json
{
  "success": false,
  "error": "Too many requests"
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- Standard endpoints: 100 requests per minute
- Email endpoints: 10 requests per minute
- Payment reminders: 5 requests per minute

## Security

- All data is isolated by user ID
- Row Level Security (RLS) policies enforce data access
- Authentication required for all endpoints
- Input validation and sanitization
- SQL injection protection

## Pagination

List endpoints support pagination:

```
GET /api/quotes?page=2&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "quotes": [...],
    "pagination": {
      "page": 2,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

## Filtering and Searching

Most list endpoints support filtering and searching:

```
GET /api/quotes?status=draft&clientId=uuid&search=web
```

## Database Functions

The API includes several database functions for complex operations:

- `convert_quote_to_invoice()` - Convert quote to invoice
- `generate_quote_number()` - Generate next quote number
- `generate_invoice_number()` - Generate next invoice number
- `calculate_quote_totals()` - Calculate quote totals
- `calculate_invoice_totals()` - Calculate invoice totals
- `can_modify_quote()` - Check if quote can be modified
- `can_modify_invoice()` - Check if invoice can be modified
- `record_payment()` - Record invoice payment
- `get_overdue_invoices()` - Get overdue invoices
- `get_client_statistics()` - Get client statistics

## Auto-numbering

Quotes and invoices are automatically numbered when created:

- Format: `QUOTE-{year}-{number:04d}` and `INV-{year}-{number:04d}`
- Numbers are per-user and automatically increment
- Custom formats can be set in company settings

## Storage

File uploads are handled through Supabase Storage:

- Company logos: `company-logos` bucket
- User avatars: `user-avatars` bucket
- Files are isolated by user ID
- Supported formats: JPEG, PNG, WebP, SVG
- Maximum file size: 5MB

## Examples

### Creating a Quote with Items

```bash
curl -X POST https://your-domain.com/api/quotes \
  -H "Content-Type: application/json" \
  -H "x-user-id: your-user-id" \
  -d '{
    "clientId": "client-uuid",
    "dateIssued": "2024-01-01",
    "validUntil": "2024-01-31",
    "items": [
      {
        "description": "Web Development",
        "unitPrice": 1000.00,
        "quantity": 1,
        "taxable": true,
        "itemType": "fixed",
        "unit": "each"
      }
    ]
  }'
```

### Recording a Payment

```bash
curl -X POST https://your-domain.com/api/invoices/invoice-uuid/record-payment \
  -H "Content-Type: application/json" \
  -H "x-user-id: your-user-id" \
  -d '{
    "amount": 500.00,
    "paymentDate": "2024-01-15",
    "notes": "Partial payment"
  }'
```

### Sending a Quote Email

```bash
curl -X POST https://your-domain.com/api/emails/send-quote \
  -H "Content-Type: application/json" \
  -H "x-user-id: your-user-id" \
  -d '{
    "quoteId": "quote-uuid",
    "clientName": "John Doe",
    "clientEmail": "john@example.com",
    "quoteNumber": "QUOTE-2024-0001",
    "quoteTotal": 1150.00,
    "validUntil": "2024-01-31",
    "companyName": "My Company",
    "companyEmail": "business@company.com",
    "companyPhone": "+27 21 123 4567"
  }'
```

## Support

For API support and questions, please contact development team or refer to the GitHub repository.