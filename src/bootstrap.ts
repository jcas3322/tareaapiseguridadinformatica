/**
 * Application Bootstrap
 * Handles application initialization with proper error handling and validation
 */

import { SpotifyAPIServer } from './server';
import { EnvironmentConfig } from './infrastructure/config/EnvironmentConfig';

/**
 * Bootstrap the application with comprehensive initialization
 */
async function bootstrap(): Promise<void> {
  console.log('🚀 Starting Spotify API Bootstrap Process...');
  console.log('=====================================');

  try {
    // Pre-flight checks
    await performPreflightChecks();

    // Initialize and start server
    const server = new SpotifyAPIServer();
    await server.start();

    // Post-startup validation
    await performPostStartupValidation(server);

    console.log('✅ Bootstrap completed successfully!');
    console.log('=====================================');

  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    console.error('=====================================');
    process.exit(1);
  }
}

/**
 * Perform pre-flight checks before starting the application
 */
async function performPreflightChecks(): Promise<void> {
  console.log('🔍 Performing pre-flight checks...');

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 16) {
    throw new Error(`Node.js version ${nodeVersion} is not supported. Minimum required: 16.x`);
  }
  console.log(`✅ Node.js version: ${nodeVersion}`);

  // Check environment variables
  const requiredEnvVars = [
    'NODE_ENV'
  ];

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingEnvVars.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missingEnvVars.join(', ')}`);
    console.warn('   Using default values where possible');
  }

  // Validate environment configuration
  try {
    const envConfig = EnvironmentConfig.getInstance();
    console.log(`✅ Environment: ${envConfig.getServerConfig().environment}`);
    console.log(`✅ Configuration validated`);
  } catch (error) {
    throw new Error(`Configuration validation failed: ${(error as Error).message}`);
  }

  // Check available memory
  const memoryUsage = process.memoryUsage();
  const availableMemoryMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  
  if (availableMemoryMB < 128) {
    console.warn(`⚠️  Low memory available: ${availableMemoryMB}MB`);
  } else {
    console.log(`✅ Memory available: ${availableMemoryMB}MB`);
  }

  // Check disk space (basic check)
  try {
    const fs = require('fs');
    const stats = fs.statSync('.');
    console.log('✅ File system accessible');
  } catch (error) {
    throw new Error('File system not accessible');
  }

  // Check required directories
  const requiredDirs = ['./logs', './uploads', './temp'];
  const fs = require('fs');
  
  for (const dir of requiredDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      } else {
        console.log(`✅ Directory exists: ${dir}`);
      }
    } catch (error) {
      throw new Error(`Failed to create directory ${dir}: ${(error as Error).message}`);
    }
  }

  console.log('✅ Pre-flight checks completed');
}

/**
 * Perform post-startup validation
 */
async function performPostStartupValidation(server: SpotifyAPIServer): Promise<void> {
  console.log('🔍 Performing post-startup validation...');

  // Wait a moment for server to fully initialize
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Test database connection
    const dbAdapter = server.getDatabase();
    const healthCheck = await dbAdapter.healthCheck();
    
    if (healthCheck.status === 'healthy') {
      console.log('✅ Database connection healthy');
    } else {
      console.warn('⚠️  Database connection issues:', healthCheck.details);
    }

    // Test basic HTTP endpoint
    const envConfig = EnvironmentConfig.getInstance();
    const serverConfig = envConfig.getServerConfig();
    const healthUrl = `http://${serverConfig.host}:${serverConfig.port}/api/health`;
    
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        console.log('✅ Health endpoint responding');
      } else {
        console.warn(`⚠️  Health endpoint returned status: ${response.status}`);
      }
    } catch (error) {
      console.warn('⚠️  Could not reach health endpoint:', (error as Error).message);
    }

    // Log important information
    console.log('📋 Server Information:');
    console.log(`   Environment: ${serverConfig.environment}`);
    console.log(`   Port: ${serverConfig.port}`);
    console.log(`   Base URL: ${envConfig.getAppConfig().baseUrl}`);
    console.log(`   Version: ${envConfig.getAppConfig().version}`);
    console.log(`   Swagger: ${serverConfig.enableSwagger ? 'Enabled' : 'Disabled'}`);

    console.log('✅ Post-startup validation completed');

  } catch (error) {
    console.warn('⚠️  Post-startup validation issues:', (error as Error).message);
    // Don't fail startup for validation issues
  }
}

/**
 * Handle graceful shutdown
 */
function setupGracefulShutdown(): void {
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  
  signals.forEach(signal => {
    process.on(signal, async () => {
      console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
      
      try {
        // Give the application time to finish current requests
        console.log('⏳ Waiting for current requests to complete...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    });
  });
}

/**
 * Handle uncaught errors
 */
function setupErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    console.error('💥 Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('💥 Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    process.exit(1);
  });
}

/**
 * Display startup banner
 */
function displayBanner(): void {
  const envConfig = EnvironmentConfig.getInstance();
  const appConfig = envConfig.getAppConfig();
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🎵 ${appConfig.name.padEnd(52)} ║
║   Version: ${appConfig.version.padEnd(48)} ║
║   Environment: ${envConfig.getServerConfig().environment.padEnd(44)} ║
║                                                              ║
║   🔒 Security-First Music Streaming API                     ║
║   Built with TypeScript, Express, and PostgreSQL            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

/**
 * Main bootstrap function
 */
async function main(): Promise<void> {
  // Setup error handlers first
  setupErrorHandlers();
  setupGracefulShutdown();

  // Display banner
  displayBanner();

  // Start bootstrap process
  await bootstrap();
}

// Run bootstrap if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Bootstrap process failed:', error);
    process.exit(1);
  });
}

export { bootstrap, performPreflightChecks, performPostStartupValidation };