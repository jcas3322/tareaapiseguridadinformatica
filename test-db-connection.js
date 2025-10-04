/**
 * Simple database connection test
 */

require('dotenv').config();
const { Pool } = require('pg');

async function testConnection() {
  console.log('🔍 Testing database connection...');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'spotify_api',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  };

  console.log('📋 Connection config:');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}`);
  console.log(`   SSL: ${config.ssl ? 'enabled' : 'disabled'}`);

  const pool = new Pool(config);

  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('📊 Database info:');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    console.log(`   PostgreSQL version: ${result.rows[0].postgres_version.split(' ')[0]}`);
    
    client.release();
    
    // Test if database exists and has tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('📋 Existing tables:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('📋 No tables found - database is empty');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   💡 Suggestion: Make sure PostgreSQL is running');
      console.error('   💡 Try: sudo systemctl start postgresql');
    } else if (error.code === '3D000') {
      console.error('   💡 Suggestion: Database does not exist');
      console.error('   💡 Try: sudo -u postgres createdb spotify_api');
    } else if (error.code === '28P01') {
      console.error('   💡 Suggestion: Authentication failed - check username/password');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();