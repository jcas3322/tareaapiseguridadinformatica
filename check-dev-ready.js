/**
 * Development Environment Readiness Check
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando entorno de desarrollo...\n');

let allGood = true;

// Check 1: .env file
console.log('1. Verificando archivo .env...');
if (fs.existsSync('.env')) {
    console.log('   ✅ Archivo .env encontrado');
    
    // Load and check key variables
    require('dotenv').config();
    const requiredVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.log(`   ⚠️  Variables faltantes: ${missingVars.join(', ')}`);
    } else {
        console.log('   ✅ Variables de entorno configuradas');
    }
} else {
    console.log('   ❌ Archivo .env no encontrado');
    allGood = false;
}

// Check 2: TypeScript config
console.log('\n2. Verificando configuración TypeScript...');
if (fs.existsSync('tsconfig.json')) {
    console.log('   ✅ tsconfig.json encontrado');
} else {
    console.log('   ❌ tsconfig.json no encontrado');
    allGood = false;
}

// Check 3: Main server file
console.log('\n3. Verificando archivo servidor...');
if (fs.existsSync('src/server.ts')) {
    console.log('   ✅ src/server.ts encontrado');
} else {
    console.log('   ❌ src/server.ts no encontrado');
    allGood = false;
}

// Check 4: Node modules
console.log('\n4. Verificando dependencias...');
if (fs.existsSync('node_modules')) {
    console.log('   ✅ node_modules encontrado');
    
    // Check key dependencies
    const keyDeps = ['express', 'typescript', 'ts-node', 'dotenv', 'pg'];
    const missingDeps = keyDeps.filter(dep => !fs.existsSync(`node_modules/${dep}`));
    
    if (missingDeps.length > 0) {
        console.log(`   ⚠️  Dependencias faltantes: ${missingDeps.join(', ')}`);
        console.log('   💡 Ejecuta: npm install');
    } else {
        console.log('   ✅ Dependencias principales instaladas');
    }
} else {
    console.log('   ❌ node_modules no encontrado');
    console.log('   💡 Ejecuta: npm install');
    allGood = false;
}

// Check 5: Database connection
console.log('\n5. Verificando conexión a base de datos...');
const { Pool } = require('pg');

async function checkDatabase() {
    try {
        const pool = new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
        });

        await pool.query('SELECT NOW()');
        console.log('   ✅ Conexión a base de datos exitosa');
        
        // Check if tables exist
        const tablesResult = await pool.query(`
            SELECT COUNT(*) as table_count 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        const tableCount = parseInt(tablesResult.rows[0].table_count);
        if (tableCount > 0) {
            console.log(`   ✅ Base de datos tiene ${tableCount} tablas`);
        } else {
            console.log('   ⚠️  Base de datos vacía - ejecuta migraciones');
            console.log('   💡 Ejecuta: npm run migrate');
        }
        
        await pool.end();
    } catch (error) {
        console.log('   ❌ Error de conexión a base de datos');
        console.log(`   💡 Error: ${error.message}`);
        allGood = false;
    }
}

// Check 6: Required directories
console.log('\n6. Verificando directorios...');
const requiredDirs = ['src', 'logs', 'uploads'];
requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`   📁 Creado directorio: ${dir}`);
    } else {
        console.log(`   ✅ Directorio existe: ${dir}`);
    }
});

// Run database check
checkDatabase().then(() => {
    console.log('\n' + '='.repeat(50));
    
    if (allGood) {
        console.log('🎉 ¡Entorno de desarrollo listo!');
        console.log('\n🚀 Puedes ejecutar:');
        console.log('   npm run dev        # Iniciar servidor');
        console.log('   ./start-dev.sh     # Script de inicio');
        console.log('   npm run dev:watch  # Con auto-reload');
    } else {
        console.log('⚠️  Hay problemas que resolver antes de continuar');
        console.log('\n💡 Revisa los errores arriba y corrígelos');
    }
    
    console.log('='.repeat(50));
});