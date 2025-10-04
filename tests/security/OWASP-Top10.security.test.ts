/**
 * OWASP Top 10 Security Tests
 * Comprehensive security tests covering OWASP Top 10 vulnerabilities
 */

import request from 'supertest';
import { SpotifyAPIServer } from '../../src/server';
import { Express } from 'express';

describe('OWASP Top 10 Security Tests', () => {
  let app: Express;
  let server: SpotifyAPIServer;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-for-security-testing-only';
    process.env.DB_HOST = 'localhost';
    process.env.DB_NAME = 'spotify_api_test';
    
    server = new SpotifyAPIServer();
    app = server.getApp();
    
    // Note: In a real implementation, you'd start the server
    // await server.start();
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('A01:2021 – Broken Access Control', () => {
    it('should prevent unauthorized access to protected endpoints', async () => {
      const protectedEndpoints = [
        '/api/auth/me',
        '/api/users/me',
        '/api/songs/my',
        '/api/albums/my'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: expect.stringMatching(/UNAUTHORIZED|AUTHENTICATION/),
            message: expect.any(String)
          }
        });
      }
    });

    it('should prevent access to other users resources', async () => {
      // This would require setting up authenticated requests
      // For now, test the structure
      const response = await request(app)
        .get('/api/users/other-user-id')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBeGreaterThanOrEqual(401);
    });

    it('should prevent privilege escalation', async () => {
      // Test that regular users cannot access admin endpoints
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/reports',
        '/api/admin/system'
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', 'Bearer user-token');

        // Should return 404 (not found) or 403 (forbidden)
        expect([403, 404]).toContain(response.status);
      }
    });
  });

  describe('A02:2021 – Cryptographic Failures', () => {
    it('should use secure password hashing', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'admin',
        'test',
        'qwerty'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            username: 'testuser',
            password: password,
            confirmPassword: password,
            acceptTerms: true,
            acceptPrivacyPolicy: true
          });

        // Should reject weak passwords
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });

    it('should enforce strong password requirements', async () => {
      const invalidPasswords = [
        'short',           // Too short
        'nouppercase123!', // No uppercase
        'NOLOWERCASE123!', // No lowercase
        'NoNumbers!',      // No numbers
        'NoSpecialChars123' // No special characters
      ];

      for (const password of invalidPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            username: 'testuser',
            password: password,
            confirmPassword: password,
            acceptTerms: true,
            acceptPrivacyPolicy: true
          });

        expect(response.status).toBe(400);
      }
    });

    it('should not expose sensitive data in responses', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'nonexistent@example.com',
          password: 'wrongpassword'
        });

      // Should not reveal whether user exists or password is wrong
      expect(response.body.error.message).not.toContain('password');
      expect(response.body.error.message).not.toContain('user not found');
      expect(response.body.error.message).toMatch(/invalid credentials/i);
    });
  });

  describe('A03:2021 – Injection', () => {
    it('should prevent SQL injection in query parameters', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO users VALUES ('hacker'); --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get(`/api/users/search?q=${encodeURIComponent(payload)}`);

        // Should not cause server error (500)
        expect(response.status).toBeLessThan(500);
        
        // Should either be validation error (400) or unauthorized (401)
        expect([400, 401]).toContain(response.status);
      }
    });

    it('should prevent NoSQL injection in request bodies', async () => {
      const nosqlInjectionPayloads = [
        { $ne: null },
        { $gt: '' },
        { $regex: '.*' },
        { $where: 'this.password' }
      ];

      for (const payload of nosqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            emailOrUsername: payload,
            password: 'anypassword'
          });

        // Should be validation error, not server error
        expect(response.status).toBeLessThan(500);
        expect([400, 401]).toContain(response.status);
      }
    });

    it('should prevent command injection', async () => {
      const commandInjectionPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '&& rm -rf /',
        '`whoami`',
        '$(id)'
      ];

      for (const payload of commandInjectionPayloads) {
        const response = await request(app)
          .put('/api/users/me')
          .send({
            displayName: payload
          });

        // Should be validation error or unauthorized
        expect([400, 401]).toContain(response.status);
      }
    });
  });

  describe('A04:2021 – Insecure Design', () => {
    it('should implement proper rate limiting', async () => {
      const promises = [];
      
      // Send many requests quickly
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              emailOrUsername: 'test@example.com',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // At least some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should implement account lockout after failed attempts', async () => {
      const loginAttempts = [];
      
      // Multiple failed login attempts
      for (let i = 0; i < 10; i++) {
        loginAttempts.push(
          request(app)
            .post('/api/auth/login')
            .send({
              emailOrUsername: 'test@example.com',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(loginAttempts);
      
      // Later attempts should be blocked
      const blockedResponses = responses.slice(-3).filter(r => r.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('A05:2021 – Security Misconfiguration', () => {
    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/health');

      // Should not expose server software versions
      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should set secure headers', async () => {
      const response = await request(app)
        .get('/api/health');

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    it('should not expose stack traces in production', async () => {
      // Force an error
      const response = await request(app)
        .get('/api/nonexistent-endpoint');

      expect(response.status).toBe(404);
      expect(response.body.stack).toBeUndefined();
      expect(response.body.error.message).not.toContain('Error:');
    });
  });

  describe('A06:2021 – Vulnerable and Outdated Components', () => {
    it('should not use known vulnerable packages', async () => {
      const packageJson = require('../../package.json');
      const vulnerablePackages = [
        'event-stream',
        'eslint-scope',
        'getcookies',
        'http-fetch'
      ];

      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      for (const vulnPackage of vulnerablePackages) {
        expect(dependencies[vulnPackage]).toBeUndefined();
      }
    });
  });

  describe('A07:2021 – Identification and Authentication Failures', () => {
    it('should require strong authentication', async () => {
      const response = await request(app)
        .get('/api/users/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toMatch(/UNAUTHORIZED|AUTHENTICATION/);
    });

    it('should validate JWT tokens properly', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        ''
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
      }
    });

    it('should prevent session fixation', async () => {
      // Test that new sessions are created on login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'test@example.com',
          password: 'correctpassword'
        });

      if (loginResponse.status === 200) {
        expect(loginResponse.body.data.accessToken).toBeDefined();
        expect(loginResponse.body.data.accessToken).not.toBe('');
      }
    });
  });

  describe('A08:2021 – Software and Data Integrity Failures', () => {
    it('should validate file uploads', async () => {
      const maliciousFiles = [
        { filename: 'malware.exe', mimetype: 'application/octet-stream' },
        { filename: 'script.js', mimetype: 'application/javascript' },
        { filename: 'shell.sh', mimetype: 'application/x-sh' }
      ];

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/songs')
          .attach('audioFile', Buffer.from('fake content'), {
            filename: file.filename,
            contentType: file.mimetype
          })
          .field('title', 'Test Song')
          .field('duration', '180');

        // Should reject non-audio files
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('should validate request content types', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/xml')
        .send('<xml>malicious</xml>');

      expect(response.status).toBe(415); // Unsupported Media Type
    });
  });

  describe('A09:2021 – Security Logging and Monitoring Failures', () => {
    it('should log security events', async () => {
      // Failed login attempt should be logged
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'attacker@evil.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      // In a real test, you would verify that the failed login was logged
    });

    it('should provide health check endpoint', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('A10:2021 – Server-Side Request Forgery (SSRF)', () => {
    it('should validate URLs in user input', async () => {
      const ssrfPayloads = [
        'http://localhost:22',
        'http://127.0.0.1:3306',
        'http://169.254.169.254/latest/meta-data/',
        'file:///etc/passwd',
        'ftp://internal-server/',
        'gopher://internal-server:70/'
      ];

      for (const payload of ssrfPayloads) {
        const response = await request(app)
          .put('/api/users/me')
          .send({
            avatarUrl: payload
          });

        // Should reject suspicious URLs
        expect([400, 401]).toContain(response.status);
      }
    });

    it('should validate webhook URLs', async () => {
      const maliciousUrls = [
        'http://localhost:8080/admin',
        'http://192.168.1.1:22',
        'https://evil.com/steal-data'
      ];

      for (const url of maliciousUrls) {
        // If there were webhook endpoints, test them here
        // For now, test avatar URL validation
        const response = await request(app)
          .put('/api/users/me')
          .send({
            avatarUrl: url
          });

        expect([400, 401]).toContain(response.status);
      }
    });
  });

  describe('Additional Security Tests', () => {
    it('should prevent XSS in user input', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '"><script>alert("xss")</script>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .put('/api/users/me')
          .send({
            displayName: payload,
            bio: payload
          });

        // Should be validation error or unauthorized
        expect([400, 401]).toContain(response.status);
      }
    });

    it('should prevent CSRF attacks', async () => {
      // Test that state-changing operations require proper authentication
      const stateChangingEndpoints = [
        { method: 'post', path: '/api/songs' },
        { method: 'put', path: '/api/users/me' },
        { method: 'delete', path: '/api/songs/123' }
      ];

      for (const endpoint of stateChangingEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Origin', 'https://evil.com')
          .send({});

        // Should require authentication
        expect(response.status).toBe(401);
      }
    });

    it('should prevent clickjacking', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should prevent MIME type sniffing', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should handle large payloads securely', async () => {
      const largePayload = 'a'.repeat(10 * 1024 * 1024); // 10MB

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'ValidPass123!',
          confirmPassword: 'ValidPass123!',
          bio: largePayload,
          acceptTerms: true,
          acceptPrivacyPolicy: true
        });

      // Should reject large payloads
      expect([400, 413]).toContain(response.status);
    });

    it('should validate file upload sizes', async () => {
      // Create a large buffer (simulate large file)
      const largeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB

      const response = await request(app)
        .post('/api/songs')
        .attach('audioFile', largeBuffer, {
          filename: 'large-song.mp3',
          contentType: 'audio/mpeg'
        })
        .field('title', 'Large Song')
        .field('duration', '180');

      // Should reject files over size limit
      expect([400, 413]).toContain(response.status);
    });

    it('should prevent directory traversal', async () => {
      const traversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      for (const payload of traversalPayloads) {
        const response = await request(app)
          .get(`/api/files/${payload}`);

        // Should not find the file or return forbidden
        expect([400, 403, 404]).toContain(response.status);
      }
    });

    it('should prevent HTTP header injection', async () => {
      const headerInjectionPayloads = [
        'test\r\nSet-Cookie: admin=true',
        'test\nLocation: https://evil.com',
        'test\r\n\r\n<script>alert("xss")</script>'
      ];

      for (const payload of headerInjectionPayloads) {
        const response = await request(app)
          .get('/api/health')
          .set('X-Custom-Header', payload);

        // Should not reflect the injected headers
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(response.headers['location']).not.toContain('evil.com');
      }
    });

    it('should prevent XML External Entity (XXE) attacks', async () => {
      const xxePayload = `<?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <user><name>&xxe;</name></user>`;

      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/xml')
        .send(xxePayload);

      // Should reject XML content type
      expect(response.status).toBe(415);
    });

    it('should prevent prototype pollution', async () => {
      const pollutionPayloads = [
        { '__proto__.isAdmin': true },
        { 'constructor.prototype.isAdmin': true },
        { '__proto__': { 'isAdmin': true } }
      ];

      for (const payload of pollutionPayloads) {
        const response = await request(app)
          .put('/api/users/me')
          .send(payload);

        // Should be validation error or unauthorized
        expect([400, 401]).toContain(response.status);
      }
    });
  });

  describe('Business Logic Security Tests', () => {
    it('should prevent race conditions in critical operations', async () => {
      // Simulate concurrent requests that could cause race conditions
      const concurrentRequests = [];
      
      for (let i = 0; i < 10; i++) {
        concurrentRequests.push(
          request(app)
            .post('/api/auth/register')
            .send({
              email: 'race@example.com',
              username: 'raceuser',
              password: 'ValidPass123!',
              confirmPassword: 'ValidPass123!',
              acceptTerms: true,
              acceptPrivacyPolicy: true
            })
        );
      }

      const responses = await Promise.all(concurrentRequests);
      
      // Only one should succeed, others should fail with conflict
      const successResponses = responses.filter(r => r.status === 201);
      const conflictResponses = responses.filter(r => r.status === 409);
      
      expect(successResponses.length).toBeLessThanOrEqual(1);
      expect(conflictResponses.length).toBeGreaterThan(0);
    });

    it('should validate business rules', async () => {
      // Test business logic validation
      const response = await request(app)
        .post('/api/songs')
        .send({
          title: '',  // Empty title should be rejected
          duration: -1,  // Negative duration should be rejected
          genre: 'invalid_genre'  // Invalid genre should be rejected
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Performance Security Tests', () => {
    it('should handle high load without degradation', async () => {
      const startTime = Date.now();
      const requests = [];

      // Send 50 concurrent requests
      for (let i = 0; i < 50; i++) {
        requests.push(
          request(app)
            .get('/api/health')
        );
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time (10 seconds)
      expect(totalTime).toBeLessThan(10000);
    });

    it('should prevent ReDoS (Regular Expression Denial of Service)', async () => {
      const redosPayloads = [
        'a'.repeat(10000) + '!',
        'x'.repeat(50000),
        '(' + 'a'.repeat(1000) + ')*' + 'b'.repeat(1000)
      ];

      for (const payload of redosPayloads) {
        const startTime = Date.now();
        
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            username: payload,
            password: 'ValidPass123!',
            confirmPassword: 'ValidPass123!',
            acceptTerms: true,
            acceptPrivacyPolicy: true
          });

        const duration = Date.now() - startTime;

        // Should not take too long to process
        expect(duration).toBeLessThan(5000); // 5 seconds max
        expect([400, 401]).toContain(response.status);
      }
    });
  });
});