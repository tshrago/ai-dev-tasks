import DatabaseConnection from './connection';
import DatabaseSchemaImpl from './schema';

async function rollbackMigrations(): Promise<void> {
  const db = DatabaseConnection.getInstance();
  const schema = new DatabaseSchemaImpl();

  try {
    console.log('Starting database rollback...');

    // Check database connection
    const isHealthy = await db.healthCheck();
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }

    console.log('Dropping all tables...');
    await schema.dropTables();

    console.log('Rollback completed successfully!');
    console.log('All tables have been dropped.');

  } catch (error) {
    console.error('Rollback failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run rollback if this file is executed directly
if (require.main === module) {
  rollbackMigrations();
}

export default rollbackMigrations;

