/**
 * Swagger Documentation Generator
 * Simplified version for basic API documentation
 */

import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { Logger } from '../logging/WinstonLogger';

export class SwaggerGenerator {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public setupSwagger(app: Application): void {
    try {
      const swaggerDocument = {
        openapi: '3.0.0',
        info: {
          title: 'Spotify API Security',
          version: '1.0.0',
          description: 'Secure music streaming API built with security-first principles',
          contact: {
            name: 'API Support',
            email: 'support@spotify-api.com'
          }
        },
        servers: [
          {
            url: process.env.API_BASE_URL || 'http://localhost:3000/api',
            description: 'Development server'
          }
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            }
          },
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string', format: 'email' },
                name: { type: 'string' },
                role: { type: 'string', enum: ['user', 'admin'] },
                isActive: { type: 'boolean' },
                emailVerified: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
                lastLogin: { type: 'string', format: 'date-time' }
              }
            },
            Song: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                title: { type: 'string' },
                duration: { type: 'integer' },
                playCount: { type: 'integer' },
                createdAt: { type: 'string', format: 'date-time' },
                artist: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' }
                  }
                },
                album: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    title: { type: 'string' }
                  }
                }
              }
            },
            Album: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                title: { type: 'string' },
                description: { type: 'string' },
                coverImage: { type: 'string' },
                releaseDate: { type: 'string', format: 'date' },
                genre: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                songCount: { type: 'integer' },
                artist: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' }
                  }
                }
              }
            },
            Error: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'object' } }
              }
            },
            AuthResponse: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                user: { $ref: '#/components/schemas/User' },
                token: { type: 'string' },
                refreshToken: { type: 'string' }
              }
            },
            Pagination: {
              type: 'object',
              properties: {
                currentPage: { type: 'integer' },
                totalPages: { type: 'integer' },
                totalItems: { type: 'integer' },
                itemsPerPage: { type: 'integer' },
                hasNextPage: { type: 'boolean' },
                hasPreviousPage: { type: 'boolean' }
              }
            }
          }
        },
        paths: {
          '/health': {
            get: {
              tags: ['System'],
              summary: 'Health check endpoint',
              description: 'Check if the API is running and healthy',
              responses: {
                '200': {
                  description: 'Service is healthy',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string' },
                          timestamp: { type: 'string', format: 'date-time' },
                          version: { type: 'string' },
                          database: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/': {
            get: {
              tags: ['System'],
              summary: 'API information',
              description: 'Get general API information and available endpoints',
              responses: {
                '200': {
                  description: 'API information',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          version: { type: 'string' },
                          endpoints: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/auth/register': {
            post: {
              tags: ['Authentication'],
              summary: 'Register a new user',
              description: 'Create a new user account with email, password, and name',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['email', 'password', 'name'],
                      properties: {
                        email: { type: 'string', format: 'email', example: 'user@example.com' },
                        password: { type: 'string', minLength: 8, example: 'Password123', description: 'Must contain at least one uppercase letter, one lowercase letter, and one number' },
                        name: { type: 'string', minLength: 2, example: 'John Doe' }
                      }
                    }
                  }
                }
              },
              responses: {
                '201': {
                  description: 'User registered successfully',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/AuthResponse' }
                    }
                  }
                },
                '400': {
                  description: 'Validation error',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '409': {
                  description: 'User already exists',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            }
          },
          '/auth/login': {
            post: {
              tags: ['Authentication'],
              summary: 'Login user',
              description: 'Authenticate user with email and password',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['email', 'password'],
                      properties: {
                        email: { type: 'string', format: 'email', example: 'user@example.com' },
                        password: { type: 'string', example: 'Password123' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Login successful',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/AuthResponse' }
                    }
                  }
                },
                '401': {
                  description: 'Invalid credentials',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '423': {
                  description: 'Account locked',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            }
          },
          '/auth/logout': {
            post: {
              tags: ['Authentication'],
              summary: 'Logout user',
              description: 'Logout the authenticated user',
              security: [{ bearerAuth: [] }],
              responses: {
                '200': {
                  description: 'Logout successful',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          message: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                '401': {
                  description: 'Unauthorized',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            }
          },
          '/auth/refresh': {
            post: {
              tags: ['Authentication'],
              summary: 'Refresh access token',
              description: 'Get a new access token using refresh token',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['refreshToken'],
                      properties: {
                        refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Token refreshed successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          message: { type: 'string' },
                          token: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                '401': {
                  description: 'Invalid refresh token',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            }
          },
          '/users/profile': {
            get: {
              tags: ['Users'],
              summary: 'Get user profile',
              description: 'Get the authenticated user profile information',
              security: [{ bearerAuth: [] }],
              responses: {
                '200': {
                  description: 'User profile retrieved successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          user: { $ref: '#/components/schemas/User' },
                          statistics: {
                            type: 'object',
                            properties: {
                              songs: { type: 'integer' },
                              albums: { type: 'integer' },
                              playlists: { type: 'integer' }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                '401': {
                  description: 'Unauthorized',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '404': {
                  description: 'User not found',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            },
            put: {
              tags: ['Users'],
              summary: 'Update user profile',
              description: 'Update the authenticated user profile information',
              security: [{ bearerAuth: [] }],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name'],
                      properties: {
                        name: { type: 'string', minLength: 2, example: 'John Doe Updated' },
                        currentPassword: { type: 'string', example: 'CurrentPassword123' },
                        newPassword: { type: 'string', minLength: 8, example: 'NewPassword123' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Profile updated successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          message: { type: 'string' },
                          user: { $ref: '#/components/schemas/User' }
                        }
                      }
                    }
                  }
                },
                '400': {
                  description: 'Validation error',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '401': {
                  description: 'Unauthorized or incorrect password',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            },
            delete: {
              tags: ['Users'],
              summary: 'Delete user account',
              description: 'Permanently delete the authenticated user account',
              security: [{ bearerAuth: [] }],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['password', 'confirmDelete'],
                      properties: {
                        password: { type: 'string', example: 'Password123' },
                        confirmDelete: { type: 'string', enum: ['DELETE_MY_ACCOUNT'], example: 'DELETE_MY_ACCOUNT' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Account deleted successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          message: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                '400': {
                  description: 'Validation error or missing confirmation',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '401': {
                  description: 'Unauthorized or incorrect password',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            }
          },
          '/songs': {
            get: {
              tags: ['Songs'],
              summary: 'List songs',
              description: 'Get a paginated list of public songs with optional filtering',
              parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: 'Items per page' },
                { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search in song titles and artist names' },
                { name: 'artist', in: 'query', schema: { type: 'string' }, description: 'Filter by artist name' },
                { name: 'album', in: 'query', schema: { type: 'string' }, description: 'Filter by album title' },
                { name: 'genre', in: 'query', schema: { type: 'string' }, description: 'Filter by genre' },
                { name: 'year', in: 'query', schema: { type: 'integer' }, description: 'Filter by release year' },
                { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['created_at', 'title', 'play_count', 'duration'], default: 'created_at' }, description: 'Sort field' },
                { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'], default: 'DESC' }, description: 'Sort order' }
              ],
              responses: {
                '200': {
                  description: 'Songs retrieved successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          songs: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Song' }
                          },
                          pagination: { $ref: '#/components/schemas/Pagination' }
                        }
                      }
                    }
                  }
                }
              }
            },
            post: {
              tags: ['Songs'],
              summary: 'Upload song',
              description: 'Upload a new song file (requires authentication)',
              security: [{ bearerAuth: [] }],
              requestBody: {
                required: true,
                content: {
                  'multipart/form-data': {
                    schema: {
                      type: 'object',
                      required: ['title', 'audioFile'],
                      properties: {
                        title: { type: 'string', example: 'My New Song' },
                        albumId: { type: 'string', format: 'uuid', description: 'Optional album ID' },
                        audioFile: { type: 'string', format: 'binary', description: 'Audio file (MP3, WAV, FLAC, M4A)' }
                      }
                    }
                  }
                }
              },
              responses: {
                '201': {
                  description: 'Song uploaded successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          message: { type: 'string' },
                          song: {
                            type: 'object',
                            properties: {
                              id: { type: 'string', format: 'uuid' },
                              title: { type: 'string' },
                              fileSize: { type: 'integer' },
                              mimeType: { type: 'string' },
                              createdAt: { type: 'string', format: 'date-time' }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                '400': {
                  description: 'Validation error or invalid file type',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '401': {
                  description: 'Unauthorized',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            }
          },
          '/my/songs': {
            get: {
              tags: ['Songs'],
              summary: 'List my songs',
              description: 'Get a paginated list of the authenticated user\'s songs (both public and private)',
              security: [{ bearerAuth: [] }],
              parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: 'Items per page' },
                { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search in song titles' },
                { name: 'album', in: 'query', schema: { type: 'string' }, description: 'Filter by album title' },
                { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['created_at', 'title', 'play_count', 'duration'], default: 'created_at' }, description: 'Sort field' },
                { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'], default: 'DESC' }, description: 'Sort order' }
              ],
              responses: {
                '200': {
                  description: 'User songs retrieved successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          songs: {
                            type: 'array',
                            items: {
                              allOf: [
                                { $ref: '#/components/schemas/Song' },
                                {
                                  type: 'object',
                                  properties: {
                                    isPublic: { type: 'boolean' }
                                  }
                                }
                              ]
                            }
                          },
                          pagination: { $ref: '#/components/schemas/Pagination' }
                        }
                      }
                    }
                  }
                },
                '401': {
                  description: 'Unauthorized',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            }
          },
          '/songs/{id}/stream': {
            get: {
              tags: ['Songs'],
              summary: 'Stream song audio',
              description: 'Stream the audio file of a specific song. Supports range requests for progressive download and seeking.',
              parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Song ID' },
                { name: 'Range', in: 'header', required: false, schema: { type: 'string' }, description: 'Range header for partial content requests (e.g., "bytes=0-1023")' }
              ],
              responses: {
                '200': {
                  description: 'Audio stream (full file)',
                  content: {
                    'audio/mpeg': {
                      schema: {
                        type: 'string',
                        format: 'binary'
                      }
                    },
                    'audio/wav': {
                      schema: {
                        type: 'string',
                        format: 'binary'
                      }
                    },
                    'audio/flac': {
                      schema: {
                        type: 'string',
                        format: 'binary'
                      }
                    },
                    'audio/mp4': {
                      schema: {
                        type: 'string',
                        format: 'binary'
                      }
                    }
                  },
                  headers: {
                    'Content-Length': {
                      schema: { type: 'integer' },
                      description: 'Size of the audio file in bytes'
                    },
                    'Content-Type': {
                      schema: { type: 'string' },
                      description: 'MIME type of the audio file'
                    },
                    'Accept-Ranges': {
                      schema: { type: 'string' },
                      description: 'Indicates that range requests are supported'
                    },
                    'Cache-Control': {
                      schema: { type: 'string' },
                      description: 'Caching directives'
                    },
                    'X-Song-Title': {
                      schema: { type: 'string' },
                      description: 'Title of the song'
                    },
                    'X-Artist-Name': {
                      schema: { type: 'string' },
                      description: 'Name of the artist'
                    }
                  }
                },
                '206': {
                  description: 'Partial audio content (range request)',
                  content: {
                    'audio/mpeg': {
                      schema: {
                        type: 'string',
                        format: 'binary'
                      }
                    }
                  },
                  headers: {
                    'Content-Range': {
                      schema: { type: 'string' },
                      description: 'Range of bytes being served'
                    },
                    'Content-Length': {
                      schema: { type: 'integer' },
                      description: 'Size of the partial content in bytes'
                    },
                    'Accept-Ranges': {
                      schema: { type: 'string' },
                      description: 'Indicates that range requests are supported'
                    }
                  }
                },
                '404': {
                  description: 'Song not found or file missing',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '416': {
                  description: 'Range not satisfiable',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            }
          },
          '/songs/{id}/download': {
            get: {
              tags: ['Songs'],
              summary: 'Download song audio',
              description: 'Download the audio file of a specific song as an attachment.',
              parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Song ID' }
              ],
              responses: {
                '200': {
                  description: 'Audio file download',
                  content: {
                    'audio/mpeg': {
                      schema: {
                        type: 'string',
                        format: 'binary'
                      }
                    },
                    'audio/wav': {
                      schema: {
                        type: 'string',
                        format: 'binary'
                      }
                    },
                    'audio/flac': {
                      schema: {
                        type: 'string',
                        format: 'binary'
                      }
                    },
                    'audio/mp4': {
                      schema: {
                        type: 'string',
                        format: 'binary'
                      }
                    }
                  },
                  headers: {
                    'Content-Disposition': {
                      schema: { type: 'string' },
                      description: 'Attachment header with filename'
                    },
                    'Content-Length': {
                      schema: { type: 'integer' },
                      description: 'Size of the audio file in bytes'
                    },
                    'Content-Type': {
                      schema: { type: 'string' },
                      description: 'MIME type of the audio file'
                    }
                  }
                },
                '404': {
                  description: 'Song not found or file missing',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            }
          },
          '/songs/{id}': {
            get: {
              tags: ['Songs'],
              summary: 'Get song details',
              description: 'Get detailed information about a specific song',
              parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Song ID' }
              ],
              responses: {
                '200': {
                  description: 'Song details retrieved successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          song: {
                            allOf: [
                              { $ref: '#/components/schemas/Song' },
                              {
                                type: 'object',
                                properties: {
                                  fileSize: { type: 'integer' },
                                  mimeType: { type: 'string' },
                                  isPublic: { type: 'boolean' },
                                  updatedAt: { type: 'string', format: 'date-time' }
                                }
                              }
                            ]
                          }
                        }
                      }
                    }
                  }
                },
                '404': {
                  description: 'Song not found',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            },
            put: {
              tags: ['Songs'],
              summary: 'Update song',
              description: 'Update song information (owner only)',
              security: [{ bearerAuth: [] }],
              parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Song ID' }
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', example: 'Updated Song Title' },
                        isPublic: { type: 'boolean', example: true }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Song updated successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          message: { type: 'string' },
                          song: {
                            type: 'object',
                            properties: {
                              id: { type: 'string', format: 'uuid' },
                              title: { type: 'string' },
                              isPublic: { type: 'boolean' },
                              updatedAt: { type: 'string', format: 'date-time' }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                '401': {
                  description: 'Unauthorized',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '403': {
                  description: 'Forbidden - not the owner',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '404': {
                  description: 'Song not found',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            },
            delete: {
              tags: ['Songs'],
              summary: 'Delete song',
              description: 'Delete a song (owner only)',
              security: [{ bearerAuth: [] }],
              parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Song ID' }
              ],
              responses: {
                '200': {
                  description: 'Song deleted successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          message: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                '401': {
                  description: 'Unauthorized',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '403': {
                  description: 'Forbidden - not the owner',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '404': {
                  description: 'Song not found',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            }
          },
          '/albums': {
            get: {
              tags: ['Albums'],
              summary: 'List albums',
              description: 'Get a paginated list of public albums with optional filtering',
              parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: 'Items per page' },
                { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search in album titles and descriptions' },
                { name: 'artist', in: 'query', schema: { type: 'string' }, description: 'Filter by artist name' },
                { name: 'genre', in: 'query', schema: { type: 'string' }, description: 'Filter by genre' },
                { name: 'year', in: 'query', schema: { type: 'integer' }, description: 'Filter by release year' },
                { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['created_at', 'title', 'release_date'], default: 'created_at' }, description: 'Sort field' },
                { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'], default: 'DESC' }, description: 'Sort order' }
              ],
              responses: {
                '200': {
                  description: 'Albums retrieved successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          albums: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Album' }
                          },
                          pagination: { $ref: '#/components/schemas/Pagination' }
                        }
                      }
                    }
                  }
                }
              }
            },
            post: {
              tags: ['Albums'],
              summary: 'Create album',
              description: 'Create a new album (requires authentication)',
              security: [{ bearerAuth: [] }],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['title'],
                      properties: {
                        title: { type: 'string', example: 'My New Album' },
                        description: { type: 'string', example: 'This is my new album description' },
                        releaseDate: { type: 'string', format: 'date', example: '2024-01-01' },
                        genre: { type: 'string', example: 'Rock' }
                      }
                    }
                  }
                }
              },
              responses: {
                '201': {
                  description: 'Album created successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          message: { type: 'string' },
                          album: {
                            type: 'object',
                            properties: {
                              id: { type: 'string', format: 'uuid' },
                              title: { type: 'string' },
                              description: { type: 'string' },
                              releaseDate: { type: 'string', format: 'date' },
                              genre: { type: 'string' },
                              createdAt: { type: 'string', format: 'date-time' }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                '400': {
                  description: 'Validation error',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '401': {
                  description: 'Unauthorized',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '409': {
                  description: 'Album with this title already exists',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            }
          },
          '/my/albums': {
            get: {
              tags: ['Albums'],
              summary: 'List my albums',
              description: 'Get a paginated list of the authenticated user\'s albums (both public and private)',
              security: [{ bearerAuth: [] }],
              parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: 'Items per page' },
                { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search in album titles and descriptions' },
                { name: 'genre', in: 'query', schema: { type: 'string' }, description: 'Filter by genre' },
                { name: 'year', in: 'query', schema: { type: 'integer' }, description: 'Filter by release year' },
                { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['created_at', 'title', 'release_date'], default: 'created_at' }, description: 'Sort field' },
                { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'], default: 'DESC' }, description: 'Sort order' }
              ],
              responses: {
                '200': {
                  description: 'User albums retrieved successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          albums: {
                            type: 'array',
                            items: {
                              allOf: [
                                { $ref: '#/components/schemas/Album' },
                                {
                                  type: 'object',
                                  properties: {
                                    isPublic: { type: 'boolean' }
                                  }
                                }
                              ]
                            }
                          },
                          pagination: { $ref: '#/components/schemas/Pagination' }
                        }
                      }
                    }
                  }
                },
                '401': {
                  description: 'Unauthorized',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            }
          },
          '/albums/{id}': {
            get: {
              tags: ['Albums'],
              summary: 'Get album details',
              description: 'Get detailed information about a specific album including its songs',
              parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Album ID' }
              ],
              responses: {
                '200': {
                  description: 'Album details retrieved successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          album: {
                            allOf: [
                              { $ref: '#/components/schemas/Album' },
                              {
                                type: 'object',
                                properties: {
                                  isPublic: { type: 'boolean' },
                                  updatedAt: { type: 'string', format: 'date-time' },
                                  songs: {
                                    type: 'array',
                                    items: {
                                      type: 'object',
                                      properties: {
                                        id: { type: 'string', format: 'uuid' },
                                        title: { type: 'string' },
                                        duration: { type: 'integer' },
                                        playCount: { type: 'integer' },
                                        createdAt: { type: 'string', format: 'date-time' }
                                      }
                                    }
                                  }
                                }
                              }
                            ]
                          }
                        }
                      }
                    }
                  }
                },
                '404': {
                  description: 'Album not found',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            },
            put: {
              tags: ['Albums'],
              summary: 'Update album',
              description: 'Update album information (owner only)',
              security: [{ bearerAuth: [] }],
              parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Album ID' }
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', example: 'Updated Album Title' },
                        description: { type: 'string', example: 'Updated description' },
                        releaseDate: { type: 'string', format: 'date', example: '2024-02-01' },
                        genre: { type: 'string', example: 'Pop' },
                        isPublic: { type: 'boolean', example: true }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Album updated successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          message: { type: 'string' },
                          album: {
                            type: 'object',
                            properties: {
                              id: { type: 'string', format: 'uuid' },
                              title: { type: 'string' },
                              description: { type: 'string' },
                              releaseDate: { type: 'string', format: 'date' },
                              genre: { type: 'string' },
                              isPublic: { type: 'boolean' },
                              updatedAt: { type: 'string', format: 'date-time' }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                '400': {
                  description: 'Validation error',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '401': {
                  description: 'Unauthorized',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '403': {
                  description: 'Forbidden - not the owner',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '404': {
                  description: 'Album not found',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            },
            delete: {
              tags: ['Albums'],
              summary: 'Delete album',
              description: 'Delete an album (owner only, must be empty)',
              security: [{ bearerAuth: [] }],
              parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Album ID' }
              ],
              responses: {
                '200': {
                  description: 'Album deleted successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          message: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                '400': {
                  description: 'Album contains songs and cannot be deleted',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '401': {
                  description: 'Unauthorized',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '403': {
                  description: 'Forbidden - not the owner',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                },
                '404': {
                  description: 'Album not found',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' }
                    }
                  }
                }
              }
            }
          }
        }
      };

      app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
      this.logger.info('Swagger documentation setup completed');
    } catch (error) {
      this.logger.error('Failed to setup Swagger documentation', error);
    }
  }
}