#!/bin/bash

# Spotify API Deployment Script
# Supports deployment to development, staging, and production environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=""
VERSION=""
SKIP_TESTS=false
SKIP_BUILD=false
SKIP_MIGRATIONS=false
DRY_RUN=false
FORCE=false

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

# Function to show usage
show_usage() {
    cat << EOF
Spotify API Deployment Script

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENV    Target environment (development|staging|production)
    -v, --version VERSION    Version to deploy (default: current git commit)
    --skip-tests            Skip running tests
    --skip-build            Skip building the application
    --skip-migrations       Skip running database migrations
    --dry-run               Show what would be done without executing
    --force                 Force deployment even if checks fail
    -h, --help              Show this help message

Examples:
    $0 -e development
    $0 -e staging -v v1.2.3
    $0 -e production --skip-tests
    $0 -e staging --dry-run

Environment Requirements:
    development: Local Docker setup
    staging:     AWS ECS with staging configuration
    production:  AWS ECS with production configuration
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
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

# Validate required parameters
if [[ -z "$ENVIRONMENT" ]]; then
    print_error "Environment is required. Use -e or --environment"
    show_usage
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    print_error "Invalid environment. Must be: development, staging, or production"
    exit 1
fi

# Set version if not provided
if [[ -z "$VERSION" ]]; then
    VERSION=$(git rev-parse --short HEAD)
    print_status "Using current git commit as version: $VERSION"
fi

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Check git status for production deployments
if [[ "$ENVIRONMENT" == "production" && "$FORCE" != true ]]; then
    if [[ -n $(git status --porcelain) ]]; then
        print_error "Working directory is not clean. Commit or stash changes before production deployment."
        print_warning "Use --force to override this check."
        exit 1
    fi
    
    # Check if we're on main/master branch
    CURRENT_BRANCH=$(git branch --show-current)
    if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
        print_error "Production deployments must be from main/master branch. Current branch: $CURRENT_BRANCH"
        print_warning "Use --force to override this check."
        exit 1
    fi
fi

print_status "Starting deployment to $ENVIRONMENT environment"
print_status "Version: $VERSION"

# Function to run command with dry-run support
run_command() {
    local cmd="$1"
    local description="$2"
    
    print_status "$description"
    
    if [[ "$DRY_RUN" == true ]]; then
        print_warning "[DRY RUN] Would execute: $cmd"
    else
        eval "$cmd"
    fi
}

# Pre-deployment checks
print_status "Running pre-deployment checks..."

# Check Node.js version
NODE_VERSION=$(node --version)
print_status "Node.js version: $NODE_VERSION"

# Check if required environment file exists
ENV_FILE="config/environments/${ENVIRONMENT}.env"
if [[ ! -f "$ENV_FILE" ]]; then
    print_error "Environment file not found: $ENV_FILE"
    exit 1
fi

# Load environment variables
print_status "Loading environment configuration from $ENV_FILE"
if [[ "$DRY_RUN" != true ]]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Install dependencies
print_status "Installing dependencies..."
run_command "npm ci --production=false" "Installing Node.js dependencies"

# Run tests
if [[ "$SKIP_TESTS" != true ]]; then
    print_status "Running tests..."
    run_command "npm run test" "Running unit tests"
    run_command "npm run test:integration" "Running integration tests"
    
    if [[ "$ENVIRONMENT" != "development" ]]; then
        run_command "npm run test:e2e" "Running end-to-end tests"
    fi
else
    print_warning "Skipping tests (--skip-tests flag used)"
fi

# Security audit
print_status "Running security audit..."
run_command "npm audit --audit-level=high" "Checking for security vulnerabilities"

# Build application
if [[ "$SKIP_BUILD" != true ]]; then
    print_status "Building application..."
    run_command "npm run build" "Building TypeScript application"
    run_command "npm run build:docs" "Building API documentation"
else
    print_warning "Skipping build (--skip-build flag used)"
fi

# Environment-specific deployment
case "$ENVIRONMENT" in
    "development")
        print_status "Deploying to development environment..."
        
        # Stop existing containers
        run_command "docker-compose -f docker-compose.dev.yml down" "Stopping existing containers"
        
        # Build and start containers
        run_command "docker-compose -f docker-compose.dev.yml build --no-cache" "Building Docker images"
        run_command "docker-compose -f docker-compose.dev.yml up -d" "Starting containers"
        
        # Wait for services to be ready
        if [[ "$DRY_RUN" != true ]]; then
            print_status "Waiting for services to be ready..."
            sleep 10
        fi
        ;;
        
    "staging")
        print_status "Deploying to staging environment..."
        
        # Build and push Docker image
        IMAGE_TAG="spotify-api:${VERSION}"
        ECR_REPO="123456789012.dkr.ecr.us-east-1.amazonaws.com/spotify-api-staging"
        
        run_command "docker build -t $IMAGE_TAG ." "Building Docker image"
        run_command "docker tag $IMAGE_TAG $ECR_REPO:$VERSION" "Tagging image for ECR"
        run_command "docker tag $IMAGE_TAG $ECR_REPO:latest" "Tagging image as latest"
        
        # Push to ECR
        run_command "aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO" "Logging into ECR"
        run_command "docker push $ECR_REPO:$VERSION" "Pushing versioned image"
        run_command "docker push $ECR_REPO:latest" "Pushing latest image"
        
        # Update ECS service
        run_command "aws ecs update-service --cluster spotify-api-staging --service spotify-api-staging --force-new-deployment" "Updating ECS service"
        ;;
        
    "production")
        print_status "Deploying to production environment..."
        
        # Additional production checks
        if [[ "$FORCE" != true ]]; then
            print_status "Running additional production checks..."
            
            # Check if staging deployment is healthy
            print_status "Checking staging environment health..."
            if [[ "$DRY_RUN" != true ]]; then
                STAGING_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://staging-api.spotify-api.com/health || echo "000")
                if [[ "$STAGING_HEALTH" != "200" ]]; then
                    print_error "Staging environment is not healthy (HTTP $STAGING_HEALTH). Fix staging before production deployment."
                    exit 1
                fi
            fi
        fi
        
        # Build and push Docker image
        IMAGE_TAG="spotify-api:${VERSION}"
        ECR_REPO="123456789012.dkr.ecr.us-east-1.amazonaws.com/spotify-api-production"
        
        run_command "docker build -t $IMAGE_TAG ." "Building Docker image"
        run_command "docker tag $IMAGE_TAG $ECR_REPO:$VERSION" "Tagging image for ECR"
        
        # Push to ECR (no latest tag in production)
        run_command "aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO" "Logging into ECR"
        run_command "docker push $ECR_REPO:$VERSION" "Pushing production image"
        
        # Blue-green deployment
        print_status "Performing blue-green deployment..."
        run_command "aws ecs update-service --cluster spotify-api-production --service spotify-api-production --task-definition spotify-api-production:$VERSION" "Updating ECS service"
        
        # Wait for deployment to complete
        if [[ "$DRY_RUN" != true ]]; then
            print_status "Waiting for deployment to complete..."
            aws ecs wait services-stable --cluster spotify-api-production --services spotify-api-production
        fi
        ;;
