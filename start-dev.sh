#!/bin/bash

echo "🚀 Iniciando Spotify API en modo desarrollo..."

# Verificar que existe el archivo .env
if [ ! -f .env ]; then
    echo "❌ Error: Archivo .env no encontrado"
    echo "💡 Asegúrate de tener el archivo .env configurado"
    exit 1
fi

# Verificar conexión a la base de datos
echo "🔍 Verificando conexión a la base de datos..."
if node test-db-connection.js > /dev/null 2>&1; then
    echo "✅ Conexión a la base de datos exitosa"
else
    echo "⚠️  Advertencia: No se pudo conectar a la base de datos"
    echo "💡 El servidor iniciará pero algunas funciones pueden no funcionar"
fi

# Crear directorios necesarios
mkdir -p logs uploads

echo "🎵 Iniciando servidor..."
echo "================================"
echo "🌐 URL: http://localhost:3000"
echo "💚 Health: http://localhost:3000/health"
echo "🔧 API: http://localhost:3000/api"
echo "================================"
echo ""

# Iniciar el servidor
npm run dev