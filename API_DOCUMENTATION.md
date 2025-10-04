# Spotify API Security - Documentación Completa

## 🚀 Inicio Rápido

### Iniciar el Servidor
```bash
npm run dev
```

El servidor se iniciará en `http://localhost:3000`

### URLs Importantes
- **API Base**: `http://localhost:3000/api`
- **Documentación Swagger**: `http://localhost:3000/api/docs`
- **Health Check**: `http://localhost:3000/api/health`
- **Métricas**: `http://localhost:3000/api/metrics`

## 📚 Documentación Swagger

La documentación completa de la API está disponible en **Swagger UI** en:
```
http://localhost:3000/api/docs
```

### Características de la Documentación

✅ **Endpoints Documentados:**
- **Autenticación** (`/auth/*`)
  - Registro de usuarios
  - Login/Logout
  - Refresh de tokens
- **Usuarios** (`/users/*`)
  - Gestión de perfiles
  - Actualización de información
  - Eliminación de cuentas
- **Canciones** (`/songs/*`)
  - Listado público con filtros
  - Subida de archivos de audio
  - Gestión CRUD completa
- **Álbumes** (`/albums/*`)
  - Creación y gestión de álbumes
  - Listado con filtros avanzados
  - Asociación con canciones

✅ **Características Avanzadas:**
- **Esquemas de datos** completos
- **Ejemplos de requests/responses**
- **Códigos de error documentados**
- **Autenticación JWT integrada**
- **Validación de parámetros**
- **Filtros y paginación**

## 🔐 Autenticación

### Registro de Usuario
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@ejemplo.com",
    "password": "Password123",
    "name": "Usuario Ejemplo"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@ejemplo.com",
    "password": "Password123"
  }'
```

### Usar Token en Requests
```bash
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

## 🎵 Ejemplos de Uso

### Crear un Álbum
```bash
curl -X POST http://localhost:3000/api/albums \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "title": "Mi Primer Álbum",
    "description": "Descripción del álbum",
    "genre": "Rock"
  }'
```

### Listar Canciones con Filtros
```bash
curl "http://localhost:3000/api/songs?page=1&limit=10&search=rock&sortBy=play_count&sortOrder=DESC"
```

### Subir una Canción
```bash
curl -X POST http://localhost:3000/api/songs \
  -H "Authorization: Bearer TU_TOKEN" \
  -F "title=Mi Nueva Canción" \
  -F "audioFile=@cancion.mp3"
```

## 🛡️ Características de Seguridad

### Implementadas
- ✅ **Autenticación JWT** con refresh tokens
- ✅ **Rate Limiting** por IP y usuario
- ✅ **Validación de entrada** con Joi
- ✅ **Hashing de contraseñas** con bcrypt
- ✅ **CORS** configurado
- ✅ **Headers de seguridad** con Helmet
- ✅ **Logging de auditoría** estructurado
- ✅ **Manejo de errores** robusto

### Validaciones
- **Contraseñas**: Mínimo 8 caracteres, mayúscula, minúscula y número
- **Emails**: Formato válido y únicos
- **Archivos**: Solo formatos de audio permitidos (MP3, WAV, FLAC, M4A)
- **Tamaños**: Límite de 50MB para archivos de audio

## 📊 Endpoints Principales

### Autenticación
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Registrar usuario | No |
| POST | `/auth/login` | Iniciar sesión | No |
| POST | `/auth/logout` | Cerrar sesión | Sí |
| POST | `/auth/refresh` | Renovar token | No |

### Usuarios
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/users/profile` | Obtener perfil | Sí |
| PUT | `/users/profile` | Actualizar perfil | Sí |
| DELETE | `/users/profile` | Eliminar cuenta | Sí |

### Canciones
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/songs` | Listar canciones | No |
| POST | `/songs` | Subir canción | Sí |
| GET | `/songs/{id}` | Obtener canción | No |
| PUT | `/songs/{id}` | Actualizar canción | Sí |
| DELETE | `/songs/{id}` | Eliminar canción | Sí |

### Álbumes
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/albums` | Listar álbumes | No |
| POST | `/albums` | Crear álbum | Sí |
| GET | `/albums/{id}` | Obtener álbum | No |
| PUT | `/albums/{id}` | Actualizar álbum | Sí |
| DELETE | `/albums/{id}` | Eliminar álbum | Sí |

## 🔧 Configuración

### Variables de Entorno
```env
NODE_ENV=development
PORT=3000
# Usa variables; evita incrustar usuario:contraseña en la URL
DATABASE_URL=postgresql://{{DB_USER}}:{{DB_PASSWORD}}@localhost:5432/spotify_api
JWT_SECRET=tu-secreto-jwt-muy-seguro
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
```

### Base de Datos
La API utiliza PostgreSQL con las siguientes tablas:
- `users` - Información de usuarios
- `artists` - Perfiles de artistas
- `albums` - Álbumes de música
- `songs` - Canciones individuales
- `playlists` - Listas de reproducción

## 📝 Notas para la Clase

### Puntos Clave a Explicar:

1. **Arquitectura Hexagonal**
   - Separación clara de capas
   - Inversión de dependencias
   - Testabilidad mejorada

2. **Seguridad Implementada**
   - JWT para autenticación stateless
   - Rate limiting para prevenir ataques
   - Validación robusta de entrada
   - Hashing seguro de contraseñas

3. **Documentación Swagger**
   - Auto-generada y siempre actualizada
   - Interfaz interactiva para pruebas
   - Esquemas de datos completos

4. **Manejo de Archivos**
   - Validación de tipos MIME
   - Límites de tamaño
   - Almacenamiento seguro

5. **Base de Datos**
   - Relaciones bien definidas
   - Migraciones automáticas
   - Pool de conexiones optimizado

### Demostración Sugerida:
1. Mostrar la documentación Swagger en vivo
2. Registrar un usuario desde Swagger
3. Hacer login y obtener token
4. Crear un álbum usando el token
5. Subir una canción (simular con curl)
6. Mostrar los logs de seguridad
7. Demostrar rate limiting

## 🎵 **Streaming y Reproducción**

### Nuevos Endpoints de Audio:

✅ **Streaming de Audio**:
- `GET /api/songs/{id}/stream` - Stream directo del archivo de audio
- `GET /api/songs/{id}/download` - Descarga del archivo de audio
- `GET /api/songs/{id}/player` - Reproductor web integrado

### Características del Streaming:

✅ **Soporte de Range Requests**: Permite seeking y carga progresiva
✅ **Headers de Cache**: Optimización de rendimiento
✅ **Metadatos en Headers**: Título y artista en headers HTTP
✅ **Reproductor Web**: Interfaz HTML5 con controles nativos
✅ **Contador de Reproducciones**: Se incrementa automáticamente

### Ejemplos de Uso del Streaming:

#### Stream de Audio Directo
```bash
curl http://localhost:3000/api/songs/SONG_ID/stream
```

#### Descarga de Archivo
```bash
curl -O http://localhost:3000/api/songs/SONG_ID/download
```

#### Reproductor Web
Abre en el navegador:
```
http://localhost:3000/api/songs/SONG_ID/player
```

#### Stream con Range Request (para seeking)
```bash
curl -H "Range: bytes=0-1023" http://localhost:3000/api/songs/SONG_ID/stream
```

¡La API está completamente funcional con streaming de audio y lista para demostración en clase! 🎉