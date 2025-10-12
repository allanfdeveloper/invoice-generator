-- SLA (Service Level Agreement) Database Migration
-- Add this to your existing database-setup.sql or run separately in Supabase SQL Editor

-- Create SLA-related ENUM types
CREATE TYPE sla_metric_type AS ENUM ('availability', 'response_time', 'resolution_time', 'incident_count');
CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE incident_status AS ENUM ('open', 'investigating', 'resolved', 'closed');
CREATE TYPE sla_report_type AS ENUM ('daily', 'weekly', 'monthly', 'quarterly');

-- Create SLA services table
CREATE TABLE sla_services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

    -- SLA Targets (following existing numeric patterns)
    availability_target DECIMAL(5,2) CHECK (availability_target >= 0 AND availability_target <= 100),
    response_time_target INTEGER, -- milliseconds
    resolution_time_target INTEGER, -- minutes

    -- Pricing for credit calculations
    monthly_service_fee DECIMAL(12,2) DEFAULT 0,

    -- Status and metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_sla_service UNIQUE(name, client_id)
);

-- Create SLA metrics storage table
CREATE TABLE sla_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sla_service_id UUID REFERENCES sla_services(id) ON DELETE CASCADE,

    -- Metric identification
    metric_type sla_metric_type NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Values (following existing decimal patterns from company_settings)
    value DECIMAL(15,4) NOT NULL,
    unit VARCHAR(50) DEFAULT '',

    -- Additional context
    total_checks INTEGER DEFAULT 0,
    successful_checks INTEGER DEFAULT 0,
    failed_checks INTEGER DEFAULT 0,

    -- Source information
    monitoring_source VARCHAR(100) DEFAULT 'internal',
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for SLA metrics table
CREATE INDEX idx_sla_metrics_service_time ON sla_metrics(sla_service_id, metric_type, recorded_at);
CREATE INDEX idx_sla_metrics_time ON sla_metrics(recorded_at);

-- Create SLA incidents table
CREATE TABLE sla_incidents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sla_service_id UUID REFERENCES sla_services(id) ON DELETE CASCADE,

    -- Incident details
    title VARCHAR(200) NOT NULL,
    description TEXT,
    severity incident_severity NOT NULL,
    status incident_status NOT NULL,

    -- Timeline
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- Assignment (following existing user reference patterns)
    assigned_to UUID,

    -- Impact assessment
    affected_users INTEGER DEFAULT 0,
    estimated_revenue_impact DECIMAL(12,2) DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create SLA configuration table for credit rules
CREATE TABLE sla_configurations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sla_service_id UUID REFERENCES sla_services(id) ON DELETE CASCADE,

    -- Credit tier configuration (JSONB for flexibility)
    credit_tiers JSONB DEFAULT '[]'::jsonb, -- [{"threshold": 99.5, "credit": 10}, ...]

    -- Monitoring settings
    check_interval_seconds INTEGER DEFAULT 60,
    alert_thresholds JSONB DEFAULT '{}'::jsonb,

    -- Business rules
    business_hours_only BOOLEAN DEFAULT false,
    exclude_maintenance_windows BOOLEAN DEFAULT true,
    maintenance_windows JSONB DEFAULT '[]'::jsonb,

    -- Notification settings
    notification_emails JSONB DEFAULT '[]'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create SLA reports table
CREATE TABLE sla_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sla_service_id UUID REFERENCES sla_services(id) ON DELETE CASCADE,

    -- Report period
    report_type sla_report_type NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Calculated metrics
    availability_percentage DECIMAL(5,2),
    average_response_time DECIMAL(10,2),
    average_resolution_time DECIMAL(10,2),
    total_incidents INTEGER DEFAULT 0,
    total_downtime_minutes INTEGER DEFAULT 0,

    -- SLA compliance
    sla_met BOOLEAN NOT NULL DEFAULT false,
    sla_breach_details JSONB DEFAULT '{}'::jsonb,

    -- Compensation calculation
    service_credit_earned BOOLEAN DEFAULT false,
    credit_percentage DECIMAL(5,2) DEFAULT 0,
    credit_amount DECIMAL(12,2) DEFAULT 0,

    -- Processing
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_for_billing BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT unique_sla_report UNIQUE(sla_service_id, report_type, period_start)
);

