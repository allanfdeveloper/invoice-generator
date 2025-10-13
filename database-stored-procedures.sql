-- Database Stored Procedures for Invoice Generator
-- These functions handle complex business logic that should be executed on the database server
-- for better performance, atomicity, and consistency

-- Quote to Invoice Conversion Function
-- This function converts a quote to an invoice while maintaining data integrity
CREATE OR REPLACE FUNCTION convert_quote_to_invoice(p_quote_id UUID)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  invoice_id UUID,
  quote_id UUID
) LANGUAGE plpgsql AS $$
DECLARE
  v_invoice_id UUID;
  v_quote RECORD;
  v_company_settings RECORD;
  v_client RECORD;
  v_current_date TIMESTAMP WITH TIME ZONE := NOW();
  v_quote_items RECORD[];
  v_invoice_items_to_insert RECORD[];
BEGIN
  -- Get quote details with validation
  SELECT * INTO v_quote
  FROM quotes
  WHERE id = p_quote_id AND status != 'converted';

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Quote not found or already converted'::TEXT, NULL::UUID, p_quote_id;
  END IF;

  -- Get company settings for numbering
  SELECT * INTO v_company_settings
  FROM company_settings
  LIMIT 1;

  -- Get client information
  SELECT * INTO v_client
  FROM clients
  WHERE id = v_quote.client_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Associated client not found'::TEXT, NULL::UUID, p_quote_id;
  END IF;

  -- Start transaction for atomic operation
  BEGIN

    -- Create invoice from quote data
    INSERT INTO invoices (
      invoice_number,
      client_id,
      created_by_user_id,
      date_issued,
      due_date,
      status,
      subtotal_excl_vat,
      vat_amount,
      total_incl_vat,
      deposit_required,
      deposit_amount,
      balance_remaining,
      notes,
      terms_text,
      created_from_quote_id,
      created_at
    )
    SELECT
      COALESCE(v_company_settings.numbering_format_invoice, 'INV-{year}-{number:04d}'),
      v_quote.client_id,
      v_quote.created_by_user_id,
      v_current_date,
      v_current_date + INTERVAL '30 days',
      'draft',
      v_quote.subtotal_excl_vat,
      v_quote.vat_amount,
      v_quote.total_incl_vat,
      v_quote.deposit_required,
      v_quote.deposit_amount,
      v_quote.balance_remaining,
      v_quote.notes,
      v_quote.terms_text,
      v_quote.id,
      v_current_date
    RETURNING id INTO v_invoice_id;

    -- Get quote items for conversion
    SELECT
      qi.item_id,
      qi.quantity,
      qi.unit_price,
      qi.total_price,
      i.description,
      i.unit,
      i.taxable,
      i.item_type
    INTO v_quote_items
    FROM quote_items qi
    JOIN items i ON qi.item_id = i.id
    WHERE qi.quote_id = p_quote_id;

    -- Convert quote items to invoice items
    IF v_quote_items IS NOT NULL THEN
      FOR item IN SELECT * FROM v_quote_items LOOP
        INSERT INTO invoice_items (
          invoice_id,
          item_id,
          quantity,
          unit_price,
          total_price,
          created_at
        )
        VALUES (
          v_invoice_id,
          item.item_id,
          item.quantity,
          item.unit_price,
          item.total_price,
          v_current_date
        );
      END LOOP;
    END IF;

    -- Update quote status to converted
    UPDATE quotes
    SET
      status = 'converted',
      updated_at = v_current_date
    WHERE id = p_quote_id;

    -- Update next invoice number
    UPDATE company_settings
    SET
      next_invoice_number = next_invoice_number + 1,
      updated_at = v_current_date;

    COMMIT;

    -- Return success result
    RETURN QUERY
      SELECT TRUE,
             'Quote converted to invoice successfully'::TEXT,
             v_invoice_id,
             p_quote_id;

  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      RETURN QUERY
        SELECT FALSE,
               'Error converting quote: ' || SQLERRM || ' - ' || SQLSTATE,
               NULL::UUID,
               p_quote_id;
  END;
