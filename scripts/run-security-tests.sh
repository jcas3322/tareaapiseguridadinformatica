#!/bin/bash

# Security Testing Script
# Runs comprehensive security tests and generates reports

set -e

echo "🔒 Starting Security Test Suite..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create reports directory
mkdir -p reports/security

# Function to print colored output
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Set test environment
export NODE_ENV=test
export JWT_SECRET=test-secret-key-for-security-testing-minimum-32-chars
export DATABASE_URL=postgresql://test:test@localhost:5432/test_security_db
export BCRYPT_ROUNDS=10
export RATE_LIMIT_WINDOW=60000
export RATE_LIMIT_MAX=10

print_status "Environment configured for security testing"

# 1. Run OWASP Top 10 Tests
print_status "Running OWASP Top 10 security tests..."
if npm run test:security -- --testPathPattern=OWASP-Top10 --coverage --coverageDirectory=reports/security/owasp-coverage; then
    print_success "OWASP Top 10 tests completed"
else
    print_error "OWASP Top 10 tests failed"
    exit 1
fi

# 2. Run Comprehensive Security Tests
print_status "Running comprehensive security tests..."
if npm run test:security -- --testPathPattern=comprehensive-security --coverage --coverageDirectory=reports/security/comprehensive-coverage; then
    print_success "Comprehensive security tests completed"
else
    print_error "Comprehensive security tests failed"
    exit 1
fi

# 3. Run Security Configuration Tests
print_status "Running security configuration tests..."
if npm run test:security -- --testPathPattern=security-configuration --coverage --coverageDirectory=reports/security/config-coverage; then
    print_success "Security configuration tests completed"
else
    print_error "Security configuration tests failed"
    exit 1
fi

# 4. Run Penetration Tests
print_status "Running basic penetration tests..."
if npm run test:security -- --testPathPattern=penetration --coverage --coverageDirectory=reports/security/penetration-coverage; then
    print_success "Penetration tests completed"
else
    print_error "Penetration tests failed"
    exit 1
fi

# 5. Run NPM Security Audit
print_status "Running NPM security audit..."
if npm audit --audit-level=moderate > reports/security/npm-audit.txt 2>&1; then
    print_success "NPM audit completed - no high/critical vulnerabilities found"
else
    print_warning "NPM audit found vulnerabilities - check reports/security/npm-audit.txt"
fi

# 6. Run Snyk Security Scan (if available)
if command_exists snyk; then
    print_status "Running Snyk security scan..."
    if snyk test --json > reports/security/snyk-report.json 2>&1; then
        print_success "Snyk scan completed - no vulnerabilities found"
    else
        print_warning "Snyk scan found vulnerabilities - check reports/security/snyk-report.json"
    fi
else
    print_warning "Snyk not installed - skipping Snyk security scan"
fi

# 7. Check for hardcoded secrets
print_status "Scanning for hardcoded secrets..."
SECRET_PATTERNS=(
    "password\s*=\s*['\"][^'\"]*['\"]"
    "api[_-]?key\s*=\s*['\"][^'\"]*['\"]"
    "secret\s*=\s*['\"][^'\"]*['\"]"
    "token\s*=\s*['\"][^'\"]*['\"]"
    "private[_-]?key"
    "BEGIN RSA PRIVATE KEY"
    "BEGIN PRIVATE KEY"
)

SECRET_FOUND=false
for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -r -i -E "$pattern" src/ --exclude-dir=node_modules --exclude="*.test.ts" --exclude="*.spec.ts" > /dev/null 2>&1; then
        if [ "$SECRET_FOUND" = false ]; then
            print_error "Potential hardcoded secrets found:"
            SECRET_FOUND=true
        fi
        grep -r -i -E "$pattern" src/ --exclude-dir=node_modules --exclude="*.test.ts" --exclude="*.spec.ts" | head -5
    fi
done

if [ "$SECRET_FOUND" = false ]; then
    print_success "No hardcoded secrets detected"
fi

# 8. Check file permissions
print_status "Checking file permissions..."
SENSITIVE_FILES=(
    ".env"
    ".env.production"
    "config/production.json"
    "private.key"
    "server.key"
)

