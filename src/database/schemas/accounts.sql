-- Schema for WhatsApp accounts tracking
-- Phase 4: Supabase Integration

-- Enable RLS
ALTER TABLE IF EXISTS accounts ENABLE ROW LEVEL SECURITY;

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    country VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'creating',
    
    -- Workflow tracking
    workflow_id UUID,
    attempt_number INTEGER DEFAULT 1,
    
    -- Profile data
    profile_data JSONB,
    cloud_profile_id VARCHAR(100),
    
    -- Error tracking
    error_logs JSONB DEFAULT '[]'::jsonb,
    last_error VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    CONSTRAINT accounts_status_check CHECK (status IN ('creating', 'completed', 'failed', 'cancelled')),
    CONSTRAINT accounts_country_check CHECK (country IN ('UK', 'FR', 'US', 'DE', 'ES', 'CA'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_phone ON accounts(phone);
CREATE INDEX IF NOT EXISTS idx_accounts_country ON accounts(country);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(created_at);
CREATE INDEX IF NOT EXISTS idx_accounts_workflow_id ON accounts(workflow_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_accounts_updated_at 
    BEFORE UPDATE ON accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
CREATE POLICY "Users can view their own accounts" ON accounts
    FOR SELECT USING (auth.uid() = profile_data->>'user_id'::text);

CREATE POLICY "Users can insert their own accounts" ON accounts
    FOR INSERT WITH CHECK (auth.uid() = profile_data->>'user_id'::text);

CREATE POLICY "Users can update their own accounts" ON accounts
    FOR UPDATE USING (auth.uid() = profile_data->>'user_id'::text);

-- Comments
COMMENT ON TABLE accounts IS 'WhatsApp accounts creation tracking';
COMMENT ON COLUMN accounts.phone IS 'Phone number in international format';
COMMENT ON COLUMN accounts.country IS 'Country code (UK, FR, US, etc.)';
COMMENT ON COLUMN accounts.status IS 'Account creation status';
COMMENT ON COLUMN accounts.profile_data IS 'JSON data for cloud profile and additional info';
COMMENT ON COLUMN accounts.error_logs IS 'JSON array of error logs';