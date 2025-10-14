-- Row Level Security (RLS) Policies for Invoice Generator
-- This file enforces proper user isolation and data security

-- First, ensure RLS is enabled on all tables
ALTER TABLE IF EXISTS company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Company settings access" ON company_settings;
DROP POLICY IF EXISTS "Clients access policies" ON clients;
DROP POLICY IF EXISTS "Quotes access policies" ON quotes;
DROP POLICY IF EXISTS "Invoices access policies" ON invoices;
DROP POLICY IF EXISTS "Items access policies" ON items;
DROP POLICY IF EXISTS "Packages access policies" ON packages;
DROP POLICY IF EXISTS "Quote items access policies" ON quote_items;
DROP POLICY IF EXISTS "Invoice items access policies" ON invoice_items;
DROP POLICY IF EXISTS "Package items access policies" ON package_items;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid()::text = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id);

-- Users can insert their own profile (for new user registration)
CREATE POLICY "Users can insert their own profile" ON users
    FOR INSERT WITH CHECK (auth.uid()::text = id);

-- ============================================
-- COMPANY SETTINGS POLICIES
-- ============================================

-- Company settings are per-user, but we need to handle the case
-- where they might not exist yet for new users
CREATE POLICY "Company settings access" ON company_settings
    FOR ALL USING (
        -- User can access their own company settings
        created_by_user_id = auth.uid()::text
        -- Or if no user_id is set yet (migration scenario), allow access to the first user
        OR (created_by_user_id IS NULL AND NOT EXISTS (
            SELECT 1 FROM company_settings WHERE created_by_user_id IS NOT NULL
        ))
    );

-- ============================================
-- CLIENTS POLICIES
-- ============================================

-- Users can view their own clients
CREATE POLICY "Users can view their own clients" ON clients
    FOR SELECT USING (created_by_user_id = auth.uid()::text);

-- Users can insert their own clients
CREATE POLICY "Users can insert their own clients" ON clients
    FOR INSERT WITH CHECK (created_by_user_id = auth.uid()::text);

-- Users can update their own clients
CREATE POLICY "Users can update their own clients" ON clients
    FOR UPDATE USING (created_by_user_id = auth.uid()::text);

-- Users can delete their own clients
CREATE POLICY "Users can delete their own clients" ON clients
    FOR DELETE USING (created_by_user_id = auth.uid()::text);

-- ============================================
-- QUOTES POLICIES
-- ============================================

-- Users can view their own quotes
CREATE POLICY "Users can view their own quotes" ON quotes
    FOR SELECT USING (created_by_user_id = auth.uid()::text);

-- Users can insert their own quotes
CREATE POLICY "Users can insert their own quotes" ON quotes
    FOR INSERT WITH CHECK (created_by_user_id = auth.uid()::text);

-- Users can update their own quotes (only if not accepted or converted)
CREATE POLICY "Users can update their own quotes" ON quotes
    FOR UPDATE USING (
        created_by_user_id = auth.uid()::text
        AND status NOT IN ('accepted', 'converted')
    );

-- Users can delete their own quotes (only if not accepted or converted)
CREATE POLICY "Users can delete their own quotes" ON quotes
    FOR DELETE USING (
        created_by_user_id = auth.uid()::text
        AND status NOT IN ('accepted', 'converted')
    );

-- ============================================
-- INVOICES POLICIES
-- ============================================

-- Users can view their own invoices
CREATE POLICY "Users can view their own invoices" ON invoices
    FOR SELECT USING (created_by_user_id = auth.uid()::text);

-- Users can insert their own invoices
CREATE POLICY "Users can insert their own invoices" ON invoices
    FOR INSERT WITH CHECK (created_by_user_id = auth.uid()::text);

-- Users can update their own invoices (only if not paid)
CREATE POLICY "Users can update their own invoices" ON invoices
    FOR UPDATE USING (
        created_by_user_id = auth.uid()::text
        AND status != 'paid'
    );

-- Users can delete their own invoices (only if draft)
CREATE POLICY "Users can delete their own invoices" ON invoices
    FOR DELETE USING (
        created_by_user_id = auth.uid()::text
        AND status = 'draft'
    );

-- ============================================
-- ITEMS POLICIES
-- ============================================

-- Users can view their own items
CREATE POLICY "Users can view their own items" ON items
    FOR SELECT USING (created_by_user_id = auth.uid()::text);

-- Users can insert their own items
CREATE POLICY "Users can insert their own items" ON items
    FOR INSERT WITH CHECK (created_by_user_id = auth.uid()::text);

