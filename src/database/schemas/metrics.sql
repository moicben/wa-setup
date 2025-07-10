-- Schema for workflow metrics and performance tracking
-- Phase 4: Supabase Integration

-- Enable RLS
ALTER TABLE IF EXISTS metrics ENABLE ROW LEVEL SECURITY;

-- Create metrics table
CREATE TABLE IF NOT EXISTS metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Workflow identification
    workflow_id UUID NOT NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Step information
    step_name VARCHAR(100) NOT NULL,
    step_type VARCHAR(50) NOT NULL,
    step_order INTEGER,
    
    -- Performance metrics
    duration_ms INTEGER NOT NULL,
    memory_usage_mb REAL,
    cpu_usage_percent REAL,
    
    -- Success tracking
    success BOOLEAN NOT NULL DEFAULT false,
    confidence_score REAL,
    
    -- Error tracking
    error_type VARCHAR(100),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Context data
    context_data JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT metrics_duration_positive CHECK (duration_ms >= 0),
    CONSTRAINT metrics_confidence_range CHECK (confidence_score >= 0 AND confidence_score <= 1),
    CONSTRAINT metrics_retry_count_positive CHECK (retry_count >= 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_metrics_workflow_id ON metrics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_metrics_account_id ON metrics(account_id);
CREATE INDEX IF NOT EXISTS idx_metrics_step_name ON metrics(step_name);
CREATE INDEX IF NOT EXISTS idx_metrics_success ON metrics(success);
CREATE INDEX IF NOT EXISTS idx_metrics_started_at ON metrics(started_at);
CREATE INDEX IF NOT EXISTS idx_metrics_duration ON metrics(duration_ms);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_metrics_workflow_step ON metrics(workflow_id, step_name);
CREATE INDEX IF NOT EXISTS idx_metrics_success_step ON metrics(success, step_name);
CREATE INDEX IF NOT EXISTS idx_metrics_date_success ON metrics(DATE(started_at), success);

-- Create workflow_stats materialized view for performance
CREATE MATERIALIZED VIEW IF NOT EXISTS workflow_stats AS
SELECT 
    DATE(started_at) as date,
    step_name,
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE success = true) as successful_executions,
    COUNT(*) FILTER (WHERE success = false) as failed_executions,
    ROUND(AVG(duration_ms)) as avg_duration_ms,
    ROUND(AVG(confidence_score), 3) as avg_confidence,
    COUNT(DISTINCT workflow_id) as unique_workflows
FROM metrics
GROUP BY DATE(started_at), step_name
ORDER BY date DESC, step_name;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_stats_unique ON workflow_stats(date, step_name);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_workflow_stats()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY workflow_stats;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh stats on metrics changes
CREATE TRIGGER refresh_workflow_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON metrics
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_workflow_stats();

-- RLS Policies
CREATE POLICY "Users can view their own metrics" ON metrics
    FOR SELECT USING (
        workflow_id IN (
            SELECT workflow_id FROM accounts WHERE profile_data->>'user_id'::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own metrics" ON metrics
    FOR INSERT WITH CHECK (
        workflow_id IN (
            SELECT workflow_id FROM accounts WHERE profile_data->>'user_id'::text = auth.uid()::text
        )
    );

-- Create performance monitoring view
CREATE VIEW IF NOT EXISTS performance_summary AS
SELECT 
    DATE(started_at) as date,
    COUNT(*) as total_steps,
    COUNT(*) FILTER (WHERE success = true) as successful_steps,
    ROUND(AVG(duration_ms)) as avg_duration_ms,
    ROUND(AVG(confidence_score), 3) as avg_confidence,
    COUNT(DISTINCT workflow_id) as unique_workflows,
    COUNT(DISTINCT account_id) as unique_accounts
FROM metrics
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(started_at)
ORDER BY date DESC;

-- Create alerts view for failed steps
CREATE VIEW IF NOT EXISTS failed_steps_alerts AS
SELECT 
    m.workflow_id,
    m.account_id,
    a.phone,
    a.country,
    m.step_name,
    m.error_type,
    m.error_message,
    m.retry_count,
    m.started_at,
    m.duration_ms
FROM metrics m
JOIN accounts a ON m.account_id = a.id
WHERE m.success = false
  AND m.started_at >= NOW() - INTERVAL '24 hours'
ORDER BY m.started_at DESC;

-- Comments
COMMENT ON TABLE metrics IS 'Workflow step execution metrics and performance data';
COMMENT ON COLUMN metrics.workflow_id IS 'Unique identifier for the workflow execution';
COMMENT ON COLUMN metrics.step_name IS 'Name of the workflow step';
COMMENT ON COLUMN metrics.duration_ms IS 'Step execution duration in milliseconds';
COMMENT ON COLUMN metrics.confidence_score IS 'OCR or validation confidence score (0-1)';
COMMENT ON MATERIALIZED VIEW workflow_stats IS 'Daily aggregated workflow statistics';
COMMENT ON VIEW performance_summary IS 'Performance summary for the last 30 days';
COMMENT ON VIEW failed_steps_alerts IS 'Failed steps in the last 24 hours for alerting';