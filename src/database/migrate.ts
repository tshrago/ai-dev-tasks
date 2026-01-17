import DatabaseConnection from './connection';
import DatabaseSchemaImpl from './schema';

async function runMigrations(): Promise<void> {
  const db = DatabaseConnection.getInstance();
  const schema = new DatabaseSchemaImpl();

  try {
    console.log('Starting database migration...');

    // Check database connection
    const isHealthy = await db.healthCheck();
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }

    console.log('Creating tables...');
    await schema.createTables();

    console.log('Creating indexes...');
    await schema.createIndexes();

    console.log('Setting up partitions...');
    await schema.createPartitions();

    // Insert initial retention policies
    await db.query(`
      INSERT INTO retention_policies (table_name, retention_days, archival_enabled, deletion_enabled)
      VALUES 
        ('ai_interactions', 2555, true, false),
        ('trust_signals', 2555, true, false),
        ('safety_flags', 2555, true, false),
        ('performance_metrics', 365, true, true),
        ('audit_logs', 2555, true, false)
      ON CONFLICT (table_name) DO NOTHING
    `);

    // Create initial admin user if not exists
    const bcrypt = require('bcryptjs');
    const adminPasswordHash = await bcrypt.hash('admin123', 12);
    
    await db.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ('admin', 'admin@ai-logging.com', $1, 'admin')
      ON CONFLICT (username) DO NOTHING
    `, [adminPasswordHash]);

    console.log('Migration completed successfully!');
    console.log('Default admin credentials: admin / admin123');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export default runMigrations;

