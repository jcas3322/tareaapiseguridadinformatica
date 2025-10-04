#!/bin/bash

# Spotify API Security Audit Script
# Comprehensive security audit for dependencies, code, and configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
AUDIT_DIR="./security-audit-$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="$AUDIT_DIR/security-audit-report.json"
HTML_REPORT="$AUDIT_DIR/security-audit-report.html"
FAIL_ON_HIGH=false
FAIL_ON_CRITICAL=true
SKIP_DEPS=false
SKIP_CODE=false
SKIP_CONFIG=false
VERBOSE=false

# Counters
TOTAL_ISSUES=0
CRITICAL_ISSUES=0
HIGH_ISSUES=0
MEDIUM_ISSUES=0
LOW_ISSUES=0

# Function to print colored output
print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_critical() {
    echo -e "${RED}[CRITICAL]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Spotify API Security Audit Script

Usage: $0 [OPTIONS]

Options:
    --fail-on-high          Fail the audit if high severity issues are found
    --fail-on-critical      Fail the audit if critical severity issues are found (default)
    --skip-deps             Skip dependency vulnerability scanning
    --skip-code             Skip static code analysis
    --skip-config           Skip configuration security checks
    --verbose               Enable verbose output
    -h, --help              Show this help message

Examples:
    $0                      Run full security audit
    $0 --fail-on-high       Fail on high severity issues
    $0 --skip-deps          Skip dependency scanning
    $0 --verbose            Run with verbose output

Output:
    Results are saved to: $AUDIT_DIR/
    - security-audit-report.json (machine-readable)
    - security-audit-report.html (human-readable)
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --fail-on-high)
            FAIL_ON_HIGH=true
            shift
            ;;
        --fail-on-critical)
            FAIL_ON_CRITICAL=true
            shift
            ;;
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        --skip-code)
            SKIP_CODE=true
            shift
            ;;
        --skip-config)
            SKIP_CONFIG=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Create audit directory
mkdir -p "$AUDIT_DIR"

# Initialize report
cat > "$REPORT_FILE" << EOF
{
  "audit_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "audit_version": "1.0.0",
  "project": "Spotify API",
  "environment": "${NODE_ENV:-development}",
  "results": {
    "summary": {
      "total_issues": 0,
      "critical_issues": 0,
      "high_issues": 0,
      "medium_issues": 0,
      "low_issues": 0
    },
    "dependency_scan": {},
    "code_analysis": {},
    "configuration_check": {}
  }
}
EOF

print_header "SPOTIFY API SECURITY AUDIT"
print_status "Starting comprehensive security audit..."
print_status "Audit directory: $AUDIT_DIR"

# Function to update issue counters
update_counters() {
    local severity=$1
    local count=$2
    
    TOTAL_ISSUES=$((TOTAL_ISSUES + count))
    
    case $severity in
        "critical")
            CRITICAL_ISSUES=$((CRITICAL_ISSUES + count))
            ;;
        "high")
            HIGH_ISSUES=$((HIGH_ISSUES + count))
            ;;
        "medium")
            MEDIUM_ISSUES=$((MEDIUM_ISSUES + count))
            ;;
        "low")
            LOW_ISSUES=$((LOW_ISSUES + count))
            ;;
    esac
}

# Function to add result to report
add_to_report() {
    local section=$1
    local key=$2
    local value=$3
    
    # Use jq to update the JSON report
    if command -v jq >/dev/null 2>&1; then
        tmp=$(mktemp)
        jq ".results.$section.$key = $value" "$REPORT_FILE" > "$tmp" && mv "$tmp" "$REPORT_FILE"
    fi
}

