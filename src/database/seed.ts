import DatabaseConnection from './connection';
import bcrypt from 'bcryptjs';

async function seedDatabase(): Promise<void> {
  const db = DatabaseConnection.getInstance();

  try {
    console.log('Starting database seeding...');

    // Check database connection
    const isHealthy = await db.healthCheck();
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }

    // Create sample users
    const users = [
      {
        username: 'developer1',
        email: 'dev1@ai-logging.com',
        password: 'dev123',
        role: 'developer'
      },
      {
        username: 'analyst1',
        email: 'analyst1@ai-logging.com',
        password: 'analyst123',
        role: 'analyst'
      },
      {
        username: 'compliance1',
        email: 'compliance1@ai-logging.com',
        password: 'compliance123',
        role: 'compliance_officer'
      }
    ];

    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, 12);
      await db.query(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) DO NOTHING
      `, [user.username, user.email, passwordHash, user.role]);
    }

    // Create sample AI interactions
    const sampleInteractions = [
      {
        session_id: 'session_001',
        interaction_type: 'text',
        prompt_content: 'What is artificial intelligence?',
        response_content: 'Artificial intelligence (AI) is a branch of computer science that aims to create intelligent machines that work and react like humans.',
        ai_model_version: 'gpt-4',
        ai_model_provider: 'openai',
        processing_time_ms: 1200,
        token_count: 45
      },
      {
        session_id: 'session_002',
        interaction_type: 'text',
        prompt_content: 'Explain machine learning',
        response_content: 'Machine learning is a subset of AI that enables computers to learn and improve from experience without being explicitly programmed.',
        ai_model_version: 'gpt-4',
        ai_model_provider: 'openai',
        processing_time_ms: 980,
        token_count: 38
      }
    ];

    for (const interaction of sampleInteractions) {
      const result = await db.query(`
        INSERT INTO ai_interactions (session_id, interaction_type, prompt_content, response_content, ai_model_version, ai_model_provider, processing_time_ms, token_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        interaction.session_id,
        interaction.interaction_type,
        interaction.prompt_content,
        interaction.response_content,
        interaction.ai_model_version,
        interaction.ai_model_provider,
        interaction.processing_time_ms,
        interaction.token_count
      ]);

      const interactionId = result.rows[0].id;

      // Add sample trust signals
      await db.query(`
        INSERT INTO trust_signals (interaction_id, signal_type, signal_value, source, confidence_score)
        VALUES ($1, 'user_satisfaction', 0.85, 'user_feedback', 0.9)
      `, [interactionId]);

      // Add sample performance metrics
      await db.query(`
        INSERT INTO performance_metrics (interaction_id, metric_name, metric_value, metric_unit)
        VALUES ($1, 'response_time', $2, 'ms')
      `, [interactionId, interaction.processing_time_ms]);
    }

    console.log('Database seeding completed successfully!');
    console.log('Sample users created:');
    users.forEach(user => {
      console.log(`  ${user.username} / ${user.password} (${user.role})`);
    });

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

export default seedDatabase;

