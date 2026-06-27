import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;
// const databaseUrl = 'postgresql://postgres:IVUvbnE1XrRwp8Mqdjv2@database-1.cluster-c6jeseqqi6mu.us-east-1.rds.amazonaws.com:5432/postgres';

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is required');
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  },
});

async function migrate() {
  try {
    await client.connect();
    console.log('✓ Connected to PostgreSQL');

    // Create app_state table
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id VARCHAR(255) PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 0,
        state JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created app_state table');

    // Create ocr_results table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ocr_results (
        id SERIAL PRIMARY KEY,
        file_id VARCHAR(255),
        source_scope VARCHAR(50),
        tender_id VARCHAR(255),
        bidder_id VARCHAR(255),
        file_url TEXT,
        has_file_base64 BOOLEAN,
        language VARCHAR(50),
        provider VARCHAR(50),
        text TEXT,
        raw_response JSONB,
        error_message TEXT,
        failed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created ocr_results table');

    // Create tender_policy_ocr table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tender_policy_ocr (
        id SERIAL PRIMARY KEY,
        file_id VARCHAR(255),
        source_scope VARCHAR(50),
        tender_id VARCHAR(255),
        bidder_id VARCHAR(255),
        file_url TEXT,
        has_file_base64 BOOLEAN,
        language VARCHAR(50),
        provider VARCHAR(50),
        text TEXT,
        raw_response JSONB,
        error_message TEXT,
        failed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created tender_policy_ocr table');

    // Create bidder_document_ocr table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bidder_document_ocr (
        id SERIAL PRIMARY KEY,
        file_id VARCHAR(255),
        source_scope VARCHAR(50),
        tender_id VARCHAR(255),
        bidder_id VARCHAR(255),
        file_url TEXT,
        has_file_base64 BOOLEAN,
        language VARCHAR(50),
        provider VARCHAR(50),
        text TEXT,
        raw_response JSONB,
        error_message TEXT,
        failed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created bidder_document_ocr table');

    // Create evaluations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id SERIAL PRIMARY KEY,
        tender_id VARCHAR(255) NOT NULL,
        bidder_id VARCHAR(255) NOT NULL,
        bidder_name VARCHAR(255) NOT NULL,
        criterion_id VARCHAR(255) NOT NULL,
        criterion_name VARCHAR(255) NOT NULL,
        criterion_category VARCHAR(255),
        criterion_weight VARCHAR(255),
        criterion_description TEXT,
        criterion_threshold VARCHAR(255),
        ocr_text TEXT,
        source_document TEXT,
        decision VARCHAR(50),
        confidence NUMERIC,
        extracted_value TEXT,
        explanation TEXT,
        ai_provider VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created evaluations table');

    // Create evaluation_traces table
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluation_traces (
        id SERIAL PRIMARY KEY,
        evaluation_key INTEGER,
        tender_id VARCHAR(255),
        bidder_id VARCHAR(255),
        criterion_id VARCHAR(255),
        decision VARCHAR(50),
        ai_provider VARCHAR(50),
        duration_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created evaluation_traces table');

    // Create upload_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS upload_events (
        id SERIAL PRIMARY KEY,
        scope VARCHAR(50),
        tender_id VARCHAR(255),
        bidder_id VARCHAR(255),
        file_name VARCHAR(255),
        file_size INTEGER,
        content_type VARCHAR(255),
        s3_key TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created upload_events table');

    // Create indexes for better performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_ocr_results_tender_id ON ocr_results(tender_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ocr_results_bidder_id ON ocr_results(bidder_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_evaluations_tender_id ON evaluations(tender_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_evaluations_bidder_id ON evaluations(bidder_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_evaluations_criterion_id ON evaluations(criterion_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_upload_events_tender_id ON upload_events(tender_id)');
    console.log('✓ Created indexes');

    await client.end();
    console.log('\n✅ PostgreSQL migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await client.end();
    process.exit(1);
  }
}

migrate();