END;
$$;

-- Generate Quote Number Function
-- This function generates the next available quote number
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TEXT AS $$
DECLARE
  v_company_settings RECORD;
  v_next_number INTEGER;
  v_current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_format TEXT;
BEGIN
  -- Get company settings
  SELECT * INTO v_company_settings
  FROM company_settings
  LIMIT 1;

  -- Get current next number or default to 1
  v_next_number := COALESCE(v_company_settings.next_quote_number, 1);
  v_format := COALESCE(v_company_settings.numbering_format_quote, 'QUOTE-{year}-{number:04d}');

  -- Update next number for future use
  UPDATE company_settings
  SET
    next_quote_number = v_next_number + 1,
    updated_at = NOW();

  -- Generate and return formatted quote number
  RETURN REPLACE(
    REPLACE(v_format, '{year}', v_current_year::TEXT),
    '{number:04d}',
    LPAD(v_next_number::TEXT, 4, '0')
  );
END;
$$;

-- Generate Invoice Number Function
-- This function generates the next available invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  v_company_settings RECORD;
  v_next_number INTEGER;
  v_current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_format TEXT;
BEGIN
  -- Get company settings
  SELECT * INTO v_company_settings
  FROM company_settings
  LIMIT 1;

  -- Get current next number or default to 1
  v_next_number := COALESCE(v_company_settings.next_invoice_number, 1);
  v_format := COALESCE(v_company_settings.numbering_format_invoice, 'INV-{year}-{number:04d}');

  -- Update next number for future use
  UPDATE company_settings
  SET
    next_invoice_number = v_next_number + 1,
    updated_at = NOW();

  -- Generate and return formatted invoice number
  RETURN REPLACE(
    REPLACE(v_format, '{year}', v_current_year::TEXT),
    '{number:04d}',
    LPAD(v_next_number::TEXT, 4, '0')
  );
END;
$$;

