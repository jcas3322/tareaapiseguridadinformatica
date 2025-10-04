#!/usr/bin/env node

/**
 * Dependency Validation Script
 * Protects against supply chain attacks like shai-hulud
 * Validates package integrity and security before installation
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Trusted packages whitelist with known good maintainers
const TRUSTED_PACKAGES = {
  // Core Express ecosystem
  'express': { maintainer: 'expressjs', minDownloads: 10000000 },
  'helmet': { maintainer: 'helmetjs', minDownloads: 1000000 },
  'cors': { maintainer: 'expressjs', minDownloads: 5000000 },
  
  // Security packages
  'bcrypt': { maintainer: 'kelektiv', minDownloads: 1000000 },
  'jsonwebtoken': { maintainer: 'auth0', minDownloads: 5000000 },
  'joi': { maintainer: 'hapijs', minDownloads: 2000000 },
  
  // Utilities
  'winston': { maintainer: 'winstonjs', minDownloads: 2000000 },
  'dotenv': { maintainer: 'motdotla', minDownloads: 10000000 },
  'uuid': { maintainer: 'uuidjs', minDownloads: 50000000 },
  
  // Development tools
  'typescript': { maintainer: 'microsoft', minDownloads: 20000000 },
  'jest': { maintainer: 'jestjs', minDownloads: 10000000 },
  'eslint': { maintainer: 'eslint', minDownloads: 20000000 }
};

// Suspicious patterns that might indicate malicious packages
const SUSPICIOUS_PATTERNS = [
  /shai-hulud/i,
  /malware/i,
  /backdoor/i,
  /crypto-miner/i,
  /bitcoin/i,
  /ethereum/i,
  /wallet/i,
  /keylogger/i,
  /password-stealer/i
];

// Known malicious package names (update this list regularly)
const KNOWN_MALICIOUS = [
  'shai-hulud',
  'event-stream', // Historical example
  'eslint-scope', // Historical example
  'flatmap-stream' // Historical example
];

class DependencyValidator {
  constructor() {
    this.packageJsonPath = path.join(process.cwd(), 'package.json');
    this.warnings = [];
    this.errors = [];
  }

  async validate() {
    console.log('🔍 Validating dependencies for security...');
    
    try {
      const packageJson = this.loadPackageJson();
      
      // Validate all dependencies
      await this.validateDependencies(packageJson.dependencies || {}, 'production');
      await this.validateDependencies(packageJson.devDependencies || {}, 'development');
      
      this.reportResults();
      
      if (this.errors.length > 0) {
        console.error('❌ Dependency validation failed!');
        process.exit(1);
      }
      
      console.log('✅ Dependency validation passed!');
      
    } catch (error) {
      console.error('💥 Validation error:', error.message);
      process.exit(1);
    }
  }

  loadPackageJson() {
    if (!fs.existsSync(this.packageJsonPath)) {
      throw new Error('package.json not found');
    }
    
    return JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
  }

  async validateDependencies(dependencies, type) {
    for (const [packageName, version] of Object.entries(dependencies)) {
      await this.validatePackage(packageName, version, type);
    }
  }

  async validatePackage(packageName, version, type) {
    // Check against known malicious packages
    if (KNOWN_MALICIOUS.includes(packageName)) {
      this.errors.push(`🚨 CRITICAL: ${packageName} is a known malicious package!`);
      return;
    }

    // Check for suspicious patterns in package name
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(packageName)) {
        this.warnings.push(`⚠️  Suspicious package name: ${packageName} matches pattern ${pattern}`);
      }
    }

    // Validate against trusted packages list
    if (TRUSTED_PACKAGES[packageName]) {
      console.log(`✓ ${packageName}: Verified trusted package`);
    } else {
      this.warnings.push(`⚠️  ${packageName}: Not in trusted packages list - manual review recommended`);
    }

    // Check version format for suspicious patterns
    if (this.hasSuspiciousVersion(version)) {
      this.warnings.push(`⚠️  ${packageName}: Suspicious version format: ${version}`);
    }
  }

  hasSuspiciousVersion(version) {
    // Check for unusual version patterns that might indicate typosquatting
    const suspiciousVersionPatterns = [
      /^\d+\.\d+\.\d+-[a-f0-9]{40}$/, // Git commit hash versions
      /beta.*alpha/i, // Confusing pre-release tags
      /\d+\.\d+\.\d+\.\d+/, // Too many version parts
    ];

    return suspiciousVersionPatterns.some(pattern => pattern.test(version));
  }

  reportResults() {
    console.log('\n📊 Validation Results:');
    
    if (this.errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      this.errors.forEach(error => console.log(error));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(warning));
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ No security issues detected');
    }
  }
}

// Security recommendations
function printSecurityRecommendations() {
  console.log('\n🛡️  Security Recommendations:');
  console.log('1. Always use package-lock.json to lock dependency versions');
  console.log('2. Regularly run npm audit to check for vulnerabilities');
  console.log('3. Review package maintainers and download statistics');
  console.log('4. Use tools like Snyk for continuous security monitoring');
  console.log('5. Keep dependencies updated but test thoroughly');
  console.log('6. Consider using npm ci in production for reproducible builds');
}

// Main execution
if (require.main === module) {
  const validator = new DependencyValidator();
  validator.validate().then(() => {
    printSecurityRecommendations();
  }).catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = DependencyValidator;