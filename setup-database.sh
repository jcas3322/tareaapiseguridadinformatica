#!/bin/bash

echo "🗄️  Configurando base de datos para Spotify API Security..."

# Cargar variables de entorno
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Valores por defecto
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-spotify_api}
DB_USER=${DB_USER:-postgres}

echo "📋 Configuración de base de datos:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"

# Función para mostrar errores
show_error() {
    echo "❌ Error: $1"
    exit 1
}

# Verificar si PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL no está instalado."
    echo "💡 Para instalar en Ubuntu/Debian:"
    echo "   sudo apt update"
    echo "   sudo apt install postgresql postgresql-contrib"
    echo ""
    echo "💡 Para instalar en macOS:"
    echo "   brew install postgresql"
    echo ""
    exit 1
fi

# Verificar si PostgreSQL está corriendo
if ! sudo systemctl is-active --quiet postgresql 2>/dev/null && ! brew services list | grep postgresql | grep started &>/dev/null; then
    echo "⚠️  PostgreSQL no está corriendo."
    echo "💡 Para iniciar en Ubuntu/Debian:"
    echo "   sudo systemctl start postgresql"
    echo "   sudo systemctl enable postgresql"
    echo ""
    echo "💡 Para iniciar en macOS:"
    echo "   brew services start postgresql"
    echo ""
    exit 1
fi

echo "✅ PostgreSQL está corriendo"

# Probar conexión básica
echo "🔍 Probando conexión a PostgreSQL..."
if ! sudo -u postgres psql -c "SELECT version();" &>/dev/null; then
    show_error "No se puede conectar a PostgreSQL como usuario postgres"
fi

echo "✅ Conexión a PostgreSQL exitosa"

# Verificar si la base de datos existe
echo "🔍 Verificando si la base de datos '$DB_NAME' existe..."
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "✅ La base de datos '$DB_NAME' ya existe"
else
    echo "📝 Creando base de datos '$DB_NAME'..."
    if sudo -u postgres createdb $DB_NAME; then
        echo "✅ Base de datos '$DB_NAME' creada exitosamente"
    else
        show_error "No se pudo crear la base de datos '$DB_NAME'"
    fi
fi

# Verificar si el usuario existe (si no es postgres)
if [ "$DB_USER" != "postgres" ]; then
    echo "🔍 Verificando usuario '$DB_USER'..."
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
        echo "✅ El usuario '$DB_USER' ya existe"
    else
        echo "📝 Creando usuario '$DB_USER'..."
        read -s -p "Ingresa la contraseña para el usuario '$DB_USER': " DB_PASSWORD
        echo
        
        if sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"; then
            echo "✅ Usuario '$DB_USER' creado exitosamente"
            
            # Dar permisos al usuario
            sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
            echo "✅ Permisos otorgados al usuario '$DB_USER'"
        else
            show_error "No se pudo crear el usuario '$DB_USER'"
        fi
    fi
fi

# Probar conexión con Node.js
echo "🔍 Probando conexión desde Node.js..."
if node test-db-connection.js; then
    echo "✅ Conexión desde Node.js exitosa"
else
    echo "❌ Error en la conexión desde Node.js"
    echo "💡 Verifica tu archivo .env y las credenciales de la base de datos"
    exit 1
fi

# Ejecutar migraciones
echo "🚀 Ejecutando migraciones..."
if npm run migrate; then
    echo "✅ Migraciones ejecutadas exitosamente"
else
    echo "❌ Error ejecutando migraciones"
    exit 1
fi

echo ""
echo "🎉 ¡Base de datos configurada exitosamente!"
echo ""
echo "📋 Resumen:"
echo "   ✅ PostgreSQL instalado y corriendo"
echo "   ✅ Base de datos '$DB_NAME' creada"
echo "   ✅ Usuario '$DB_USER' configurado"
echo "   ✅ Conexión desde Node.js funcionando"
echo "   ✅ Migraciones ejecutadas"
echo ""
echo "🚀 Ahora puedes ejecutar:"
echo "   npm run build    # Para compilar el proyecto"
echo "   npm run dev      # Para iniciar en modo desarrollo"