-- Users can update their own items (with restrictions)
CREATE POLICY "Users can update their own items" ON items
    FOR UPDATE USING (
        created_by_user_id = auth.uid()::text
        -- Allow updates to items that are not used in active quotes/invoices
        AND NOT EXISTS (
            SELECT 1 FROM quote_items qi
            JOIN quotes q ON qi.quote_id = q.id
            WHERE qi.item_id = items.id AND q.status NOT IN ('converted', 'rejected')
        )
        AND NOT EXISTS (
            SELECT 1 FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE ii.item_id = items.id AND i.status != 'paid'
        )
    );

-- Users can delete their own items (with restrictions)
CREATE POLICY "Users can delete their own items" ON items
    FOR DELETE USING (
        created_by_user_id = auth.uid()::text
        -- Allow deletion of items that are not used in active quotes/invoices
        AND NOT EXISTS (
            SELECT 1 FROM quote_items qi
            JOIN quotes q ON qi.quote_id = q.id
            WHERE qi.item_id = items.id AND q.status NOT IN ('converted', 'rejected')
        )
        AND NOT EXISTS (
            SELECT 1 FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE ii.item_id = items.id AND i.status != 'paid'
        )
    );

-- ============================================
-- PACKAGES POLICIES
-- ============================================

-- Users can view their own packages
CREATE POLICY "Users can view their own packages" ON packages
    FOR SELECT USING (created_by_user_id = auth.uid()::text);

-- Users can insert their own packages
CREATE POLICY "Users can insert their own packages" ON packages
    FOR INSERT WITH CHECK (created_by_user_id = auth.uid()::text);

-- Users can update their own packages
CREATE POLICY "Users can update their own packages" ON packages
    FOR UPDATE USING (created_by_user_id = auth.uid()::text);

-- Users can delete their own packages
CREATE POLICY "Users can delete their own packages" ON packages
    FOR DELETE USING (created_by_user_id = auth.uid()::text);

-- ============================================
-- QUOTE ITEMS POLICIES
-- ============================================

-- Users can view their own quote items (through quote ownership)
CREATE POLICY "Users can view their own quote items" ON quote_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM quotes
            WHERE quotes.id = quote_items.quote_id
            AND quotes.created_by_user_id = auth.uid()::text
        )
    );

-- Users can insert their own quote items (through quote ownership)
CREATE POLICY "Users can insert their own quote items" ON quote_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM quotes
            WHERE quotes.id = quote_items.quote_id
            AND quotes.created_by_user_id = auth.uid()::text
        )
    );

-- Users can update their own quote items (through quote ownership)
CREATE POLICY "Users can update their own quote items" ON quote_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM quotes
            WHERE quotes.id = quote_items.quote_id
            AND quotes.created_by_user_id = auth.uid()::text
            AND quotes.status NOT IN ('accepted', 'converted')
        )
    );

-- Users can delete their own quote items (through quote ownership)
CREATE POLICY "Users can delete their own quote items" ON quote_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM quotes
            WHERE quotes.id = quote_items.quote_id
            AND quotes.created_by_user_id = auth.uid()::text
            AND quotes.status NOT IN ('accepted', 'converted')
        )
    );

-- ============================================
-- INVOICE ITEMS POLICIES
-- ============================================

-- Users can view their own invoice items (through invoice ownership)
CREATE POLICY "Users can view their own invoice items" ON invoice_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_items.invoice_id
            AND invoices.created_by_user_id = auth.uid()::text
        )
    );

-- Users can insert their own invoice items (through invoice ownership)
CREATE POLICY "Users can insert their own invoice items" ON invoice_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_items.invoice_id
            AND invoices.created_by_user_id = auth.uid()::text
        )
    );

-- Users can update their own invoice items (through invoice ownership)
CREATE POLICY "Users can update their own invoice items" ON invoice_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_items.invoice_id
            AND invoices.created_by_user_id = auth.uid()::text
            AND invoices.status != 'paid'
        )
    );

-- Users can delete their own invoice items (through invoice ownership)
CREATE POLICY "Users can delete their own invoice items" ON invoice_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_items.invoice_id
            AND invoices.created_by_user_id = auth.uid()::text
            AND invoices.status != 'paid'
        )
    );

-- ============================================
-- PACKAGE ITEMS POLICIES
-- ============================================

-- Users can view their own package items (through package ownership)
CREATE POLICY "Users can view their own package items" ON package_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM packages
            WHERE packages.id = package_items.package_id
            AND packages.created_by_user_id = auth.uid()::text
        )
    );