# 1. DEPENDENCY VULNERABILITY SCANNING
if [[ "$SKIP_DEPS" != true ]]; then
    print_header "DEPENDENCY VULNERABILITY SCANNING"
    
    # NPM Audit
    print_status "Running npm audit..."
    if npm audit --json > "$AUDIT_DIR/npm-audit.json" 2>/dev/null; then
        print_success "npm audit completed"
        
        # Parse npm audit results
        if command -v jq >/dev/null 2>&1; then
            npm_critical=$(jq -r '.metadata.vulnerabilities.critical // 0' "$AUDIT_DIR/npm-audit.json")
            npm_high=$(jq -r '.metadata.vulnerabilities.high // 0' "$AUDIT_DIR/npm-audit.json")
            npm_moderate=$(jq -r '.metadata.vulnerabilities.moderate // 0' "$AUDIT_DIR/npm-audit.json")
            npm_low=$(jq -r '.metadata.vulnerabilities.low // 0' "$AUDIT_DIR/npm-audit.json")
            
            update_counters "critical" "$npm_critical"
            update_counters "high" "$npm_high"
            update_counters "medium" "$npm_moderate"
            update_counters "low" "$npm_low"
            
            print_status "NPM vulnerabilities found:"
            print_status "  Critical: $npm_critical"
            print_status "  High: $npm_high"
            print_status "  Moderate: $npm_moderate"
            print_status "  Low: $npm_low"
            
            add_to_report "dependency_scan" "npm_audit" "$(cat "$AUDIT_DIR/npm-audit.json")"
        fi
    else
        print_warning "npm audit failed or found vulnerabilities"
        npm audit --json > "$AUDIT_DIR/npm-audit.json" 2>&1 || true
    fi
    
    # Yarn Audit (if yarn.lock exists)
    if [[ -f "yarn.lock" ]]; then
        print_status "Running yarn audit..."
        if yarn audit --json > "$AUDIT_DIR/yarn-audit.json" 2>/dev/null; then
            print_success "yarn audit completed"
        else
            print_warning "yarn audit failed or found vulnerabilities"
            yarn audit --json > "$AUDIT_DIR/yarn-audit.json" 2>&1 || true
        fi
    fi
    
    # Check for known malicious packages
    print_status "Checking for known malicious packages..."
    malicious_packages=(
        "event-stream"
        "eslint-scope"
        "getcookies"
        "http-fetch"
        "node-fetch-npm"
        "crossenv"
        "cross-env.js"
        "d3.js"
        "fabric-js"
    )
    
    malicious_found=0
    for package in "${malicious_packages[@]}"; do
        if npm list "$package" >/dev/null 2>&1; then
            print_critical "Malicious package detected: $package"
            malicious_found=$((malicious_found + 1))
        fi
    done
    
    if [[ $malicious_found -gt 0 ]]; then
        update_counters "critical" "$malicious_found"
        echo "{\"malicious_packages_found\": $malicious_found}" > "$AUDIT_DIR/malicious-packages.json"
        add_to_report "dependency_scan" "malicious_packages" "$(cat "$AUDIT_DIR/malicious-packages.json")"
    else
        print_success "No known malicious packages found"
    fi
    
    # Check package integrity
    print_status "Checking package integrity..."
    if npm ls --json > "$AUDIT_DIR/package-tree.json" 2>/dev/null; then
        print_success "Package tree generated"
    else
        print_warning "Issues found in package tree"
        npm ls --json > "$AUDIT_DIR/package-tree.json" 2>&1 || true
    fi
    
else
    print_warning "Skipping dependency vulnerability scanning"
fi

