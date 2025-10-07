-- Migration: Create backup and disaster recovery tables
-- Created: 2025-08-27
-- Description: Tables for tracking backups, recovery operations, and disaster recovery metadata

-- Backup metadata tracking
CREATE TABLE IF NOT EXISTS backup_metadata (
  id VARCHAR(16) PRIMARY KEY,
  backup_type VARCHAR(20) NOT NULL CHECK (backup_type IN ('full', 'incremental', 'schema', 'data')),
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  compression_ratio DECIMAL(5,2),
  encryption_enabled BOOLEAN DEFAULT FALSE,
  
  -- Backup content information
  tables_included INTEGER,
  rows_backed_up BIGINT,
  
  -- Timing information
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP NOT NULL,
  duration_ms INTEGER NOT NULL,
  
  -- Verification status
  verification_status VARCHAR(20) CHECK (verification_status IN ('passed', 'failed', 'pending', 'skipped')),
  verification_details JSONB,
  
  -- Retention information
  retention_policy VARCHAR(50),
  retention_until TIMESTAMP,
  
  -- Recovery information (for incremental backups)
  base_backup_id VARCHAR(16) REFERENCES backup_metadata(id),
  wal_files_count INTEGER DEFAULT 0,
  
  -- Status and metadata
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed', 'deleted')),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Recovery operations tracking
CREATE TABLE IF NOT EXISTS recovery_operations (
  id VARCHAR(16) PRIMARY KEY,
  recovery_type VARCHAR(30) NOT NULL CHECK (recovery_type IN ('full_restore', 'point_in_time', 'schema_only', 'data_only')),
  
  -- Recovery parameters
  target_timestamp TIMESTAMP,
  recovery_environment VARCHAR(50),
  
  -- Backup information used
  base_backup_id VARCHAR(16) REFERENCES backup_metadata(id),
  incremental_backups_used INTEGER DEFAULT 0,
  wal_files_applied INTEGER DEFAULT 0,
  
  -- Timing and performance
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  
  -- Results and verification
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'cancelled')),
  verification_results JSONB,
  consistency_check_passed BOOLEAN,
  
  -- Recovery environment details
  recovery_path TEXT,
  test_queries_passed INTEGER DEFAULT 0,
  test_queries_failed INTEGER DEFAULT 0,
  
  -- Metadata and context
  initiated_by VARCHAR(50),
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Disaster recovery configuration
CREATE TABLE IF NOT EXISTS dr_configuration (
  id SERIAL PRIMARY KEY,
  config_name VARCHAR(100) NOT NULL UNIQUE,
  config_type VARCHAR(30) NOT NULL CHECK (config_type IN ('backup_policy', 'retention_rule', 'replication_target', 'alert_rule')),
  
  -- Configuration details
  config_value JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_applied TIMESTAMP,
  
  -- Validation
  validation_status VARCHAR(20) CHECK (validation_status IN ('valid', 'invalid', 'pending')),
  validation_errors TEXT[]
);

-- Backup testing results
CREATE TABLE IF NOT EXISTS backup_test_results (
  id SERIAL PRIMARY KEY,
  backup_id VARCHAR(16) REFERENCES backup_metadata(id),
  test_type VARCHAR(30) NOT NULL CHECK (test_type IN ('restore_test', 'integrity_check', 'performance_test', 'consistency_check')),
  
  -- Test execution
  executed_at TIMESTAMP DEFAULT NOW(),
  duration_ms INTEGER,
  
  -- Test results
  test_status VARCHAR(20) NOT NULL CHECK (test_status IN ('passed', 'failed', 'warning', 'skipped')),
  test_score DECIMAL(5,2), -- Score out of 100
  
  -- Detailed results
  test_details JSONB,
  error_messages TEXT[],
  warnings TEXT[],
  
  -- Performance metrics
  restore_time_ms INTEGER,
  data_verification_time_ms INTEGER,
  query_performance_ms INTEGER,
  
  -- Environment information
  test_environment VARCHAR(50),
  database_version VARCHAR(20),
  test_data_size BIGINT
);

