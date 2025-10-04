/**
 * Custom Jest Matchers for Security Testing
 * Provides specialized matchers for security-related assertions
 */

import { Response } from 'supertest';

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveSecurityHeaders(): R;
      toBeSecurePassword(): R;
      toBeValidJWT(): R;
      toNotExposeInternalInfo(): R;
      toHaveRateLimitHeaders(): R;
      toBeSecureFileUpload(): R;
      toPreventInjection(): R;
      toHaveCSPHeader(): R;
      toPreventXSS(): R;
      toHaveSecureSessionConfig(): R;
    }
  }
}

// Matcher to check for security headers
expect.extend({
  toHaveSecurityHeaders(received: Response) {
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'strict-transport-security',
      'content-security-policy',
      'referrer-policy'
    ];

    const missingHeaders = requiredHeaders.filter(header => 
      !received.headers[header]
    );

    const pass = missingHeaders.length === 0;

    if (pass) {
      return {
        message: () => `Expected response not to have all security headers`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected response to have security headers. Missing: ${missingHeaders.join(', ')}`,
        pass: false
      };
    }
  }
});

// Matcher to validate password strength
expect.extend({
  toBeSecurePassword(received: string) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(received);
    const hasLowerCase = /[a-z]/.test(received);
    const hasNumbers = /\d/.test(received);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(received);
    const isLongEnough = received.length >= minLength;

    const pass = hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && isLongEnough;

    const failureReasons = [];
    if (!isLongEnough) failureReasons.push(`minimum ${minLength} characters`);
    if (!hasUpperCase) failureReasons.push('uppercase letter');
    if (!hasLowerCase) failureReasons.push('lowercase letter');
    if (!hasNumbers) failureReasons.push('number');
    if (!hasSpecialChar) failureReasons.push('special character');

    if (pass) {
      return {
        message: () => `Expected password not to be secure`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected password to be secure. Missing: ${failureReasons.join(', ')}`,
        pass: false
      };
    }
  }
});

// Matcher to validate JWT format
expect.extend({
  toBeValidJWT(received: string) {
    if (typeof received !== 'string') {
      return {
        message: () => `Expected JWT to be a string, received ${typeof received}`,
        pass: false
      };
    }

    const parts = received.split('.');
    const hasThreeParts = parts.length === 3;
    
    let validBase64 = true;
    if (hasThreeParts) {
      try {
        parts.forEach(part => {
          // Add padding if needed
          const padded = part + '='.repeat((4 - part.length % 4) % 4);
          atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
        });
      } catch (error) {
        validBase64 = false;
      }
    }

    const pass = hasThreeParts && validBase64;

    if (pass) {
      return {
        message: () => `Expected string not to be a valid JWT`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected string to be a valid JWT format (header.payload.signature)`,
        pass: false
      };
    }
  }
});

// Matcher to check that response doesn't expose internal information
expect.extend({
  toNotExposeInternalInfo(received: Response) {
    const body = JSON.stringify(received.body);
    const headers = JSON.stringify(received.headers);
    
    const exposedInfo = [];
    
    // Check for exposed paths
    if (body.includes('/src/') || body.includes('/node_modules/')) {
      exposedInfo.push('internal file paths');
    }
    
    // Check for database information
    if (body.includes('database') || body.includes('sql') || body.includes('query')) {
      exposedInfo.push('database information');
    }
    
    // Check for stack traces
    if (body.includes('at ') && body.includes('.js:')) {
      exposedInfo.push('stack traces');
    }
    
    // Check for server information in headers
    if (headers.includes('Express') || headers.includes('Node.js')) {
      exposedInfo.push('server technology');
    }

    const pass = exposedInfo.length === 0;

    if (pass) {
      return {
        message: () => `Expected response to expose internal information`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected response not to expose internal information. Found: ${exposedInfo.join(', ')}`,
        pass: false
      };
    }
  }
});

// Matcher to check for rate limit headers
expect.extend({
  toHaveRateLimitHeaders(received: Response) {
    const rateLimitHeaders = [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset'
    ];

    const presentHeaders = rateLimitHeaders.filter(header => 
      received.headers[header] !== undefined
    );

    const pass = presentHeaders.length > 0;

    if (pass) {
      return {
        message: () => `Expected response not to have rate limit headers`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected response to have rate limit headers`,
        pass: false
      };
    }
  }
});

// Matcher to validate secure file upload
expect.extend({
  toBeSecureFileUpload(received: any) {
    const issues = [];
    
    if (!received.filename) {
      issues.push('missing filename');
    } else {
      // Check for dangerous file extensions
      const dangerousExtensions = ['.exe', '.bat', '.sh', '.php', '.jsp', '.asp'];
      const hasUnsafeExtension = dangerousExtensions.some(ext => 
        received.filename.toLowerCase().endsWith(ext)
      );
      
      if (hasUnsafeExtension) {
        issues.push('dangerous file extension');
      }
      
      // Check for path traversal in filename
      if (received.filename.includes('../') || received.filename.includes('..\\')) {
        issues.push('path traversal attempt');
      }
    }
    
    // Check file size
    if (received.size && received.size > 50 * 1024 * 1024) { // 50MB
      issues.push('file too large');
    }
    
    // Check MIME type
    if (received.mimetype && !received.mimetype.startsWith('audio/') && !received.mimetype.startsWith('image/')) {
      issues.push('invalid MIME type');
    }

    const pass = issues.length === 0;

    if (pass) {
      return {
        message: () => `Expected file upload not to be secure`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected file upload to be secure. Issues: ${issues.join(', ')}`,
        pass: false
      };
    }
  }
});