# 2. STATIC CODE ANALYSIS
if [[ "$SKIP_CODE" != true ]]; then
    print_header "STATIC CODE ANALYSIS"
    
    # ESLint Security Rules
    print_status "Running ESLint with security rules..."
    if npx eslint . --ext .ts,.js --format json > "$AUDIT_DIR/eslint-results.json" 2>/dev/null; then
        print_success "ESLint completed with no issues"
    else
        print_warning "ESLint found issues"
        npx eslint . --ext .ts,.js --format json > "$AUDIT_DIR/eslint-results.json" 2>&1 || true
        
        # Count ESLint issues
        if command -v jq >/dev/null 2>&1 && [[ -f "$AUDIT_DIR/eslint-results.json" ]]; then
            eslint_errors=$(jq '[.[] | select(.errorCount > 0)] | length' "$AUDIT_DIR/eslint-results.json" 2>/dev/null || echo "0")
            eslint_warnings=$(jq '[.[] | select(.warningCount > 0)] | length' "$AUDIT_DIR/eslint-results.json" 2>/dev/null || echo "0")
            
            update_counters "high" "$eslint_errors"
            update_counters "medium" "$eslint_warnings"
            
            add_to_report "code_analysis" "eslint" "$(cat "$AUDIT_DIR/eslint-results.json")"
        fi
    fi
    
    # TypeScript Compiler Checks
    print_status "Running TypeScript compiler checks..."
    if npx tsc --noEmit --pretty false > "$AUDIT_DIR/tsc-results.txt" 2>&1; then
        print_success "TypeScript compilation successful"
    else
        print_warning "TypeScript compilation issues found"
        tsc_errors=$(grep -c "error TS" "$AUDIT_DIR/tsc-results.txt" 2>/dev/null || echo "0")
        update_counters "medium" "$tsc_errors"
    fi
    
    # Security-specific code patterns
    print_status "Scanning for security anti-patterns..."
    security_patterns=(
        "eval("
        "Function("
        "setTimeout.*string"
        "setInterval.*string"
        "innerHTML.*="
        "document.write"
        "process.env"
        "require.*child_process"
        "exec("
        "spawn("
        "\.system"
        "crypto\.createHash.*md5"
        "crypto\.createHash.*sha1"
        "Math\.random"
        "Date\.now.*password"
        "console\.log.*password"
        "console\.log.*token"
        "console\.log.*secret"
    )
    
    security_issues=0
    echo "Security pattern scan results:" > "$AUDIT_DIR/security-patterns.txt"
    
    for pattern in "${security_patterns[@]}"; do
        matches=$(grep -r -n "$pattern" src/ 2>/dev/null | wc -l || echo "0")
        if [[ $matches -gt 0 ]]; then
            echo "Pattern '$pattern': $matches matches" >> "$AUDIT_DIR/security-patterns.txt"
            grep -r -n "$pattern" src/ >> "$AUDIT_DIR/security-patterns.txt" 2>/dev/null || true
            security_issues=$((security_issues + matches))
        fi
    done
    
    if [[ $security_issues -gt 0 ]]; then
        print_warning "Found $security_issues potential security issues in code"
        update_counters "medium" "$security_issues"
    else
        print_success "No security anti-patterns found"
    fi
    
    # Check for hardcoded secrets
    print_status "Scanning for hardcoded secrets..."
    secret_patterns=(
        "password\s*=\s*['\"][^'\"]{8,}"
        "secret\s*=\s*['\"][^'\"]{16,}"
        "token\s*=\s*['\"][^'\"]{20,}"
        "api[_-]?key\s*=\s*['\"][^'\"]{16,}"
        "private[_-]?key\s*=\s*['\"]"
        "-----BEGIN.*PRIVATE.*KEY-----"
        "sk_live_[a-zA-Z0-9]+"
        "pk_live_[a-zA-Z0-9]+"
        "AKIA[0-9A-Z]{16}"
        "AIza[0-9A-Za-z\\-_]{35}"
    )
    
    secret_issues=0
    echo "Hardcoded secrets scan results:" > "$AUDIT_DIR/secrets-scan.txt"
    
    for pattern in "${secret_patterns[@]}"; do
        matches=$(grep -r -E -n "$pattern" src/ config/ 2>/dev/null | wc -l || echo "0")
        if [[ $matches -gt 0 ]]; then
            echo "Secret pattern '$pattern': $matches matches" >> "$AUDIT_DIR/secrets-scan.txt"
            grep -r -E -n "$pattern" src/ config/ >> "$AUDIT_DIR/secrets-scan.txt" 2>/dev/null || true
            secret_issues=$((secret_issues + matches))
        fi
    done
    
    if [[ $secret_issues -gt 0 ]]; then
        print_critical "Found $secret_issues potential hardcoded secrets!"
        update_counters "critical" "$secret_issues"
    else
        print_success "No hardcoded secrets found"
    fi
    
else
    print_warning "Skipping static code analysis"
fi

