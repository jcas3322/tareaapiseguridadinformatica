# Guía de Solución de Problemas - npm install

Esta guía te ayudará a resolver los problemas más comunes al instalar las dependencias del proyecto.

## 🚨 Problemas Comunes y Soluciones

### 1. Errores de Versión de Node.js

**Error:** `engine node: wanted: >=18.0.0`

**Solución:**
```bash
# Verificar versión actual
node -v

# Si es menor a 16, actualizar Node.js
# Opción 1: Usar nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Opción 2: Descargar desde nodejs.org
# https://nodejs.org/
```

### 2. Errores de Permisos

**Error:** `EACCES: permission denied`

**Solución:**
```bash
# Cambiar propietario de la carpeta npm global
sudo chown -R $(whoami) ~/.npm

# O usar npx en lugar de instalación global
npx create-react-app my-app
```

### 3. Errores de Dependencias Nativas (bcrypt, sharp, etc.)

**Error:** `node-gyp rebuild failed`

**Solución Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install build-essential python3-dev
npm install
```

**Solución macOS:**
```bash
xcode-select --install
npm install
```

**Solución Windows:**
```bash
npm install --global windows-build-tools
npm install
```

### 4. Errores de Cache de npm

**Error:** `npm ERR! Unexpected end of JSON input`

**Solución:**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 5. Errores de Red/Proxy

**Error:** `ETIMEDOUT` o `ENOTFOUND`

**Solución:**
```bash
# Configurar registry
npm config set registry https://registry.npmjs.org/

# Si estás detrás de un proxy
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Aumentar timeout
npm config set timeout 60000
```

## 🛠️ Soluciones Paso a Paso

### Opción 1: Instalación Automática (Recomendada)

```bash
# Ejecutar script de configuración
./setup-project.sh
```

### Opción 2: Instalación Manual Básica

```bash
# 1. Limpiar instalación anterior
rm -rf node_modules package-lock.json
npm cache clean --force

# 2. Usar package.json mínimo
cp package-minimal.json package.json

# 3. Instalar dependencias básicas
npm install --no-optional --no-audit --no-fund

# 4. Verificar instalación
npm list --depth=0
```

### Opción 3: Instalación por Partes

```bash
# 1. Instalar dependencias de producción primero
npm install express cors helmet bcrypt jose winston pg joi uuid dotenv

# 2. Instalar dependencias de desarrollo
npm install -D typescript ts-node @types/node @types/express @types/cors @types/bcrypt @types/pg @types/uuid

# 3. Instalar herramientas de desarrollo
npm install -D jest ts-jest eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

### Opción 4: Usar Yarn (Alternativa)

```bash
# Instalar yarn si no lo tienes
npm install -g yarn

# Limpiar e instalar con yarn
rm -rf node_modules package-lock.json
yarn install
```

## 🔍 Diagnóstico de Problemas

### Verificar Entorno

```bash
# Información del sistema
node -v
npm -v
npm config list

# Verificar permisos
ls -la ~/.npm

# Verificar conectividad
npm ping
```

### Logs Detallados

```bash
# Instalar con logs detallados
npm install --loglevel verbose

# Ver logs de npm
npm config get cache
ls ~/.npm/_logs/
```

## 📋 Checklist de Verificación

Antes de reportar un problema, verifica:

- [ ] Node.js versión 16 o superior instalado
- [ ] npm versión 7 o superior
- [ ] Permisos correctos en ~/.npm
- [ ] Conexión a internet estable
- [ ] No hay archivos package-lock.json corruptos
- [ ] Cache de npm limpio

## 🆘 Si Nada Funciona

### Instalación Completamente Limpia

```bash
# 1. Desinstalar Node.js completamente
# En Ubuntu/Debian:
sudo apt remove nodejs npm
sudo apt autoremove

# 2. Reinstalar Node.js usando nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# 3. Verificar instalación
node -v
npm -v

# 4. Clonar proyecto nuevamente
cd ..
rm -rf spotify-api-security
git clone <repository-url>
cd spotify-api-security

# 5. Ejecutar script de configuración
./setup-project.sh
```

### Usar Docker (Alternativa)

Si los problemas persisten, puedes usar Docker:

```bash
# Crear Dockerfile simple
cat > Dockerfile.dev << EOF
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
EOF

# Construir y ejecutar
docker build -f Dockerfile.dev -t spotify-api-dev .
docker run -p 3000:3000 -v $(pwd):/app spotify-api-dev
```

## 📞 Obtener Ayuda

Si sigues teniendo problemas:

1. **Revisa los logs:** Busca el error específico en los logs de npm
2. **Busca en GitHub Issues:** Muchos problemas ya están documentados
3. **Stack Overflow:** Busca el error específico
4. **Documentación oficial:** https://docs.npmjs.com/

## 🔧 Comandos Útiles de Diagnóstico

```bash
# Información del sistema
npm doctor

# Verificar configuración
npm config list -l

# Verificar dependencias
npm ls

# Verificar vulnerabilidades
npm audit

# Limpiar todo
npm cache clean --force
rm -rf node_modules package-lock.json ~/.npm
```

---

**Nota:** Si encuentras un error específico que no está cubierto aquí, por favor documéntalo para ayudar a otros desarrolladores.