-- Users can insert their own package items (through package ownership)
CREATE POLICY "Users can insert their own package items" ON package_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM packages
            WHERE packages.id = package_items.package_id
            AND packages.created_by_user_id = auth.uid()::text
        )
    );

-- Users can update their own package items (through package ownership)
CREATE POLICY "Users can update their own package items" ON package_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM packages
            WHERE packages.id = package_items.package_id
            AND packages.created_by_user_id = auth.uid()::text
        )
    );

-- Users can delete their own package items (through package ownership)
CREATE POLICY "Users can delete their own package items" ON package_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM packages
            WHERE packages.id = package_items.package_id
            AND packages.created_by_user_id = auth.uid()::text
        )
    );

-- ============================================
-- SECURITY FUNCTIONS FOR VALIDATION
-- ============================================

-- Function to check if user can modify a quote
CREATE OR REPLACE FUNCTION can_user_modify_quote(quote_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM quotes
        WHERE id = quote_id
        AND created_by_user_id = user_id::text
        AND status NOT IN ('accepted', 'converted')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can modify an invoice
CREATE OR REPLACE FUNCTION can_user_modify_invoice(invoice_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM invoices
        WHERE id = invoice_id
        AND created_by_user_id = user_id::text
        AND status != 'paid'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access a client
CREATE OR REPLACE FUNCTION can_user_access_client(client_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM clients
        WHERE id = client_id
        AND created_by_user_id = user_id::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to ensure user isolation for company settings
CREATE OR REPLACE FUNCTION ensure_user_company_settings(user_id UUID)
RETURNS UUID AS $$
DECLARE
    settings_id UUID;
BEGIN
    -- Try to get existing settings
    SELECT id INTO settings_id
    FROM company_settings
    WHERE created_by_user_id = user_id::text;

    -- If no settings exist, create them
    IF settings_id IS NULL THEN
        INSERT INTO company_settings (
            company_name,
            currency,
            vat_percentage,
            numbering_format_invoice,
            numbering_format_quote,
            next_invoice_number,
            next_quote_number,
            terms_text,
            created_by_user_id,
            created_at
        ) VALUES (
            'My Company',
            'USD',
            15.0,
            'INV-{year}-{number:04d}',
            'QUOTE-{year}-{number:04d}',
            1,
            1,
            'Please pay within 30 days of receipt.',
            user_id::text,
            NOW()
        ) RETURNING id INTO settings_id;
    END IF;

    RETURN settings_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- INDEXES FOR PERFORMANCE AND SECURITY
-- ============================================

-- Create indexes to support RLS policies
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_packages_user_id ON packages(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_user_id ON company_settings(created_by_user_id);

-- Create indexes for foreign key relationships
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_package_items_package_id ON package_items(package_id);

-- Create indexes for status-based queries
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ============================================
-- POLICY VALIDATION QUERIES
-- ============================================

-- Test queries to validate RLS policies (these can be run during testing)

-- Test 1: User should only see their own data
-- SELECT COUNT(*) FROM quotes WHERE created_by_user_id = 'test-user-id';
-- This should return 0 for other users and proper count for the actual user

-- Test 2: User should not be able to access other users' clients
-- SELECT * FROM clients WHERE created_by_user_id != 'test-user-id';
-- This should return empty for any authenticated user

-- Test 3: User should not be able to modify accepted quotes
-- UPDATE quotes SET notes = 'test' WHERE status = 'accepted';
-- This should fail due to RLS policy

-- Test 4: User should not be able to delete paid invoices
-- DELETE FROM invoices WHERE status = 'paid';
-- This should fail due to RLS policy

-- ============================================
-- SECURITY AUDIT FUNCTION
-- ============================================

-- Function to audit RLS policy effectiveness
CREATE OR REPLACE FUNCTION audit_rls_policies()
RETURNS TABLE(
    table_name TEXT,
    policy_count INTEGER,
    rls_enabled BOOLEAN,
    has_user_isolation BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        schemaname || '.' || tablename as table_name,
        COUNT(policyname) as policy_count,
        rowsecurity as rls_enabled,
        -- Check if policies reference user isolation
        BOOL_OR(qual ~ 'auth.uid()' OR qual ~ 'created_by_user_id') as has_user_isolation
    FROM pg_policies pp
    JOIN pg_class pc ON pc.relname = pp.tablename
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = pp.schemaname
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename, rowsecurity
    ORDER BY tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;