PERMISSION_ISSUES=false
for file in "${SENSITIVE_FILES[@]}"; do
    if [ -f "$file" ]; then
        PERMS=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%A" "$file" 2>/dev/null || echo "unknown")
        if [ "$PERMS" != "600" ] && [ "$PERMS" != "unknown" ]; then
            if [ "$PERMISSION_ISSUES" = false ]; then
                print_warning "File permission issues found:"
                PERMISSION_ISSUES=true
            fi
            echo "  $file has permissions $PERMS (should be 600)"
        fi
    fi
done

if [ "$PERMISSION_ISSUES" = false ]; then
    print_success "File permissions are secure"
fi

# 9. Check for TODO/FIXME security comments
print_status "Checking for security-related TODO/FIXME comments..."
if grep -r -i -E "(TODO|FIXME|HACK).*security" src/ --exclude-dir=node_modules > reports/security/security-todos.txt 2>&1; then
    print_warning "Security-related TODO/FIXME comments found - check reports/security/security-todos.txt"
else
    print_success "No security-related TODO/FIXME comments found"
fi

# 10. Generate Security Test Report
print_status "Generating security test report..."
cat > reports/security/security-test-report.md << EOF
# Security Test Report

Generated on: $(date)
Environment: $NODE_ENV

## Test Results Summary

### OWASP Top 10 Tests
- Status: ✅ Passed
- Coverage: See reports/security/owasp-coverage/

### Comprehensive Security Tests
- Status: ✅ Passed
- Coverage: See reports/security/comprehensive-coverage/

### Security Configuration Tests
- Status: ✅ Passed
- Coverage: See reports/security/config-coverage/

### Penetration Tests
- Status: ✅ Passed
- Coverage: See reports/security/penetration-coverage/

### NPM Security Audit
- Status: $([ -f reports/security/npm-audit.txt ] && echo "⚠️ Check npm-audit.txt" || echo "✅ Passed")

### Snyk Security Scan
- Status: $([ -f reports/security/snyk-report.json ] && echo "⚠️ Check snyk-report.json" || echo "⏭️ Skipped")

### Hardcoded Secrets Scan
- Status: $([ "$SECRET_FOUND" = true ] && echo "❌ Issues Found" || echo "✅ Clean")

### File Permissions Check
- Status: $([ "$PERMISSION_ISSUES" = true ] && echo "⚠️ Issues Found" || echo "✅ Secure")

### Security TODOs
- Status: $([ -s reports/security/security-todos.txt ] && echo "⚠️ TODOs Found" || echo "✅ Clean")

## Recommendations

1. Regularly update dependencies to patch security vulnerabilities
2. Implement automated security testing in CI/CD pipeline
3. Conduct periodic security audits and penetration testing
4. Monitor security logs and implement alerting
5. Keep security documentation up to date
6. Train development team on secure coding practices

## Next Steps

1. Address any vulnerabilities found in the scans
2. Implement additional security measures as needed
3. Schedule regular security reviews
4. Consider third-party security assessment

EOF

print_success "Security test report generated: reports/security/security-test-report.md"

# 11. Check overall test coverage
print_status "Checking overall security test coverage..."
if [ -d "reports/security/owasp-coverage" ]; then
    COVERAGE_PERCENT=$(grep -o '"pct":[0-9.]*' reports/security/owasp-coverage/coverage-summary.json | head -1 | cut -d':' -f2)
    if [ -n "$COVERAGE_PERCENT" ]; then
        if (( $(echo "$COVERAGE_PERCENT >= 80" | bc -l) )); then
            print_success "Security test coverage: ${COVERAGE_PERCENT}% (Good)"
        elif (( $(echo "$COVERAGE_PERCENT >= 60" | bc -l) )); then
            print_warning "Security test coverage: ${COVERAGE_PERCENT}% (Needs improvement)"
        else
            print_error "Security test coverage: ${COVERAGE_PERCENT}% (Poor)"
        fi
    fi
fi

echo ""
echo "=================================="
print_success "Security test suite completed!"
echo ""
print_status "Reports generated in: reports/security/"
print_status "Main report: reports/security/security-test-report.md"
echo ""

# Exit with error if critical issues found
if [ "$SECRET_FOUND" = true ]; then
    print_error "Critical security issues found - please address before deployment"
    exit 1
fi

print_success "All security tests passed! 🔒"