esac

# Run database migrations
if [[ "$SKIP_MIGRATIONS" != true ]]; then
    print_status "Running database migrations..."
    
    case "$ENVIRONMENT" in
        "development")
            run_command "npm run db:migrate" "Running database migrations"
            ;;
        "staging"|"production")
            # Use migration job in ECS
            run_command "aws ecs run-task --cluster spotify-api-$ENVIRONMENT --task-definition spotify-api-migration-$ENVIRONMENT" "Running migration task"
            ;;
    esac
else
    print_warning "Skipping database migrations (--skip-migrations flag used)"
fi

# Health check
print_status "Performing health check..."

case "$ENVIRONMENT" in
    "development")
        HEALTH_URL="http://localhost:3000/api/health"
        ;;
    "staging")
        HEALTH_URL="https://staging-api.spotify-api.com/health"
        ;;
    "production")
        HEALTH_URL="https://api.spotify-api.com/health"
        ;;
esac

if [[ "$DRY_RUN" != true ]]; then
    # Wait a bit for the service to start
    sleep 30
    
    # Check health endpoint
    for i in {1..10}; do
        print_status "Health check attempt $i/10..."
        
        if curl -f -s "$HEALTH_URL" > /dev/null; then
            print_success "Health check passed!"
            break
        fi
        
        if [[ $i -eq 10 ]]; then
            print_error "Health check failed after 10 attempts"
            exit 1
        fi
        
        sleep 10
    done
else
    print_warning "[DRY RUN] Would check health at: $HEALTH_URL"
fi

# Post-deployment tasks
print_status "Running post-deployment tasks..."

# Clear CDN cache for production
if [[ "$ENVIRONMENT" == "production" && "$DRY_RUN" != true ]]; then
    print_status "Clearing CDN cache..."
    # Add CDN cache clearing commands here
    # aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"
fi

# Send deployment notification
if [[ "$DRY_RUN" != true ]]; then
    print_status "Sending deployment notification..."
    
    # Slack notification (if webhook URL is configured)
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 Spotify API deployed to $ENVIRONMENT (version: $VERSION)\"}" \
            "$SLACK_WEBHOOK_URL" || print_warning "Failed to send Slack notification"
    fi
    
    # Email notification could be added here
fi

# Cleanup
print_status "Cleaning up..."
run_command "docker system prune -f" "Cleaning up Docker images"

# Summary
print_success "Deployment to $ENVIRONMENT completed successfully!"
print_success "Version: $VERSION"
print_success "Health check URL: $HEALTH_URL"

if [[ "$ENVIRONMENT" == "production" ]]; then
    print_success "🎉 Production deployment completed! 🎉"
    print_status "Don't forget to:"
    print_status "  1. Monitor application metrics"
    print_status "  2. Check error logs"
    print_status "  3. Verify critical user flows"
    print_status "  4. Update release notes"
fi

exit 0