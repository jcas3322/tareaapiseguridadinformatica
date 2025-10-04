/**
 * SSLConfig
 * SSL/TLS configuration for secure database connections
 */

import fs from 'fs';
import path from 'path';
import { Logger } from '../../../application/ports/Logger';

export interface SSLConfiguration {
  enabled: boolean;
  rejectUnauthorized: boolean;
  ca?: string | Buffer;
  cert?: string | Buffer;
  key?: string | Buffer;
  passphrase?: string;
  servername?: string;
  checkServerIdentity?: boolean;
  minVersion?: string;
  maxVersion?: string;
  ciphers?: string;
}

export class SSLConfig {
  private static instance: SSLConfig;
  private config: SSLConfiguration;

  constructor(private readonly logger: Logger) {
    this.config = this.buildSSLConfig();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(logger: Logger): SSLConfig {
    if (!SSLConfig.instance) {
      SSLConfig.instance = new SSLConfig(logger);
    }
    return SSLConfig.instance;
  }

  /**
   * Build SSL configuration from environment variables and files
   */
  private buildSSLConfig(): SSLConfiguration {
    const environment = process.env.NODE_ENV || 'development';
    
    // SSL is required in production
    const sslEnabled = environment === 'production' || process.env.DB_SSL_ENABLED === 'true';
    
    if (!sslEnabled) {
      this.logger.info('Database SSL disabled', { environment });
      return { enabled: false, rejectUnauthorized: false };
    }

    this.logger.info('Configuring database SSL', { environment });

    const config: SSLConfiguration = {
      enabled: true,
      rejectUnauthorized: environment === 'production',
      checkServerIdentity: environment === 'production',
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      ciphers: this.getSecureCiphers()
    };

    // Load SSL certificates
    try {
      config.ca = this.loadCertificate('DB_SSL_CA', 'ca.pem');
      config.cert = this.loadCertificate('DB_SSL_CERT', 'client-cert.pem');
      config.key = this.loadCertificate('DB_SSL_KEY', 'client-key.pem');
      config.passphrase = process.env.DB_SSL_PASSPHRASE;
      config.servername = process.env.DB_SSL_SERVERNAME || process.env.DB_HOST;

      this.validateSSLConfig(config);
    } catch (error) {
      this.logger.error('Failed to load SSL certificates', error as Error);
      
      if (environment === 'production') {
        throw error;
      } else {
        this.logger.warn('SSL configuration failed, falling back to insecure connection');
        return { enabled: false, rejectUnauthorized: false };
      }
    }

    return config;
  }

  /**
   * Load SSL certificate from environment variable or file
   */
  private loadCertificate(envVar: string, defaultFilename: string): string | Buffer | undefined {
    // First try environment variable
    const envValue = process.env[envVar];
    if (envValue) {
      // Check if it's a file path or certificate content
      if (envValue.startsWith('-----BEGIN')) {
        return envValue;
      } else if (fs.existsSync(envValue)) {
        return fs.readFileSync(envValue);
      }
    }

    // Try default certificate directory
    const certDir = process.env.DB_SSL_CERT_DIR || '/etc/ssl/certs/postgresql';
    const certPath = path.join(certDir, defaultFilename);
    
    if (fs.existsSync(certPath)) {
      this.logger.debug('Loading SSL certificate', { path: certPath });
      return fs.readFileSync(certPath);
    }

    // Try application certificate directory
    const appCertDir = path.join(process.cwd(), 'certs', 'postgresql');
    const appCertPath = path.join(appCertDir, defaultFilename);
    
    if (fs.existsSync(appCertPath)) {
      this.logger.debug('Loading SSL certificate from app directory', { path: appCertPath });
      return fs.readFileSync(appCertPath);
    }

    this.logger.debug('SSL certificate not found', { 
      envVar, 
      defaultFilename,
      searchPaths: [certPath, appCertPath]
    });

    return undefined;
  }

  /**
   * Get secure cipher suites for TLS
   */
  private getSecureCiphers(): string {
    // Modern secure cipher suites (TLS 1.2 and 1.3)
    return [
      // TLS 1.3 cipher suites
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
      
      // TLS 1.2 cipher suites
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-SHA384',
      'ECDHE-RSA-AES128-SHA256',
      'ECDHE-RSA-AES256-SHA',
      'ECDHE-RSA-AES128-SHA',
      
      // Additional secure options
      'DHE-RSA-AES256-GCM-SHA384',
      'DHE-RSA-AES128-GCM-SHA256',
      'DHE-RSA-AES256-SHA256',
      'DHE-RSA-AES128-SHA256'
    ].join(':');
  }

  /**
   * Validate SSL configuration
   */
  private validateSSLConfig(config: SSLConfiguration): void {
    if (!config.enabled) {
      return;
    }

    const environment = process.env.NODE_ENV || 'development';

    // In production, require proper certificates
    if (environment === 'production') {
      if (!config.ca) {
        throw new Error('SSL CA certificate is required in production');
      }

      if (config.rejectUnauthorized && !config.servername) {
        throw new Error('SSL servername is required when rejectUnauthorized is true');
      }
    }

    // Validate TLS versions
    const validVersions = ['TLSv1.2', 'TLSv1.3'];
    if (config.minVersion && !validVersions.includes(config.minVersion)) {
      throw new Error(`Invalid SSL minVersion: ${config.minVersion}`);
    }
    if (config.maxVersion && !validVersions.includes(config.maxVersion)) {
      throw new Error(`Invalid SSL maxVersion: ${config.maxVersion}`);
    }

    this.logger.info('SSL configuration validated', {
      rejectUnauthorized: config.rejectUnauthorized,
      hasCa: !!config.ca,
      hasCert: !!config.cert,
      hasKey: !!config.key,
      servername: config.servername,
      minVersion: config.minVersion,
      maxVersion: config.maxVersion
    });
  }

  /**
   * Get SSL configuration for pg Pool
   */
  public getSSLConfig(): SSLConfiguration | false {
    if (!this.config.enabled) {
      return false;
    }

    // Return configuration without sensitive data logging
    const sslConfig = { ...this.config };
    delete sslConfig.enabled; // Remove our custom property
    
    return sslConfig;
  }

  /**
   * Test SSL connection
   */
  public async testSSLConnection(host: string, port: number): Promise<boolean> {
    if (!this.config.enabled) {
      return true; // SSL not required
    }

    try {
      const tls = require('tls');
      
      return new Promise<boolean>((resolve, reject) => {
        const options = {
          host,
          port,
          servername: this.config.servername || host,
          ca: this.config.ca,
          cert: this.config.cert,
          key: this.config.key,
          passphrase: this.config.passphrase,
          rejectUnauthorized: this.config.rejectUnauthorized,
          minVersion: this.config.minVersion,
          maxVersion: this.config.maxVersion,
          ciphers: this.config.ciphers,
          timeout: 10000
        };

        const socket = tls.connect(options, () => {
          this.logger.info('SSL connection test successful', {
            host,
            port,
            authorized: socket.authorized,
            protocol: socket.getProtocol(),
            cipher: socket.getCipher()
          });
          
          socket.end();
          resolve(true);
        });

        socket.on('error', (error) => {
          this.logger.error('SSL connection test failed', error, { host, port });
          reject(error);
        });

        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('SSL connection timeout'));
        });
      });

    } catch (error) {
      this.logger.error('SSL connection test error', error as Error);
      return false;
    }
  }

  /**
   * Generate self-signed certificates for development
   */
  public async generateDevCertificates(outputDir: string): Promise<void> {
    const crypto = require('crypto');
    const forge = require('node-forge');

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot generate self-signed certificates in production');
    }

    this.logger.info('Generating self-signed certificates for development', { outputDir });

    try {
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate CA key pair
      const caKeys = forge.pki.rsa.generateKeyPair(2048);
      const caCert = forge.pki.createCertificate();
      
      caCert.publicKey = caKeys.publicKey;
      caCert.serialNumber = '01';
      caCert.validity.notBefore = new Date();
      caCert.validity.notAfter = new Date();
      caCert.validity.notAfter.setFullYear(caCert.validity.notBefore.getFullYear() + 1);

      const caAttrs = [{
        name: 'commonName',
        value: 'Spotify API Dev CA'
      }, {
        name: 'organizationName',
        value: 'Spotify API Development'
      }];

      caCert.setSubject(caAttrs);
      caCert.setIssuer(caAttrs);
      caCert.setExtensions([{
        name: 'basicConstraints',
        cA: true
      }, {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        keyEncipherment: true
      }]);

      caCert.sign(caKeys.privateKey);

      // Generate server key pair
      const serverKeys = forge.pki.rsa.generateKeyPair(2048);
      const serverCert = forge.pki.createCertificate();
      
      serverCert.publicKey = serverKeys.publicKey;
      serverCert.serialNumber = '02';
      serverCert.validity.notBefore = new Date();
      serverCert.validity.notAfter = new Date();
      serverCert.validity.notAfter.setFullYear(serverCert.validity.notBefore.getFullYear() + 1);

      const serverAttrs = [{
        name: 'commonName',
        value: 'localhost'
      }];

      serverCert.setSubject(serverAttrs);
      serverCert.setIssuer(caAttrs);
      serverCert.setExtensions([{
        name: 'subjectAltName',
        altNames: [{
          type: 2, // DNS
          value: 'localhost'
        }, {
          type: 7, // IP
          ip: '127.0.0.1'
        }]
      }]);

      serverCert.sign(caKeys.privateKey);

      // Write certificates to files
      fs.writeFileSync(
        path.join(outputDir, 'ca.pem'),
        forge.pki.certificateToPem(caCert)
      );

      fs.writeFileSync(
        path.join(outputDir, 'server-cert.pem'),
        forge.pki.certificateToPem(serverCert)
      );

      fs.writeFileSync(
        path.join(outputDir, 'server-key.pem'),
        forge.pki.privateKeyToPem(serverKeys.privateKey)
      );

      // Set appropriate permissions
      fs.chmodSync(path.join(outputDir, 'server-key.pem'), 0o600);

      this.logger.info('Development certificates generated successfully', {
        outputDir,
        files: ['ca.pem', 'server-cert.pem', 'server-key.pem']
      });

    } catch (error) {
      this.logger.error('Failed to generate development certificates', error as Error);
      throw error;
    }
  }

  /**
   * Get SSL configuration summary (for logging/monitoring)
   */
  public getConfigSummary(): any {
    return {
      enabled: this.config.enabled,
      rejectUnauthorized: this.config.rejectUnauthorized,
      hasCa: !!this.config.ca,
      hasCert: !!this.config.cert,
      hasKey: !!this.config.key,
      servername: this.config.servername,
      minVersion: this.config.minVersion,
      maxVersion: this.config.maxVersion,
      checkServerIdentity: this.config.checkServerIdentity
    };
  }
}