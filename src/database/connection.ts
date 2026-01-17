import { Pool, PoolClient, QueryResult } from 'pg';
import { databaseConfig } from '../config/database';

class DatabaseConnection {
  private pool: Pool;
  private static instance: DatabaseConnection;

  private constructor() {
    this.pool = new Pool({
      host: databaseConfig.host,
      port: databaseConfig.port,
      database: databaseConfig.database,
      user: databaseConfig.user,
      password: databaseConfig.password,
      ssl: databaseConfig.ssl,
      max: databaseConfig.maxConnections,
      idleTimeoutMillis: databaseConfig.idleTimeout,
      connectionTimeoutMillis: databaseConfig.connectionTimeout,
      // Additional performance optimizations for high-volume data
      statement_timeout: 30000, // 30 seconds
      query_timeout: 30000, // 30 seconds
      application_name: 'ai-interaction-logging-system',
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    // Handle pool connection events
    this.pool.on('connect', (client) => {
      // Set session-level optimizations
      client.query('SET SESSION statement_timeout = 30000');
      client.query('SET SESSION query_timeout = 30000');
      client.query('SET SESSION work_mem = 4MB');
      client.query('SET SESSION temp_buffers = 8MB');
    });
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  public async query(text: string, params?: any[]): Promise<QueryResult> {
    const client = await this.getClient();
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1');
      return result.rows.length > 0;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public getPool(): Pool {
    return this.pool;
  }

  // Method to get pool statistics for monitoring
  public getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

export default DatabaseConnection;

