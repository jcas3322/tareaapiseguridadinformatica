#!/bin/bash

echo "🚀 Configurando proyecto Spotify API Security..."

# Función para mostrar errores
show_error() {
    echo "❌ Error: $1"
    exit 1
}

# Verificar Node.js
echo "🔍 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    show_error "Node.js no está instalado. Por favor instala Node.js 16 o superior."
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    show_error "Node.js versión $NODE_VERSION detectada. Se requiere versión 16 o superior."
fi

echo "✅ Node.js $(node -v) detectado"

# Verificar npm
echo "🔍 Verificando npm..."
if ! command -v npm &> /dev/null; then
    show_error "npm no está instalado."
fi

echo "✅ npm $(npm -v) detectado"

# Opción 1: Instalación mínima
echo ""
echo "Selecciona el tipo de instalación:"
echo "1) Instalación mínima (solo dependencias básicas)"
echo "2) Instalación completa (todas las dependencias)"
echo "3) Limpiar e intentar instalación completa"

read -p "Ingresa tu opción (1-3): " option

case $option in
    1)
        echo "📦 Instalando dependencias mínimas..."
        cp package-minimal.json package.json
        npm install --no-optional --no-audit --no-fund
        ;;
    2)
        echo "📦 Instalando todas las dependencias..."
        npm install --no-optional --no-audit --no-fund
        ;;
    3)
        echo "🧹 Limpiando instalación anterior..."
        rm -rf node_modules package-lock.json
        npm cache clean --force
        echo "📦 Instalando todas las dependencias..."
        npm install --no-optional --no-audit --no-fund
        ;;
    *)
        show_error "Opción inválida"
        ;;
esac

# Verificar instalación
if [ $? -eq 0 ]; then
    echo "✅ Dependencias instaladas correctamente!"
    
    # Crear directorios necesarios
    echo "📁 Creando estructura de directorios..."
    mkdir -p src/{domain,application,infrastructure,shared}
    mkdir -p tests/{unit,integration,security,e2e}
    mkdir -p logs
    mkdir -p uploads
    
    echo "✅ Estructura de directorios creada!"
    
    # Crear archivo .env de ejemplo si no existe
    if [ ! -f .env ]; then
        echo "⚙️ Creando archivo .env de ejemplo..."
        cat > .env << EOF
# Servidor
NODE_ENV=development
PORT=3000
HOST=localhost

# Base de datos (configura según tu setup)
DATABASE_URL=postgresql://username:password@localhost:5432/spotify_api

# Seguridad
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
BCRYPT_ROUNDS=10

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=debug
EOF
        echo "✅ Archivo .env creado!"
    fi
    
    echo ""
    echo "🎉 ¡Proyecto configurado exitosamente!"
    echo ""
    echo "Próximos pasos:"
    echo "1. Configura tu base de datos en el archivo .env"
    echo "2. Ejecuta 'npm run build' para compilar el proyecto"
    echo "3. Ejecuta 'npm run dev' para iniciar en modo desarrollo"
    echo ""
    echo "Para más información, consulta el README.md"
    
else
    show_error "Falló la instalación de dependencias. Revisa los errores arriba."
fi