-- Cross-region replication status
CREATE TABLE IF NOT EXISTS backup_replication_status (
  id SERIAL PRIMARY KEY,
  backup_id VARCHAR(16) REFERENCES backup_metadata(id),
  target_region VARCHAR(50) NOT NULL,
  
  -- Replication details
  replication_started_at TIMESTAMP NOT NULL,
  replication_completed_at TIMESTAMP,
  replication_status VARCHAR(20) CHECK (replication_status IN ('in_progress', 'completed', 'failed', 'cancelled')),
  
  -- File details
  source_path TEXT NOT NULL,
  target_path TEXT,
  replicated_size BIGINT,
  checksum_verified BOOLEAN DEFAULT FALSE,
  
  -- Performance metrics
  transfer_duration_ms INTEGER,
  transfer_speed_mbps DECIMAL(10,2),
  
  -- Error handling
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_backup_metadata_type_date ON backup_metadata(backup_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_status ON backup_metadata(status);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_retention ON backup_metadata(retention_until);
CREATE INDEX IF NOT EXISTS idx_recovery_operations_date ON recovery_operations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_operations_status ON recovery_operations(status);
CREATE INDEX IF NOT EXISTS idx_backup_test_results_backup_id ON backup_test_results(backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_test_results_status ON backup_test_results(test_status);
CREATE INDEX IF NOT EXISTS idx_replication_status_backup_id ON backup_replication_status(backup_id);
CREATE INDEX IF NOT EXISTS idx_replication_status_region ON backup_replication_status(target_region);

-- Views for monitoring and reporting

-- Backup health overview
CREATE OR REPLACE VIEW v_backup_health AS
SELECT 
    DATE(created_at) as backup_date,
    backup_type,
    COUNT(*) as backup_count,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_backups,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_backups,
    AVG(duration_ms)::INTEGER as avg_duration_ms,
    SUM(file_size) as total_backup_size,
    MIN(created_at) as first_backup_time,
    MAX(created_at) as last_backup_time
FROM backup_metadata 
WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), backup_type
ORDER BY backup_date DESC, backup_type;

-- Recovery readiness status
CREATE OR REPLACE VIEW v_recovery_readiness AS
SELECT 
    b.backup_type,
    COUNT(b.id) as available_backups,
    MAX(b.created_at) as latest_backup,
    MIN(b.created_at) as oldest_backup,
    COUNT(t.id) FILTER (WHERE t.test_status = 'passed') as tested_backups,
    COUNT(r.id) as cross_region_replicas,
    AVG(t.test_score) as avg_test_score
FROM backup_metadata b
LEFT JOIN backup_test_results t ON b.id = t.backup_id AND t.test_type = 'restore_test'
LEFT JOIN backup_replication_status r ON b.id = r.backup_id AND r.replication_status = 'completed'
WHERE b.status = 'completed' 
  AND b.retention_until > NOW()
GROUP BY b.backup_type;

-- Recent recovery operations
CREATE OR REPLACE VIEW v_recent_recovery_operations AS
SELECT 
    r.*,
    b.file_size as backup_size,
    b.backup_type,
    EXTRACT(EPOCH FROM (r.completed_at - r.started_at))::INTEGER as duration_seconds
FROM recovery_operations r
JOIN backup_metadata b ON r.base_backup_id = b.id
WHERE r.created_at > CURRENT_DATE - INTERVAL '90 days'
ORDER BY r.created_at DESC;

-- Comments for documentation
COMMENT ON TABLE backup_metadata IS 'Tracks all backup operations with verification status and retention information';
COMMENT ON TABLE recovery_operations IS 'Logs all recovery operations including point-in-time recoveries';
COMMENT ON TABLE dr_configuration IS 'Stores disaster recovery configuration and policies';
COMMENT ON TABLE backup_test_results IS 'Results from automated backup testing procedures';
COMMENT ON TABLE backup_replication_status IS 'Tracks cross-region backup replication status';

COMMENT ON VIEW v_backup_health IS 'Daily backup health metrics for monitoring dashboard';
COMMENT ON VIEW v_recovery_readiness IS 'Current recovery capabilities and readiness status';
COMMENT ON VIEW v_recent_recovery_operations IS 'Recent recovery operations with performance metrics';