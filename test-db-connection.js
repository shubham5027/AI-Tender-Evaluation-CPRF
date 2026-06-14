import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

console.log('Testing Aurora PostgreSQL Connection...\n');

const databaseUrl = process.env.DATABASE_URL;

console.log('Configuration:');
console.log('- DATABASE_URL:', databaseUrl ? 'SET' : 'NOT SET');
console.log();

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is required in .env file');
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 30000
});

try {
  console.log('Connecting to Aurora PostgreSQL...\n');

  await client.connect();

  console.log('✅ Successfully connected');

  const versionResult = await client.query('SELECT version()');
  console.log('\nDatabase Version:');
  console.log(versionResult.rows[0].version);

  const dbResult = await client.query('SELECT current_database()');
  console.log('\nCurrent Database:');
  console.log(dbResult.rows[0].current_database);

  const userResult = await client.query('SELECT current_user');
  console.log('\nCurrent User:');
  console.log(userResult.rows[0].current_user);

  const timeResult = await client.query('SELECT NOW()');
  console.log('\nServer Time:');
  console.log(timeResult.rows[0].now);

  console.log('\n✅ Aurora PostgreSQL connection test PASSED');

} catch (error) {
  console.error('\n❌ Connection Failed');
  console.error('--------------------------------');
  console.error('Message:', error.message);
  console.error('Code:', error.code);
  console.error('Name:', error.name);

  if (error.stack) {
    console.error('\nStack Trace:');
    console.error(error.stack);
  }

} finally {
  try {
    await client.end();
  } catch {}
}