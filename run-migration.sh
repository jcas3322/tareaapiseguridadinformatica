#!/bin/bash

echo "🚀 Ejecutando migraciones de base de datos..."

# Verificar que existe el archivo .env
if [ ! -f .env ]; then
    echo "❌ Error: Archivo .env no encontrado"
    echo "💡 Copia .env.example a .env y configura tus variables"
    exit 1
fi

# Verificar que Node.js puede cargar dotenv
if ! node -e "require('dotenv').config(); console.log('✅ dotenv cargado')"; then
    echo "❌ Error: No se puede cargar dotenv"
    echo "💡 Instala dotenv: npm install dotenv"
    exit 1
fi

# Probar conexión primero
echo "🔍 Probando conexión a la base de datos..."
if node test-db-connection.js; then
    echo "✅ Conexión exitosa, procediendo con migraciones..."
else
    echo "❌ Error de conexión, no se pueden ejecutar migraciones"
    exit 1
fi

# Ejecutar migraciones
echo "📊 Ejecutando migraciones..."
node src/infrastructure/database/migrations/migrate.js

if [ $? -eq 0 ]; then
    echo "🎉 ¡Migraciones completadas exitosamente!"
else
    echo "❌ Error ejecutando migraciones"
    exit 1
fi