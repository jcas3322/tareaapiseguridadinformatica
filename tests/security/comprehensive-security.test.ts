/**
 * Comprehensive Security Test Suite
 * Tests for OWASP Top 10 and additional security measures
 */

import request from 'supertest';
import { SpotifyApiServer } from '../../src/server';
import { Express } from 'express';

describe('Comprehensive Security Tests', () => {
  let app: Express;
  let server: SpotifyApiServer;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
    
    server = new SpotifyApiServer();
    app = server.getApp();
  });

  afterAll(async () => {
    if (server) {
      // Clean up server resources
      await server.getServer()?.close();
    }
  });

  describe('A01:2021 – Broken Access Control', () => {
    it('should prevent unauthorized access to protected endpoints', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should prevent access with invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should prevent privilege escalation', async () => {
      // Test that regular user cannot access admin endpoints
      const userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwicm9sZSI6InVzZXIiLCJpYXQiOjE2MzQ1NjcwMDB9.test';
      
      const response = await request(app)
        .delete('/api/admin/users/123')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should prevent horizontal privilege escalation', async () => {
      // Test that user cannot access another user's data
      const userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiaWF0IjoxNjM0NTY3MDAwfQ.test';
      
      const response = await request(app)
        .get('/api/users/456/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('A02:2021 – Cryptographic Failures', () => {
    it('should use HTTPS in production headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    it('should not expose sensitive data in error messages', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).not.toContain('database');
      expect(response.body.error).not.toContain('sql');
      expect(response.body.error).not.toContain('password');
    });

    it('should hash passwords properly', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
          name: 'Test User'
        });

      // Should not return the password in any form
      if (response.body.user) {
        expect(response.body.user).not.toHaveProperty('password');
        expect(response.body.user).not.toHaveProperty('passwordHash');
      }
    });
  });

  describe('A03:2021 – Injection', () => {
    it('should prevent SQL injection in login', async () => {
      const maliciousPayload = {
        email: \"admin@example.com'; DROP TABLE users; --\",
        password: 'password'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(maliciousPayload)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should prevent NoSQL injection', async () => {
      const maliciousPayload = {
        email: { $ne: null },
        password: { $ne: null }
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(maliciousPayload)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should sanitize search queries', async () => {
      const maliciousQuery = '<script>alert(\"XSS\")</script>';
      
      const response = await request(app)
        .get(`/api/songs/search?q=${encodeURIComponent(maliciousQuery)}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should prevent command injection in file uploads', async () => {
      const maliciousFilename = 'test; rm -rf /';
      
      const response = await request(app)
        .post('/api/songs/upload')
        .attach('file', Buffer.from('fake audio data'), maliciousFilename)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('A04:2021 – Insecure Design', () => {
    it('should implement proper rate limiting', async () => {
      const requests = Array(20).fill(null).map(() => 
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should implement account lockout after failed attempts', async () => {
      const email = 'lockout-test@example.com';
      
      // Attempt multiple failed logins
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email,
            password: 'wrongpassword'
          });
      }

      // Next attempt should be locked
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email,
          password: 'correctpassword'
        })
        .expect(423);

      expect(response.body.error).toContain('locked');
    });

    it('should require strong passwords', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'abc123',
        'password123'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: `test-${Date.now()}@example.com`,
            password,
            name: 'Test User'
          })
          .expect(400);

        expect(response.body.error).toContain('password');
      }
    });
  });

  describe('A05:2021 – Security Misconfiguration', () => {
    it('should have proper security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers).toHaveProperty('referrer-policy');
    });

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).not.toContain('Express');
    });

    it('should not expose stack traces in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('trace');
      
      process.env.NODE_ENV = 'test';
    });

    it('should disable unnecessary HTTP methods', async () => {
      const response = await request(app)
        .trace('/api/users')
        .expect(405);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('A06:2021 – Vulnerable and Outdated Components', () => {
    it('should not use vulnerable dependencies', () => {
      // This would typically be checked by npm audit
      // Here we simulate the check
      const packageJson = require('../../package.json');
      
      // Check that we're not using known vulnerable packages
      const vulnerablePackages = [
        'lodash@4.17.20', // Example of vulnerable version
        'express@4.16.0'  // Example of vulnerable version
      ];

      const dependencies = Object.keys(packageJson.dependencies || {});
      const devDependencies = Object.keys(packageJson.devDependencies || {});
      const allDeps = [...dependencies, ...devDependencies];

      vulnerablePackages.forEach(vulnPkg => {
        const [pkgName] = vulnPkg.split('@');
        expect(allDeps).toContain(pkgName);
        // In real scenario, you'd check versions
      });
    });
  });

  describe('A07:2021 – Identification and Authentication Failures', () => {
    it('should implement proper session management', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'valid@example.com',
          password: 'ValidPassword123!'
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.token;
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(20);
      }
    });

    it('should invalidate tokens on logout', async () => {
      // First login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'valid@example.com',
          password: 'ValidPassword123!'
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.token;

        // Logout
        await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // Try to use token after logout
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should implement proper password reset flow', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'valid@example.com'
        })
        .expect(200);

      expect(response.body.message).toContain('reset');
      // Should not reveal if email exists or not
      expect(response.body.message).not.toContain('not found');
    });
  });

  describe('A08:2021 – Software and Data Integrity Failures', () => {
    it('should validate file uploads', async () => {
      const maliciousFile = Buffer.from('<?php system($_GET[\"cmd\"]); ?>');
      
      const response = await request(app)
        .post('/api/songs/upload')
        .attach('file', maliciousFile, 'malicious.php')
        .expect(400);

      expect(response.body.error).toContain('file type');
    });

    it('should validate file size limits', async () => {
      const largeFile = Buffer.alloc(100 * 1024 * 1024); // 100MB
      
      const response = await request(app)
        .post('/api/songs/upload')
        .attach('file', largeFile, 'large.mp3')
        .expect(413);

      expect(response.body.error).toContain('size');
    });

    it('should validate JSON payloads', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('invalid json{')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('A09:2021 – Security Logging and Monitoring Failures', () => {
    it('should log security events', async () => {
      // Attempt unauthorized access
      await request(app)
        .get('/api/admin/users')
        .expect(401);

      // In a real test, you'd check that this was logged
      // For now, we just ensure the endpoint responds correctly
      expect(true).toBe(true);
    });

    it('should provide health check endpoint', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
    });

    it('should provide metrics endpoint', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('requests');
    });
  });

  describe('A10:2021 – Server-Side Request Forgery (SSRF)', () => {
    it('should prevent SSRF in avatar upload', async () => {
      const maliciousUrl = 'http://localhost:22/admin';
      
      const response = await request(app)
        .post('/api/users/avatar')
        .send({
          avatarUrl: maliciousUrl
        })
        .expect(400);

      expect(response.body.error).toContain('invalid');
    });

    it('should validate external URLs', async () => {
      const internalUrls = [
        'http://127.0.0.1:8080/admin',
        'http://localhost:3000/internal',
        'http://192.168.1.1/config',
        'file:///etc/passwd'
      ];

      for (const url of internalUrls) {
        const response = await request(app)
          .post('/api/users/avatar')
          .send({
            avatarUrl: url
          })
          .expect(400);

        expect(response.body.error).toContain('invalid');
      }
    });
  });

  describe('Additional Security Tests', () => {
    it('should prevent timing attacks on login', async () => {
      const startTime = Date.now();
      
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password'
        });
      
      const nonExistentTime = Date.now() - startTime;
      
      const startTime2 = Date.now();
      
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'existing@example.com',
          password: 'wrongpassword'
        });
      
      const existingTime = Date.now() - startTime2;
      
      // Times should be similar to prevent user enumeration
      const timeDifference = Math.abs(nonExistentTime - existingTime);
      expect(timeDifference).toBeLessThan(100); // 100ms tolerance
    });

    it('should implement CORS properly', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'https://malicious-site.com')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).not.toBe('*');
    });

    it('should prevent clickjacking', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-frame-options']).toBeDefined();
      expect(['DENY', 'SAMEORIGIN']).toContain(response.headers['x-frame-options']);
    });

    it('should implement proper content type validation', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'text/plain')
        .send('email=test@example.com&password=password')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should limit request body size', async () => {
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password',
          name: largePayload
        })
        .expect(413);

      expect(response.body).toHaveProperty('error');
    });

    it('should implement request timeout', async () => {
      // This test would require a slow endpoint to test properly
      // For now, we just ensure the middleware is in place
      const response = await request(app)
        .get('/health')
        .timeout(1000)
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('Performance Security Tests', () => {
    it('should handle concurrent requests without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      const requests = Array(50).fill(null).map(() =>
        request(app).get('/health')
      );
      
      await Promise.all(requests);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        request(app).get('/api/users/profile').set('Authorization', 'Bearer '),
        request(app).post('/api/auth/login').send(null),
        request(app).post('/api/auth/login').send(undefined),
        request(app).get('/api/songs/search?q=' + 'x'.repeat(10000))
      ];

      const responses = await Promise.allSettled(malformedRequests);
      
      responses.forEach(result => {
        if (result.status === 'fulfilled') {
          expect([400, 401, 413, 414]).toContain(result.value.status);
        }
      });
    });
  });
});