-- Create SLA credits integration table with existing invoice system
CREATE TABLE sla_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sla_report_id UUID REFERENCES sla_reports(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,

    -- Credit details
    credit_amount DECIMAL(12,2) NOT NULL,
    credit_percentage DECIMAL(5,2) NOT NULL,
    reason TEXT NOT NULL,

    -- Application details
    applied_to_invoice BOOLEAN DEFAULT false,
    applied_at TIMESTAMP WITH TIME ZONE,

    -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,

    notes TEXT
);

-- Enable Row Level Security on SLA tables
ALTER TABLE sla_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_credits ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policies for SLA services
CREATE POLICY "Users can view SLA services for their own company" ON sla_services
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM company_settings
            WHERE id = 1 -- Assuming single company per instance
        )
    );

CREATE POLICY "Users can insert SLA services" ON sla_services
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM company_settings
            WHERE id = 1 -- Assuming single company per instance
        )
    );

CREATE POLICY "Users can update SLA services" ON sla_services
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM company_settings
            WHERE id = 1 -- Assuming single company per instance
        )
    );

CREATE POLICY "Users can delete SLA services" ON sla_services
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM company_settings
            WHERE id = 1 -- Assuming single company per instance
        )
    );

-- Row Level Security Policies for SLA metrics
CREATE POLICY "Users can view SLA metrics for their SLA services" ON sla_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sla_services ss
            WHERE ss.id = sla_metrics.sla_service_id
            AND EXISTS (
                SELECT 1 FROM company_settings WHERE id = 1
            )
        )
    );

CREATE POLICY "Users can insert SLA metrics" ON sla_metrics
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sla_services ss
            WHERE ss.id = sla_metrics.sla_service_id
            AND EXISTS (
                SELECT 1 FROM company_settings WHERE id = 1
            )
        )
    );

CREATE POLICY "Users can update SLA metrics" ON sla_metrics
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sla_services ss
            WHERE ss.id = sla_metrics.sla_service_id
            AND EXISTS (
                SELECT 1 FROM company_settings WHERE id = 1
            )
        )
    );

-- Row Level Security Policies for SLA incidents
CREATE POLICY "Users can view SLA incidents for their SLA services" ON sla_incidents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sla_services ss
            WHERE ss.id = sla_incidents.sla_service_id
            AND EXISTS (
                SELECT 1 FROM company_settings WHERE id = 1
            )
        )
    );

CREATE POLICY "Users can manage SLA incidents" ON sla_incidents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sla_services ss
            WHERE ss.id = sla_incidents.sla_service_id
            AND EXISTS (
                SELECT 1 FROM company_settings WHERE id = 1
            )
        )
    );

-- Row Level Security Policies for SLA configurations
CREATE POLICY "Users can manage SLA configurations" ON sla_configurations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sla_services ss
            WHERE ss.id = sla_configurations.sla_service_id
            AND EXISTS (
                SELECT 1 FROM company_settings WHERE id = 1
            )
        )
    );

-- Row Level Security Policies for SLA reports
CREATE POLICY "Users can view SLA reports for their SLA services" ON sla_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sla_services ss
            WHERE ss.id = sla_reports.sla_service_id
            AND EXISTS (
                SELECT 1 FROM company_settings WHERE id = 1
            )
        )
    );

CREATE POLICY "Users can insert SLA reports" ON sla_reports
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sla_services ss
            WHERE ss.id = sla_reports.sla_service_id
            AND EXISTS (
                SELECT 1 FROM company_settings WHERE id = 1
            )
        )
    );

-- Row Level Security Policies for SLA credits
CREATE POLICY "Users can view SLA credits" ON sla_credits
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM company_settings WHERE id = 1
        )
    );

CREATE POLICY "Users can insert SLA credits" ON sla_credits
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM company_settings WHERE id = 1
        )
    );

CREATE POLICY "Users can update SLA credits" ON sla_credits
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM company_settings WHERE id = 1
        )
    );