import DatabaseConnection from '../../src/database/connection';

describe('DatabaseConnection', () => {
  let dbConnection: DatabaseConnection;

  beforeAll(() => {
    dbConnection = DatabaseConnection.getInstance();
  });

  afterAll(async () => {
    await dbConnection.close();
  });

  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = DatabaseConnection.getInstance();
      const instance2 = DatabaseConnection.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('healthCheck', () => {
    it('should return true when database is healthy', async () => {
      const isHealthy = await dbConnection.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics', () => {
      const stats = dbConnection.getPoolStats();
      expect(stats).toHaveProperty('totalCount');
      expect(stats).toHaveProperty('idleCount');
      expect(stats).toHaveProperty('waitingCount');
      expect(typeof stats.totalCount).toBe('number');
      expect(typeof stats.idleCount).toBe('number');
      expect(typeof stats.waitingCount).toBe('number');
    });
  });

  describe('query', () => {
    it('should execute a simple query', async () => {
      const result = await dbConnection.query('SELECT 1 as test');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].test).toBe(1);
    });

    it('should execute a query with parameters', async () => {
      const result = await dbConnection.query('SELECT $1 as value', ['test']);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].value).toBe('test');
    });
  });

  describe('transaction', () => {
    it('should execute a transaction successfully', async () => {
      const result = await dbConnection.transaction(async (client) => {
        const queryResult = await client.query('SELECT 1 as test');
        return queryResult.rows[0].test;
      });
      expect(result).toBe(1);
    });

    it('should rollback on error', async () => {
      await expect(
        dbConnection.transaction(async (client) => {
          await client.query('SELECT 1');
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
  });
});

