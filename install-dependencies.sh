#!/bin/bash

echo "🧹 Limpiando instalación anterior..."

# Limpiar cache de npm
npm cache clean --force

# Eliminar node_modules y package-lock.json si existen
rm -rf node_modules
rm -f package-lock.json

echo "📦 Instalando dependencias..."

# Instalar dependencias básicas primero
npm install --no-optional --no-audit --no-fund

echo "✅ Instalación completada!"

# Verificar instalación
echo "🔍 Verificando instalación..."
npm list --depth=0

echo "🎉 ¡Listo! Ahora puedes ejecutar:"
echo "  npm run build    # Para compilar el proyecto"
echo "  npm run dev      # Para desarrollo (requiere compilar primero)"