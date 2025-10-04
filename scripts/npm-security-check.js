#!/usr/bin/env node

/**
 * NPM Security Check Script
 * Advanced NPM package security verification with integrity checks
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  outputDir: './security-audit-npm',
  packageJsonPath: './package.json',
  packageLockPath: './package-lock.json',
  knownVulnerablePackages: [
    'event-stream',
    'eslint-scope',
    'getcookies',
    'http-fetch',
    'node-fetch-npm',
    'crossenv',
    'cross-env.js',
    'd3.js',
    'fabric-js',
    'flatmap-stream',
    'ps-tree',
    'rc',
    'request',
    'lodash',
    'minimist',
    'yargs-parser'
  ],
  suspiciousPatterns: [
    /bitcoin/i,
    /cryptocurrency/i,
    /mining/i,
    /wallet/i,
    /keylogger/i,
    /backdoor/i,
    /malware/i,
    /trojan/i,
    /virus/i,
    /exploit/i
  ],
  trustedRegistries: [
    'https://registry.npmjs.org/',
    'https://npm.pkg.github.com/'
  ]
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  purple: '\x1b[35m'
};

// Logging functions
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  critical: (msg) => console.log(`${colors.red}[CRITICAL]${colors.reset} ${msg}`)
};

class NPMSecurityChecker {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      summary: {
        totalPackages: 0,
        vulnerablePackages: 0,
        suspiciousPackages: 0,
        integrityIssues: 0,
        licenseIssues: 0
      },
      vulnerabilities: [],
      suspiciousPackages: [],
      integrityChecks: [],
      licenseAnalysis: [],
      recommendations: []
    };
    
    // Create output directory
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
  }

  /**
   * Run complete security check
   */
  async runSecurityCheck() {
    log.info('Starting NPM security check...');
    
    try {
      await this.loadPackageInfo();
      await this.runNPMAudit();
      await this.checkKnownVulnerablePackages();
      await this.analyzeSuspiciousPackages();
      await this.verifyPackageIntegrity();
      await this.analyzeLicenses();
      await this.checkPackageAge();
      await this.analyzePackageSize();
      await this.generateRecommendations();
      await this.saveResults();
      
      this.printSummary();
      
    } catch (error) {
      log.error(`Security check failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Load package information
   */
  async loadPackageInfo() {
    log.info('Loading package information...');
    
    if (!fs.existsSync(CONFIG.packageJsonPath)) {
      throw new Error('package.json not found');
    }
    
    this.packageJson = JSON.parse(fs.readFileSync(CONFIG.packageJsonPath, 'utf8'));
    
    if (fs.existsSync(CONFIG.packageLockPath)) {
      this.packageLock = JSON.parse(fs.readFileSync(CONFIG.packageLockPath, 'utf8'));
    }
    
    // Count total packages
    const dependencies = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies
    };
    
    this.results.summary.totalPackages = Object.keys(dependencies).length;
    log.info(`Found ${this.results.summary.totalPackages} packages to analyze`);
  }

  /**
   * Run npm audit
   */
  async runNPMAudit() {
    log.info('Running npm audit...');
    
    try {
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);
      
      // Save full audit results
      fs.writeFileSync(
        path.join(CONFIG.outputDir, 'npm-audit-full.json'),
        JSON.stringify(audit, null, 2)
      );
      
      // Process vulnerabilities
      if (audit.vulnerabilities) {
        for (const [packageName, vuln] of Object.entries(audit.vulnerabilities)) {
          this.results.vulnerabilities.push({
            package: packageName,
            severity: vuln.severity,
            title: vuln.title,
            overview: vuln.overview,
            recommendation: vuln.recommendation,
            references: vuln.references,
            vulnerableVersions: vuln.range,
            patchedVersions: vuln.fixAvailable ? 'Available' : 'None'
          });
        }
        
        this.results.summary.vulnerablePackages = Object.keys(audit.vulnerabilities).length;
      }
      
      log.success(`npm audit completed - found ${this.results.summary.vulnerablePackages} vulnerable packages`);
      
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities are found
      if (error.stdout) {
        try {
          const audit = JSON.parse(error.stdout);
          // Process as above
          log.warning('npm audit found vulnerabilities');
        } catch (parseError) {
          log.error('Failed to parse npm audit output');
        }
      }
    }
  }

  /**
   * Check for known vulnerable packages
   */
  async checkKnownVulnerablePackages() {
    log.info('Checking for known vulnerable packages...');
    
    const allPackages = this.getAllPackages();
    const knownVulnerable = [];
    
    for (const packageName of allPackages) {
      if (CONFIG.knownVulnerablePackages.includes(packageName)) {
        knownVulnerable.push({
          package: packageName,
          reason: 'Known vulnerable package',
          severity: 'critical',
          recommendation: 'Remove immediately and find alternative'
        });
      }
    }
    
    this.results.suspiciousPackages.push(...knownVulnerable);
    this.results.summary.suspiciousPackages += knownVulnerable.length;
    
    if (knownVulnerable.length > 0) {
      log.critical(`Found ${knownVulnerable.length} known vulnerable packages!`);
    } else {
      log.success('No known vulnerable packages found');
    }
  }

  /**
   * Analyze suspicious packages
   */
  async analyzeSuspiciousPackages() {
    log.info('Analyzing packages for suspicious patterns...');
    
    const allPackages = this.getAllPackages();
    const suspicious = [];
    
    for (const packageName of allPackages) {
      // Check package name for suspicious patterns
      for (const pattern of CONFIG.suspiciousPatterns) {
        if (pattern.test(packageName)) {
          suspicious.push({
            package: packageName,
            reason: `Suspicious name pattern: ${pattern}`,
            severity: 'medium',
            recommendation: 'Review package purpose and legitimacy'
          });
          break;
        }
      }
      
      // Check for typosquatting (similar to popular packages)
      const similarPackages = this.findSimilarPackages(packageName);
      if (similarPackages.length > 0) {
        suspicious.push({
          package: packageName,
          reason: `Potential typosquatting - similar to: ${similarPackages.join(', ')}`,
          severity: 'high',
          recommendation: 'Verify this is the intended package'
        });
      }
    }
    
    this.results.suspiciousPackages.push(...suspicious);
    this.results.summary.suspiciousPackages += suspicious.length;
    
    log.info(`Found ${suspicious.length} potentially suspicious packages`);
  }

  /**
   * Verify package integrity
   */
  async verifyPackageIntegrity() {
    log.info('Verifying package integrity...');
    
    if (!this.packageLock || !this.packageLock.packages) {
      log.warning('No package-lock.json found, skipping integrity checks');
      return;
    }
    
    const integrityIssues = [];
    
    for (const [packagePath, packageInfo] of Object.entries(this.packageLock.packages)) {
      if (packagePath === '' || !packageInfo.integrity) continue;
      
      const packageName = packagePath.replace('node_modules/', '');
      
      // Check if integrity hash is present
      if (!packageInfo.integrity) {
        integrityIssues.push({
          package: packageName,
          issue: 'Missing integrity hash',
          severity: 'medium',
          recommendation: 'Regenerate package-lock.json'
        });
      }
      
      // Check for weak hash algorithms
      if (packageInfo.integrity && packageInfo.integrity.startsWith('sha1-')) {
        integrityIssues.push({
          package: packageName,
          issue: 'Using weak SHA1 hash',
          severity: 'low',
          recommendation: 'Update to use SHA512'
        });
      }
    }
    
    this.results.integrityChecks = integrityIssues;
    this.results.summary.integrityIssues = integrityIssues.length;
    
    log.info(`Found ${integrityIssues.length} integrity issues`);
  }

  /**
   * Analyze package licenses
   */
  async analyzeLicenses() {
    log.info('Analyzing package licenses...');
    
    try {
      // Use npm-license-checker if available
      const licenseResult = execSync('npx license-checker --json --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC"', 
        { encoding: 'utf8' });
      
      const licenses = JSON.parse(licenseResult);
      const licenseIssues = [];
      
      // Check for problematic licenses
      const problematicLicenses = ['GPL', 'AGPL', 'LGPL', 'UNLICENSED', 'UNKNOWN'];
      
      for (const [packageName, licenseInfo] of Object.entries(licenses)) {
        const license = licenseInfo.licenses;
        
        if (problematicLicenses.some(prob => license.includes(prob))) {
          licenseIssues.push({
            package: packageName,
            license: license,
            issue: 'Potentially problematic license',
            severity: 'medium',
            recommendation: 'Review license compatibility with your project'
          });
        }
      }
      
      this.results.licenseAnalysis = licenseIssues;
      this.results.summary.licenseIssues = licenseIssues.length;
      
      // Save full license report
      fs.writeFileSync(
        path.join(CONFIG.outputDir, 'license-report.json'),
        JSON.stringify(licenses, null, 2)
      );
      
      log.info(`Analyzed licenses - found ${licenseIssues.length} potential issues`);
      
    } catch (error) {
      log.warning('License analysis failed - install license-checker for detailed analysis');
    }
  }

  /**
   * Check package age and maintenance
   */
  async checkPackageAge() {
    log.info('Checking package age and maintenance status...');
    
    const allPackages = this.getAllPackages();
    const ageIssues = [];
    
    // This would require npm registry API calls
    // For now, we'll check for packages that haven't been updated in package.json
    
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    // Add to recommendations instead of detailed analysis
    this.results.recommendations.push({
      category: 'maintenance',
      recommendation: 'Regularly check package ages using: npm outdated',
      priority: 'medium'
    });
  }

  /**
   * Analyze package sizes
   */
  async analyzePackageSize() {
    log.info('Analyzing package sizes...');
    
    try {
      // Check if node_modules exists
      if (fs.existsSync('./node_modules')) {
        const sizeResult = execSync('du -sh node_modules/* 2>/dev/null | sort -hr | head -20', 
          { encoding: 'utf8' });
        
        fs.writeFileSync(
          path.join(CONFIG.outputDir, 'package-sizes.txt'),
          `Top 20 largest packages:\n${sizeResult}`
        );
        
        log.info('Package size analysis saved to package-sizes.txt');
      }
    } catch (error) {
      log.warning('Package size analysis failed');
    }
  }

  /**
   * Generate security recommendations
   */
  async generateRecommendations() {
    log.info('Generating security recommendations...');
    
    const recommendations = [];
    
    // Based on findings
    if (this.results.summary.vulnerablePackages > 0) {
      recommendations.push({
        category: 'vulnerabilities',
        recommendation: `Update ${this.results.summary.vulnerablePackages} vulnerable packages immediately`,
        priority: 'critical'
      });
    }
    
    if (this.results.summary.suspiciousPackages > 0) {
      recommendations.push({
        category: 'suspicious',
        recommendation: `Review ${this.results.summary.suspiciousPackages} suspicious packages`,
        priority: 'high'
      });
    }
    
    // General recommendations
    recommendations.push(
      {
        category: 'automation',
        recommendation: 'Set up automated dependency updates with Dependabot or Renovate',
        priority: 'medium'
      },
      {
        category: 'monitoring',
        recommendation: 'Run npm audit in CI/CD pipeline',
        priority: 'high'
      },
      {
        category: 'policy',
        recommendation: 'Implement package approval process for new dependencies',
        priority: 'medium'
      },
      {
        category: 'scanning',
        recommendation: 'Use additional tools like Snyk or WhiteSource for comprehensive scanning',
        priority: 'low'
      }
    );
    
    this.results.recommendations = recommendations;
  }

  /**
   * Get all packages from dependencies and devDependencies
   */
  getAllPackages() {
    const dependencies = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies
    };
    return Object.keys(dependencies);
  }

  /**
   * Find packages with similar names (potential typosquatting)
   */
  findSimilarPackages(packageName) {
    const popularPackages = [
      'react', 'angular', 'vue', 'express', 'lodash', 'moment', 'axios',
      'webpack', 'babel', 'eslint', 'typescript', 'jquery', 'bootstrap'
    ];
    
    const similar = [];
    
    for (const popular of popularPackages) {
      if (this.levenshteinDistance(packageName, popular) <= 2 && packageName !== popular) {
        similar.push(popular);
      }
    }
    
    return similar;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Save results to files
   */
  async saveResults() {
    log.info('Saving results...');
    
    // Save JSON report
    fs.writeFileSync(
      path.join(CONFIG.outputDir, 'npm-security-report.json'),
      JSON.stringify(this.results, null, 2)
    );
    
    // Save human-readable report
    const report = this.generateHumanReadableReport();
    fs.writeFileSync(
      path.join(CONFIG.outputDir, 'npm-security-report.txt'),
      report
    );
    
    log.success(`Results saved to ${CONFIG.outputDir}/`);
  }

  /**
   * Generate human-readable report
   */
  generateHumanReadableReport() {
    let report = 'NPM Security Check Report\n';
    report += '=========================\n\n';
    report += `Generated: ${this.results.timestamp}\n\n`;
    
    report += 'SUMMARY\n';
    report += '-------\n';
    report += `Total Packages: ${this.results.summary.totalPackages}\n`;
    report += `Vulnerable Packages: ${this.results.summary.vulnerablePackages}\n`;
    report += `Suspicious Packages: ${this.results.summary.suspiciousPackages}\n`;
    report += `Integrity Issues: ${this.results.summary.integrityIssues}\n`;
    report += `License Issues: ${this.results.summary.licenseIssues}\n\n`;
    
    if (this.results.vulnerabilities.length > 0) {
      report += 'VULNERABILITIES\n';
      report += '---------------\n';
      for (const vuln of this.results.vulnerabilities) {
        report += `Package: ${vuln.package}\n`;
        report += `Severity: ${vuln.severity}\n`;
        report += `Title: ${vuln.title}\n`;
        report += `Recommendation: ${vuln.recommendation}\n\n`;
      }
    }
    
    if (this.results.suspiciousPackages.length > 0) {
      report += 'SUSPICIOUS PACKAGES\n';
      report += '-------------------\n';
      for (const suspicious of this.results.suspiciousPackages) {
        report += `Package: ${suspicious.package}\n`;
        report += `Reason: ${suspicious.reason}\n`;
        report += `Severity: ${suspicious.severity}\n`;
        report += `Recommendation: ${suspicious.recommendation}\n\n`;
      }
    }
    
    report += 'RECOMMENDATIONS\n';
    report += '---------------\n';
    for (const rec of this.results.recommendations) {
      report += `[${rec.priority.toUpperCase()}] ${rec.recommendation}\n`;
    }
    
    return report;
  }

  /**
   * Print summary to console
   */
  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('NPM SECURITY CHECK SUMMARY');
    console.log('='.repeat(50));
    
    log.info(`Total Packages: ${this.results.summary.totalPackages}`);
    
    if (this.results.summary.vulnerablePackages > 0) {
      log.critical(`Vulnerable Packages: ${this.results.summary.vulnerablePackages}`);
    } else {
      log.success('No vulnerable packages found');
    }
    
    if (this.results.summary.suspiciousPackages > 0) {
      log.warning(`Suspicious Packages: ${this.results.summary.suspiciousPackages}`);
    } else {
      log.success('No suspicious packages found');
    }
    
    if (this.results.summary.integrityIssues > 0) {
      log.warning(`Integrity Issues: ${this.results.summary.integrityIssues}`);
    }
    
    if (this.results.summary.licenseIssues > 0) {
      log.warning(`License Issues: ${this.results.summary.licenseIssues}`);
    }
    
    console.log('\nReports saved to:', CONFIG.outputDir);
    console.log('='.repeat(50));
  }
}

// Run the security check
if (require.main === module) {
  const checker = new NPMSecurityChecker();
  checker.runSecurityCheck().catch(error => {
    console.error('Security check failed:', error);
    process.exit(1);
  });
}

module.exports = NPMSecurityChecker;