-- Calculate Quote Totals Function
-- This function calculates the subtotal, VAT, and total for a quote
CREATE OR REPLACE FUNCTION calculate_quote_totals(p_quote_id UUID)
RETURNS TABLE(
  subtotal DECIMAL,
  vat_amount DECIMAL,
  total DECIMAL,
  item_count INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
  v_subtotal DECIMAL := 0;
  v_vat_amount DECIMAL := 0;
  v_total DECIMAL := 0;
  v_item_count INTEGER := 0;
  v_vat_percentage DECIMAL := 0.15; -- Default 15% VAT
BEGIN
  -- Get company VAT percentage
  SELECT COALESCE(vat_percentage, 0.15) INTO v_vat_percentage
  FROM company_settings
  LIMIT 1;

  -- Calculate totals from quote items
  SELECT
    COALESCE(SUM(CASE
      WHEN i.taxable THEN qi.total_price
      ELSE 0
    END), 0) as subtotal,
    COALESCE(SUM(CASE
      WHEN i.taxable THEN qi.total_price * v_vat_percentage
      ELSE 0
    END), 0) as vat_amount,
    COUNT(*) as item_count
  INTO v_subtotal, v_vat_amount, v_item_count
  FROM quote_items qi
  JOIN items i ON qi.item_id = i.id
  WHERE qi.quote_id = p_quote_id
  GROUP BY qi.quote_id;

  -- Calculate total
  v_total := v_subtotal + v_vat_amount;

  -- Return calculated values
  RETURN QUERY
    SELECT v_subtotal, v_vat_amount, v_total, v_item_count;
END;
$$;

-- Calculate Invoice Totals Function
-- This function calculates the subtotal, VAT, and total for an invoice
CREATE OR REPLACE FUNCTION calculate_invoice_totals(p_invoice_id UUID)
RETURNS TABLE(
  subtotal DECIMAL,
  vat_amount DECIMAL,
  total DECIMAL,
  item_count INTEGER,
  deposit_amount DECIMAL,
  balance_remaining DECIMAL
) LANGUAGE plpgsql AS $$
DECLARE
  v_subtotal DECIMAL := 0;
  v_vat_amount DECIMAL := 0;
  v_total DECIMAL := 0;
  v_item_count INTEGER := 0;
  v_deposit_amount DECIMAL := 0;
  v_balance_remaining DECIMAL := 0;
  v_vat_percentage DECIMAL := 0.15; -- Default 15% VAT
BEGIN
  -- Get company VAT percentage
  SELECT COALESCE(vat_percentage, 0.15) INTO v_vat_percentage
  FROM company_settings
  LIMIT 1;

  -- Get invoice deposit info
  SELECT
    deposit_amount,
    balance_remaining
  INTO v_deposit_amount, v_balance_remaining
  FROM invoices
  WHERE id = p_invoice_id;

  -- Calculate totals from invoice items
  SELECT
    COALESCE(SUM(CASE
      WHEN i.taxable THEN ii.total_price
      ELSE 0
    END), 0) as subtotal,
    COALESCE(SUM(CASE
      WHEN i.taxable THEN ii.total_price * v_vat_percentage
      ELSE 0
    END), 0) as vat_amount,
    COUNT(*) as item_count
  INTO v_subtotal, v_vat_amount, v_item_count
  FROM invoice_items ii
  JOIN items i ON ii.item_id = i.id
  WHERE ii.invoice_id = p_invoice_id
  GROUP BY ii.invoice_id;

  -- Calculate total
  v_total := v_subtotal + v_vat_amount;

  -- Return calculated values
  RETURN QUERY
    SELECT v_subtotal, v_vat_amount, v_total, v_item_count, v_deposit_amount, v_balance_remaining;
END;
$$;

-- Check Quote Status Function
-- This function validates if a quote can be converted or modified
CREATE OR REPLACE FUNCTION can_modify_quote(p_quote_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_quote_status TEXT;
  v_quote_user_id UUID;
BEGIN
  -- Get quote status and user
  SELECT status, created_by_user_id INTO v_quote_status, v_quote_user_id
  FROM quotes
  WHERE id = p_quote_id;

  -- Quote can be modified if it's not accepted or converted and belongs to the user
  RETURN v_quote_user_id = p_user_id
    AND v_quote_status NOT IN ('accepted', 'converted');
END;
$$;

-- Check Invoice Status Function
-- This function validates if an invoice can be modified
CREATE OR REPLACE FUNCTION can_modify_invoice(p_invoice_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_invoice_status TEXT;
  v_invoice_user_id UUID;
BEGIN
  -- Get invoice status and user
  SELECT status, created_by_user_id INTO v_invoice_status, v_invoice_user_id
  FROM invoices
  WHERE id = p_invoice_id;

  -- Invoice can be modified if it's not paid and belongs to the user
  RETURN v_invoice_user_id = p_user_id
    AND v_invoice_status != 'paid';
END;
$$;

-- Update Invoice Status Function
-- This function updates invoice status and handles related logic
CREATE OR REPLACE FUNCTION update_invoice_status(
  p_invoice_id UUID,
  p_new_status TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
  v_invoice_user_id UUID;
  v_current_date TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- Get current status and user
  SELECT status, created_by_user_id INTO v_current_status, v_invoice_user_id
  FROM invoices
  WHERE id = p_invoice_id;

  -- Only user who created the invoice can change its status
  IF v_invoice_user_id != p_user_id THEN
    RETURN FALSE;
  END IF;

  -- Validate status transitions
  IF p_new_status = 'sent' AND v_current_status = 'draft' THEN
    -- Set issue date when sending invoice
    UPDATE invoices
    SET
      status = p_new_status,
      date_issued = v_current_date,
      updated_at = v_current_date
    WHERE id = p_invoice_id;

  ELSIF p_new_status = 'paid' AND v_current_status IN ('sent', 'partially_paid') THEN
    -- Mark as paid
    UPDATE invoices
    SET
      status = p_new_status,
      balance_remaining = 0,
      updated_at = v_current_date
    WHERE id = p_invoice_id;

  ELSIF p_new_status = 'overdue' AND v_current_status = 'sent' THEN
    -- Mark as overdue if due date has passed
    UPDATE invoices
    SET
      status = p_new_status,
      updated_at = v_current_date
    WHERE id = p_invoice_id
      AND due_date < v_current_date;

  ELSIF p_new_status IN ('draft', 'sent', 'partially_paid') THEN
    -- Allow these status changes
    UPDATE invoices
    SET
      status = p_new_status,
      updated_at = v_current_date
    WHERE id = p_invoice_id;

  ELSE
    -- Invalid status transition
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- Record Payment Function
-- This function records a payment for an invoice and updates the balance
CREATE OR REPLACE FUNCTION record_payment(
  p_invoice_id UUID,
  p_amount DECIMAL,
  p_payment_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_user_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  new_balance DECIMAL,
  payment_id UUID
) LANGUAGE plpgsql AS $$
DECLARE
  v_current_balance DECIMAL;
  v_invoice_status TEXT;
  v_payment_id UUID;
  v_current_date TIMESTAMP WITH TIME ZONE := COALESCE(p_payment_date, NOW());
  v_new_status TEXT;
BEGIN
  -- Lock the invoice for update
  LOCK TABLE invoices IN EXCLUSIVE MODE;

  -- Get current balance and status
  SELECT balance_remaining, status INTO v_current_balance, v_invoice_status
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  -- Validate payment amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, 'Payment amount must be positive'::TEXT, v_current_balance, NULL::UUID;
  END IF;

  IF p_amount > v_current_balance THEN
    RETURN QUERY SELECT FALSE, 'Payment amount exceeds remaining balance'::TEXT, v_current_balance, NULL::UUID;
  END IF;

  -- Calculate new balance
  v_current_balance := v_current_balance - p_amount;

  -- Determine new status
  IF v_current_balance <= 0 THEN
    v_new_status := 'paid';
  ELSIF v_current_balance < (SELECT total_incl_vat FROM invoices WHERE id = p_invoice_id) THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := v_invoice_status;
  END IF;

  -- Create payment record (if payments table exists)
  -- This would be implemented when we have a payments table
  -- INSERT INTO payments (invoice_id, amount, payment_date, notes, created_by_user_id, created_at)
  -- VALUES (p_invoice_id, p_amount, v_current_date, p_notes, p_user_id, v_current_date)
  -- RETURNING id INTO v_payment_id;

  -- Update invoice balance and status
  UPDATE invoices
  SET
    balance_remaining = v_current_balance,
    status = v_new_status,
    updated_at = v_current_date
  WHERE id = p_invoice_id;

  -- Return success result
  RETURN QUERY
    SELECT TRUE,
           'Payment recorded successfully'::TEXT,
           v_current_balance,
           NULL::UUID;
END;
$$;

-- Get Overdue Invoices Function
-- This function identifies invoices that are past their due date
CREATE OR REPLACE FUNCTION get_overdue_invoices()
RETURNS TABLE(
  invoice_id UUID,
  invoice_number TEXT,
  client_id UUID,
  days_overdue INTEGER,
  amount_due DECIMAL,
  due_date TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.invoice_number,
    i.client_id,
    EXTRACT(DAYS FROM NOW() - i.due_date) as days_overdue,
    i.balance_remaining as amount_due,
    i.due_date
  FROM invoices i
  WHERE
    i.status = 'sent'
    AND i.due_date < NOW()
    AND i.balance_remaining > 0
  ORDER BY i.due_date ASC;
END;
$$;

-- Get Client Statistics Function
-- This function provides summary statistics for a client
CREATE OR REPLACE FUNCTION get_client_statistics(p_client_id UUID)
RETURNS TABLE(
  total_quotes INTEGER,
  total_invoices INTEGER,
  draft_quotes INTEGER,
  sent_quotes INTEGER,
  accepted_quotes INTEGER,
  total_quote_value DECIMAL,
  draft_invoices INTEGER,
  sent_invoices INTEGER,
  paid_invoices INTEGER,
  total_invoice_value DECIMAL,
  unpaid_invoice_value DECIMAL,
  total_payments DECIMAL
) LANGUAGE plpgsql AS $$
DECLARE
  v_total_quotes INTEGER := 0;
  v_total_invoices INTEGER := 0;
  v_draft_quotes INTEGER := 0;
  v_sent_quotes INTEGER := 0;
  v_accepted_quotes INTEGER := 0;
  v_total_quote_value DECIMAL := 0;
  v_draft_invoices INTEGER := 0;
  v_sent_invoices INTEGER := 0;
  v_paid_invoices INTEGER := 0;
  v_total_invoice_value DECIMAL := 0;
  v_unpaid_invoice_value DECIMAL := 0;
  v_total_payments DECIMAL := 0;
BEGIN
  -- Quote statistics
  SELECT
    COUNT(*) as total_quotes,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_quotes,
    COUNT(*) FILTER (WHERE status = 'sent') as sent_quotes,
    COUNT(*) FILTER (WHERE status = 'accepted') as accepted_quotes,
    COALESCE(SUM(total_incl_vat), 0) as total_quote_value
  INTO v_total_quotes, v_draft_quotes, v_sent_quotes, v_accepted_quotes, v_total_quote_value
  FROM quotes
  WHERE client_id = p_client_id;

  -- Invoice statistics
  SELECT
    COUNT(*) as total_invoices,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_invoices,
    COUNT(*) FILTER (WHERE status = 'sent') as sent_invoices,
    COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
    COALESCE(SUM(total_incl_vat), 0) as total_invoice_value,
    COALESCE(SUM(balance_remaining), 0) as unpaid_invoice_value
  INTO v_total_invoices, v_draft_invoices, v_sent_invoices, v_paid_invoices, v_total_invoice_value, v_unpaid_invoice_value
  FROM invoices
  WHERE client_id = p_client_id;

  -- Calculate total payments (would need payments table)
  -- SELECT COALESCE(SUM(amount), 0) as total_payments
  -- INTO v_total_payments
  -- FROM payments p
  -- JOIN invoices i ON p.invoice_id = i.id
  -- WHERE i.client_id = p_client_id;

  -- Return all statistics
  RETURN QUERY
    SELECT
      v_total_quotes, v_total_invoices, v_draft_quotes, v_sent_quotes, v_accepted_quotes,
      v_total_quote_value, v_draft_invoices, v_sent_invoices, v_paid_invoices,
      v_total_invoice_value, v_unpaid_invoice_value, v_total_payments;
END;
$$;

-- Enable necessary extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant necessary permissions to the authenticated user
-- These would be adjusted based on your RLS policies
-- GRANT EXECUTE ON FUNCTION convert_quote_to_invoice TO authenticated;
-- GRANT EXECUTE ON FUNCTION generate_quote_number TO authenticated;
-- GRANT EXECUTE ON FUNCTION generate_invoice_number TO authenticated;
-- GRANT EXECUTE ON FUNCTION calculate_quote_totals TO authenticated;
-- GRANT EXECUTE ON FUNCTION calculate_invoice_totals TO authenticated;
-- GRANT EXECUTE ON FUNCTION can_modify_quote TO authenticated;
-- GRANT EXECUTE ON FUNCTION can_modify_invoice TO authenticated;
-- GRANT EXECUTE ON FUNCTION update_invoice_status TO authenticated;
-- GRANT EXECUTE ON FUNCTION record_payment TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_overdue_invoices TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_client_statistics TO authenticated;