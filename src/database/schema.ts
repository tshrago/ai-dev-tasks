import DatabaseConnection from './connection';

export interface DatabaseSchema {
  createTables(): Promise<void>;
  createIndexes(): Promise<void>;
  createPartitions(): Promise<void>;
  dropTables(): Promise<void>;
}

class DatabaseSchemaImpl implements DatabaseSchema {
  private db: DatabaseConnection;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  public async createTables(): Promise<void> {
    // Users table for role-based access control
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('developer', 'analyst', 'compliance_officer', 'admin')),
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // AI interactions table - main logging table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS ai_interactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        session_id VARCHAR(255) NOT NULL,
        interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN ('text', 'image', 'multimodal')),
        prompt_content TEXT NOT NULL,
        prompt_metadata JSONB,
        response_content TEXT NOT NULL,
        response_metadata JSONB,
        ai_model_version VARCHAR(100),
        ai_model_provider VARCHAR(100),
        processing_time_ms INTEGER,
        token_count INTEGER,
        cost_usd DECIMAL(10,6),
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Trust signals table for user feedback and AI confidence
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS trust_signals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        interaction_id UUID REFERENCES ai_interactions(id) ON DELETE CASCADE,
        signal_type VARCHAR(100) NOT NULL,
        signal_value DECIMAL(3,2) CHECK (signal_value >= 0 AND signal_value <= 1),
        signal_metadata JSONB,
        source VARCHAR(100) NOT NULL CHECK (source IN ('user_feedback', 'ai_confidence', 'safety_check', 'fact_check')),
        confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Safety flags table for harmful content detection
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS safety_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        interaction_id UUID REFERENCES ai_interactions(id) ON DELETE CASCADE,
        flag_type VARCHAR(100) NOT NULL CHECK (flag_type IN ('harmful_content', 'bias_detected', 'factual_error', 'inappropriate_response')),
        severity_level VARCHAR(20) NOT NULL CHECK (severity_level IN ('low', 'medium', 'high', 'critical')),
        confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
        detection_method VARCHAR(100),
        flag_metadata JSONB,
        is_resolved BOOLEAN DEFAULT false,
        resolved_by UUID REFERENCES users(id),
        resolved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Performance metrics table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        interaction_id UUID REFERENCES ai_interactions(id) ON DELETE CASCADE,
        metric_name VARCHAR(100) NOT NULL,
        metric_value DECIMAL(10,4) NOT NULL,
        metric_unit VARCHAR(50),
        metric_metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Audit log table for system changes
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Data retention policies table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS retention_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_name VARCHAR(100) NOT NULL,
        retention_days INTEGER NOT NULL,
        archival_enabled BOOLEAN DEFAULT true,
        deletion_enabled BOOLEAN DEFAULT false,
        last_cleanup TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
  }

  public async createIndexes(): Promise<void> {
    // Performance indexes for high-volume queries
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON ai_interactions(created_at DESC)
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON ai_interactions(user_id)
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_interactions_session_id ON ai_interactions(session_id)
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_interactions_type ON ai_interactions(interaction_type)
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_interactions_model ON ai_interactions(ai_model_version, ai_model_provider)
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_trust_signals_interaction ON trust_signals(interaction_id)
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_trust_signals_type ON trust_signals(signal_type)
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_safety_flags_interaction ON safety_flags(interaction_id)
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_safety_flags_severity ON safety_flags(severity_level, is_resolved)
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_interaction ON performance_metrics(interaction_id)
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC)
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC)
    `);

    // Composite indexes for complex queries
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_interactions_user_date ON ai_interactions(user_id, created_at DESC)
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_interactions_type_date ON ai_interactions(interaction_type, created_at DESC)
    `);

    // Full-text search indexes
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_interactions_prompt_fts ON ai_interactions USING gin(to_tsvector('english', prompt_content))
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_interactions_response_fts ON ai_interactions USING gin(to_tsvector('english', response_content))
    `);
  }

  public async createPartitions(): Promise<void> {
    // Create partitioned tables for high-volume data management
    // This will be implemented based on specific partitioning strategy
    console.log('Partitioning strategy will be implemented based on data volume analysis');
  }

  public async dropTables(): Promise<void> {
    const tables = [
      'retention_policies',
      'audit_logs',
      'performance_metrics',
      'safety_flags',
      'trust_signals',
      'ai_interactions',
      'users'
    ];

    for (const table of tables) {
      await this.db.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
  }
}

export default DatabaseSchemaImpl;

