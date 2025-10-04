/**
 * Validation Middleware
 * Handles request validation using Joi schemas
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export class ValidationMiddleware {
  // User registration schema
  static registerSchema = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        'any.required': 'Password is required'
      }),
    name: Joi.string()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 50 characters',
        'any.required': 'Name is required'
      })
  });

  // User login schema
  static loginSchema = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required'
      })
  });

  // Token refresh schema
  static refreshSchema = Joi.object({
    refreshToken: Joi.string()
      .required()
      .messages({
        'any.required': 'Refresh token is required'
      })
  });

  // User profile update schema
  static updateProfileSchema = Joi.object({
    name: Joi.string()
      .min(2)
      .max(50)
      .optional()
      .messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 50 characters'
      }),
    currentPassword: Joi.string()
      .when('newPassword', {
        is: Joi.exist(),
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({
        'any.required': 'Current password is required when changing password'
      }),
    newPassword: Joi.string()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
      .optional()
      .messages({
        'string.min': 'New password must be at least 8 characters long',
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, and one number'
      })
  });

  // Song creation schema
  static createSongSchema = Joi.object({
    title: Joi.string()
      .min(1)
      .max(200)
      .required()
      .messages({
        'string.min': 'Song title is required',
        'string.max': 'Song title cannot exceed 200 characters',
        'any.required': 'Song title is required'
      }),
    albumId: Joi.string()
      .uuid()
      .optional()
      .messages({
        'string.guid': 'Album ID must be a valid UUID'
      })
  });

  // Song update schema
  static updateSongSchema = Joi.object({
    title: Joi.string()
      .min(1)
      .max(200)
      .optional()
      .messages({
        'string.min': 'Song title cannot be empty',
        'string.max': 'Song title cannot exceed 200 characters'
      }),
    isPublic: Joi.boolean()
      .optional()
  });

  // Album creation schema
  static createAlbumSchema = Joi.object({
    title: Joi.string()
      .min(1)
      .max(200)
      .required()
      .messages({
        'string.min': 'Album title is required',
        'string.max': 'Album title cannot exceed 200 characters',
        'any.required': 'Album title is required'
      }),
    description: Joi.string()
      .max(1000)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),
    releaseDate: Joi.date()
      .optional()
      .messages({
        'date.base': 'Release date must be a valid date'
      }),
    genre: Joi.string()
      .max(50)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Genre cannot exceed 50 characters'
      })
  });

  // Album update schema
  static updateAlbumSchema = Joi.object({
    title: Joi.string()
      .min(1)
      .max(200)
      .optional()
      .messages({
        'string.min': 'Album title cannot be empty',
        'string.max': 'Album title cannot exceed 200 characters'
      }),
    description: Joi.string()
      .max(1000)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),
    releaseDate: Joi.date()
      .optional()
      .messages({
        'date.base': 'Release date must be a valid date'
      }),
    genre: Joi.string()
      .max(50)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Genre cannot exceed 50 characters'
      }),
    isPublic: Joi.boolean()
      .optional()
  });

  // UUID parameter schema
  static uuidParamSchema = Joi.object({
    id: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.guid': 'ID must be a valid UUID',
        'any.required': 'ID is required'
      })
  });

  // Search schema
  static searchSchema = Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20),
    search: Joi.string()
      .max(100)
      .optional()
      .allow(''),
    artist: Joi.string()
      .max(100)
      .optional()
      .allow(''),
    album: Joi.string()
      .max(100)
      .optional()
      .allow(''),
    genre: Joi.string()
      .max(50)
      .optional()
      .allow(''),
    year: Joi.number()
      .integer()
      .min(1900)
      .max(new Date().getFullYear() + 1)
      .optional(),
    sortBy: Joi.string()
      .valid('created_at', 'title', 'play_count', 'duration', 'release_date')
      .default('created_at'),
    sortOrder: Joi.string()
      .valid('ASC', 'DESC', 'asc', 'desc')
      .default('DESC')
  });

  // Upload song schema
  static uploadSongSchema = Joi.object({
    title: Joi.string()
      .min(1)
      .max(200)
      .required()
      .messages({
        'string.min': 'Song title is required',
        'string.max': 'Song title cannot exceed 200 characters',
        'any.required': 'Song title is required'
      }),
    albumId: Joi.string()
      .uuid()
      .optional()
      .messages({
        'string.guid': 'Album ID must be a valid UUID'
      })
  });

  // Delete profile schema
  static deleteProfileSchema = Joi.object({
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required to delete account'
      }),
    confirmDelete: Joi.string()
      .valid('DELETE_MY_ACCOUNT')
      .required()
      .messages({
        'any.only': 'Must confirm deletion with "DELETE_MY_ACCOUNT"',
        'any.required': 'Deletion confirmation is required'
      })
  });

  // Pagination schema
  static paginationSchema = Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
      }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      }),
    search: Joi.string()
      .max(100)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Search term cannot exceed 100 characters'
      }),
    sortBy: Joi.string()
      .valid('created_at', 'title', 'play_count', 'duration', 'release_date')
      .default('created_at')
      .messages({
        'any.only': 'Sort field must be one of: created_at, title, play_count, duration, release_date'
      }),
    sortOrder: Joi.string()
      .valid('ASC', 'DESC', 'asc', 'desc')
      .default('DESC')
      .messages({
        'any.only': 'Sort order must be ASC or DESC'
      })
  });

  public validate = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        res.status(400).json({
          error: 'Validation failed',
          details: validationErrors
        });
        return;
      }

      // Replace request body with validated and sanitized data
      req.body = value;
      next();
    };
  };

  public validateQuery = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        res.status(400).json({
          error: 'Query validation failed',
          details: validationErrors
        });
        return;
      }

      // Replace request query with validated and sanitized data
      req.query = value;
      next();
    };
  };

  public validateParams = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        res.status(400).json({
          error: 'Parameter validation failed',
          details: validationErrors
        });
        return;
      }

      req.params = value;
      next();
    };
  };
}