# 3. CONFIGURATION SECURITY CHECKS
if [[ "$SKIP_CONFIG" != true ]]; then
    print_header "CONFIGURATION SECURITY CHECKS"
    
    config_issues=0
    echo "Configuration security check results:" > "$AUDIT_DIR/config-security.txt"
    
    # Check environment files
    print_status "Checking environment configuration..."
    
    env_files=(".env" ".env.example" "config/environments/development.env" "config/environments/staging.env" "config/environments/production.env")
    
    for env_file in "${env_files[@]}"; do
        if [[ -f "$env_file" ]]; then
            echo "Checking $env_file:" >> "$AUDIT_DIR/config-security.txt"
            
            # Check for weak secrets
            if grep -q "secret.*=.*dev\|secret.*=.*test\|secret.*=.*123\|secret.*=.*password" "$env_file" 2>/dev/null; then
                echo "  ❌ Weak secrets found" >> "$AUDIT_DIR/config-security.txt"
                config_issues=$((config_issues + 1))
            else
                echo "  ✅ No weak secrets" >> "$AUDIT_DIR/config-security.txt"
            fi
            
            # Check for default passwords
            if grep -q "password.*=.*admin\|password.*=.*123\|password.*=.*password" "$env_file" 2>/dev/null; then
                echo "  ❌ Default passwords found" >> "$AUDIT_DIR/config-security.txt"
                config_issues=$((config_issues + 1))
            else
                echo "  ✅ No default passwords" >> "$AUDIT_DIR/config-security.txt"
            fi
            
            # Check SSL/TLS settings
            if grep -q "SSL.*=.*false\|TLS.*=.*false" "$env_file" 2>/dev/null; then
                if [[ "$env_file" != *"development"* ]]; then
                    echo "  ❌ SSL/TLS disabled in non-dev environment" >> "$AUDIT_DIR/config-security.txt"
                    config_issues=$((config_issues + 1))
                else
                    echo "  ⚠️  SSL/TLS disabled (development)" >> "$AUDIT_DIR/config-security.txt"
                fi
            else
                echo "  ✅ SSL/TLS properly configured" >> "$AUDIT_DIR/config-security.txt"
            fi
        fi
    done
    
    # Check Docker configuration
    print_status "Checking Docker security..."
    
    if [[ -f "Dockerfile" ]]; then
        echo "Checking Dockerfile:" >> "$AUDIT_DIR/config-security.txt"
        
        # Check if running as root
        if ! grep -q "USER.*[^root]" Dockerfile; then
            echo "  ❌ Container may run as root" >> "$AUDIT_DIR/config-security.txt"
            config_issues=$((config_issues + 1))
        else
            echo "  ✅ Non-root user configured" >> "$AUDIT_DIR/config-security.txt"
        fi
        
        # Check for COPY --chown
        if grep -q "COPY.*--chown" Dockerfile; then
            echo "  ✅ Proper file ownership in COPY commands" >> "$AUDIT_DIR/config-security.txt"
        else
            echo "  ⚠️  Consider using --chown in COPY commands" >> "$AUDIT_DIR/config-security.txt"
        fi
        
        # Check for health checks
        if grep -q "HEALTHCHECK" Dockerfile; then
            echo "  ✅ Health check configured" >> "$AUDIT_DIR/config-security.txt"
        else
            echo "  ⚠️  No health check configured" >> "$AUDIT_DIR/config-security.txt"
        fi
    fi
    
    # Check package.json security
    print_status "Checking package.json security..."
    
    if [[ -f "package.json" ]]; then
        echo "Checking package.json:" >> "$AUDIT_DIR/config-security.txt"
        
        # Check for scripts with sudo
        if grep -q "sudo" package.json; then
            echo "  ❌ Scripts using sudo found" >> "$AUDIT_DIR/config-security.txt"
            config_issues=$((config_issues + 1))
        else
            echo "  ✅ No sudo in scripts" >> "$AUDIT_DIR/config-security.txt"
        fi
        
        # Check for postinstall scripts
        if grep -q "postinstall" package.json; then
            echo "  ⚠️  Postinstall script found - review for security" >> "$AUDIT_DIR/config-security.txt"
        else
            echo "  ✅ No postinstall scripts" >> "$AUDIT_DIR/config-security.txt"
        fi
    fi
    
    if [[ $config_issues -gt 0 ]]; then
        print_warning "Found $config_issues configuration security issues"
        update_counters "medium" "$config_issues"
    else
        print_success "Configuration security checks passed"
    fi
    
else
    print_warning "Skipping configuration security checks"
fi

# Update final counters in report
if command -v jq >/dev/null 2>&1; then
    tmp=$(mktemp)
    jq ".results.summary.total_issues = $TOTAL_ISSUES | 
        .results.summary.critical_issues = $CRITICAL_ISSUES |
        .results.summary.high_issues = $HIGH_ISSUES |
        .results.summary.medium_issues = $MEDIUM_ISSUES |
        .results.summary.low_issues = $LOW_ISSUES" "$REPORT_FILE" > "$tmp" && mv "$tmp" "$REPORT_FILE"
fi