// Matcher to check for injection prevention
expect.extend({
  toPreventInjection(received: Response) {
    const body = JSON.stringify(received.body);
    
    // Check that the response doesn't contain SQL keywords that might indicate injection
    const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'UNION', 'OR 1=1'];
    const containsSqlKeywords = sqlKeywords.some(keyword => 
      body.toUpperCase().includes(keyword)
    );
    
    // Check that the response doesn't contain script tags
    const containsScriptTags = body.includes('<script>') || body.includes('javascript:');
    
    // Check for command injection indicators
    const commandIndicators = ['sh -c', 'cmd.exe', '/bin/bash', 'system('];
    const containsCommandIndicators = commandIndicators.some(indicator => 
      body.includes(indicator)
    );

    const pass = !containsSqlKeywords && !containsScriptTags && !containsCommandIndicators;

    if (pass) {
      return {
        message: () => `Expected response to contain injection indicators`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected response to prevent injection attacks`,
        pass: false
      };
    }
  }
});

// Matcher to check for CSP header
expect.extend({
  toHaveCSPHeader(received: Response) {
    const cspHeader = received.headers['content-security-policy'];
    
    if (!cspHeader) {
      return {
        message: () => `Expected response to have Content-Security-Policy header`,
        pass: false
      };
    }
    
    // Check for important CSP directives
    const requiredDirectives = ['default-src', 'script-src', 'style-src'];
    const missingDirectives = requiredDirectives.filter(directive => 
      !cspHeader.includes(directive)
    );
    
    // Check that 'unsafe-inline' and 'unsafe-eval' are not used
    const hasUnsafeDirectives = cspHeader.includes('unsafe-inline') || cspHeader.includes('unsafe-eval');

    const pass = missingDirectives.length === 0 && !hasUnsafeDirectives;

    if (pass) {
      return {
        message: () => `Expected response not to have secure CSP header`,
        pass: true
      };
    } else {
      const issues = [];
      if (missingDirectives.length > 0) {
        issues.push(`missing directives: ${missingDirectives.join(', ')}`);
      }
      if (hasUnsafeDirectives) {
        issues.push('contains unsafe directives');
      }
      
      return {
        message: () => `Expected response to have secure CSP header. Issues: ${issues.join(', ')}`,
        pass: false
      };
    }
  }
});

// Matcher to check XSS prevention
expect.extend({
  toPreventXSS(received: Response) {
    const body = JSON.stringify(received.body);
    
    // Check for unescaped script tags
    const hasScriptTags = /<script[^>]*>/.test(body);
    
    // Check for event handlers
    const eventHandlers = ['onclick', 'onload', 'onerror', 'onmouseover'];
    const hasEventHandlers = eventHandlers.some(handler => 
      body.toLowerCase().includes(handler)
    );
    
    // Check for javascript: URLs
    const hasJavascriptUrls = body.includes('javascript:');
    
    // Check for data: URLs with script content
    const hasDataUrls = body.includes('data:') && body.includes('script');

    const pass = !hasScriptTags && !hasEventHandlers && !hasJavascriptUrls && !hasDataUrls;

    if (pass) {
      return {
        message: () => `Expected response to contain XSS vulnerabilities`,
        pass: true
      };
    } else {
      const issues = [];
      if (hasScriptTags) issues.push('script tags');
      if (hasEventHandlers) issues.push('event handlers');
      if (hasJavascriptUrls) issues.push('javascript URLs');
      if (hasDataUrls) issues.push('data URLs with script');
      
      return {
        message: () => `Expected response to prevent XSS. Found: ${issues.join(', ')}`,
        pass: false
      };
    }
  }
});

// Matcher to check secure session configuration
expect.extend({
  toHaveSecureSessionConfig(received: any) {
    const issues = [];
    
    if (!received.httpOnly) {
      issues.push('httpOnly not set');
    }
    
    if (!received.secure && process.env.NODE_ENV === 'production') {
      issues.push('secure flag not set in production');
    }
    
    if (received.sameSite !== 'strict' && received.sameSite !== 'lax') {
      issues.push('sameSite not properly configured');
    }
    
    if (!received.maxAge || received.maxAge > 24 * 60 * 60 * 1000) { // 24 hours
      issues.push('maxAge too long or not set');
    }

    const pass = issues.length === 0;

    if (pass) {
      return {
        message: () => `Expected session configuration not to be secure`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected session configuration to be secure. Issues: ${issues.join(', ')}`,
        pass: false
      };
    }
  }
});

export {};