# Generate HTML report
print_status "Generating HTML report..."
cat > "$HTML_REPORT" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spotify API Security Audit Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .number { font-size: 2em; font-weight: bold; }
        .critical { color: #dc3545; }
        .high { color: #fd7e14; }
        .medium { color: #ffc107; }
        .low { color: #28a745; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .timestamp { color: #666; font-size: 0.9em; }
        .status-pass { color: #28a745; font-weight: bold; }
        .status-fail { color: #dc3545; font-weight: bold; }
        .file-list { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 10px 0; }
        .file-list ul { margin: 0; padding-left: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Spotify API Security Audit Report</h1>
            <p class="timestamp">Generated on $(date)</p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <h3>Total Issues</h3>
                <div class="number">$TOTAL_ISSUES</div>
            </div>
            <div class="metric">
                <h3>Critical</h3>
                <div class="number critical">$CRITICAL_ISSUES</div>
            </div>
            <div class="metric">
                <h3>High</h3>
                <div class="number high">$HIGH_ISSUES</div>
            </div>
            <div class="metric">
                <h3>Medium</h3>
                <div class="number medium">$MEDIUM_ISSUES</div>
            </div>
            <div class="metric">
                <h3>Low</h3>
                <div class="number low">$LOW_ISSUES</div>
            </div>
        </div>
        
        <div class="section">
            <h2>📦 Dependency Scan</h2>
            <p>Status: $([ "$SKIP_DEPS" = true ] && echo "Skipped" || echo "Completed")</p>
            <div class="file-list">
                <h4>Generated Files:</h4>
                <ul>
                    <li>npm-audit.json - NPM vulnerability report</li>
                    <li>package-tree.json - Package dependency tree</li>
                    $([ -f "$AUDIT_DIR/yarn-audit.json" ] && echo "<li>yarn-audit.json - Yarn vulnerability report</li>")
                    $([ -f "$AUDIT_DIR/malicious-packages.json" ] && echo "<li>malicious-packages.json - Malicious package detection</li>")
                </ul>
            </div>
        </div>
        
        <div class="section">
            <h2>🔍 Code Analysis</h2>
            <p>Status: $([ "$SKIP_CODE" = true ] && echo "Skipped" || echo "Completed")</p>
            <div class="file-list">
                <h4>Generated Files:</h4>
                <ul>
                    <li>eslint-results.json - ESLint security analysis</li>
                    <li>tsc-results.txt - TypeScript compiler checks</li>
                    <li>security-patterns.txt - Security anti-pattern scan</li>
                    <li>secrets-scan.txt - Hardcoded secrets detection</li>
                </ul>
            </div>
        </div>
        
        <div class="section">
            <h2>⚙️ Configuration Check</h2>
            <p>Status: $([ "$SKIP_CONFIG" = true ] && echo "Skipped" || echo "Completed")</p>
            <div class="file-list">
                <h4>Generated Files:</h4>
                <ul>
                    <li>config-security.txt - Configuration security analysis</li>
                </ul>
            </div>
        </div>
        
        <div class="section">
            <h2>📋 Recommendations</h2>
            <ul>
                $([ $CRITICAL_ISSUES -gt 0 ] && echo "<li class='status-fail'>🚨 Address $CRITICAL_ISSUES critical issues immediately</li>")
                $([ $HIGH_ISSUES -gt 0 ] && echo "<li class='status-fail'>⚠️ Review and fix $HIGH_ISSUES high severity issues</li>")
                $([ $MEDIUM_ISSUES -gt 0 ] && echo "<li>📝 Consider addressing $MEDIUM_ISSUES medium severity issues</li>")
                $([ $TOTAL_ISSUES -eq 0 ] && echo "<li class='status-pass'>✅ No security issues found - great job!</li>")
                <li>🔄 Run security audits regularly (recommended: weekly)</li>
                <li>📚 Review the generated files for detailed information</li>
                <li>🛡️ Keep dependencies updated to latest secure versions</li>
            </ul>
        </div>
    </div>
</body>
</html>
EOF

# FINAL SUMMARY
print_header "SECURITY AUDIT SUMMARY"
print_status "Audit completed successfully!"
print_status "Results saved to: $AUDIT_DIR"
print_status ""
print_status "Issue Summary:"
print_status "  Total Issues: $TOTAL_ISSUES"
print_status "  Critical: $CRITICAL_ISSUES"
print_status "  High: $HIGH_ISSUES"
print_status "  Medium: $MEDIUM_ISSUES"
print_status "  Low: $LOW_ISSUES"
print_status ""
print_status "Reports generated:"
print_status "  JSON Report: $REPORT_FILE"
print_status "  HTML Report: $HTML_REPORT"

# Exit with appropriate code
exit_code=0

if [[ $CRITICAL_ISSUES -gt 0 && "$FAIL_ON_CRITICAL" == true ]]; then
    print_error "Audit failed due to critical issues"
    exit_code=1
elif [[ $HIGH_ISSUES -gt 0 && "$FAIL_ON_HIGH" == true ]]; then
    print_error "Audit failed due to high severity issues"
    exit_code=1
elif [[ $TOTAL_ISSUES -eq 0 ]]; then
    print_success "🎉 No security issues found! 🎉"
else
    print_warning "Security issues found but not failing audit"
fi

exit $exit_code