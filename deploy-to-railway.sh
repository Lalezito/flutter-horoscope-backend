#!/bin/bash

# 🚂 Railway Deployment Script for Zodiac Backend
# This script helps automate the Railway deployment process

set -e  # Exit on any error

echo "🚂 Starting Railway Deployment Process..."
echo "════════════════════════════════════════"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

# Check if Railway CLI is installed
echo "Checking Railway CLI installation..."
if ! command -v railway &> /dev/null; then
    print_error "Railway CLI not found. Please install it first:"
    print_info "npm install -g @railway/cli"
    exit 1
fi
print_status "Railway CLI found"

# Check if logged in to Railway
echo "Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    print_warning "Not logged in to Railway. Please login:"
    print_info "railway login"
    echo "After logging in, run this script again."
    exit 1
fi

RAILWAY_USER=$(railway whoami)
print_status "Logged in as: $RAILWAY_USER"

# Check if already linked to a project
echo "Checking project link status..."
if railway status &> /dev/null; then
    PROJECT_INFO=$(railway status)
    print_status "Already linked to project"
    print_info "$PROJECT_INFO"
else
    print_warning "No project linked. You can:"
    print_info "1. railway init (create new project)"
    print_info "2. railway link (link to existing project)"
    echo "Please link to a project first, then run this script again."
    exit 1
fi

# Verify package.json exists
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the correct directory?"
    exit 1
fi

# Check if required files exist
print_info "Verifying deployment files..."

REQUIRED_FILES=("src/app.js" "migrations/001_create_weekly_horoscopes.sql" "railway.toml")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Required file missing: $file"
        exit 1
    fi
done
print_status "All required files present"

# Check environment variables that should be set
print_info "Environment variables to set in Railway dashboard:"
echo "════════════════════════════════════════════════════"
echo "🔑 OPENAI_API_KEY=sk-proj-... (REQUIRED for horoscope generation)"
echo "🔐 ADMIN_KEY=your_64_char_admin_key (REQUIRED for admin endpoints)" 
echo "🌍 NODE_ENV=production"
echo "⏰ TZ=America/New_York"
echo "⚡ ENABLE_CRON_JOBS=true"
echo "📊 ENABLE_MONITORING=true"
echo "🔗 WEBHOOK_ALERT_URL=https://hooks.slack.com/... (optional)"
echo "🌐 ALLOWED_ORIGINS=https://yourdomain.com (optional)"
echo "════════════════════════════════════════════════════"

# Ask user to confirm environment variables are set
echo ""
read -p "Have you set the required environment variables in Railway dashboard? (y/N): " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    print_warning "Please set the environment variables in Railway dashboard first"
    print_info "Go to your Railway project → Variables tab"
    exit 1
fi

# Check if PostgreSQL service is added
echo ""
read -p "Have you added PostgreSQL database service to your Railway project? (y/N): " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    print_warning "Please add PostgreSQL service in Railway dashboard first"
    print_info "Go to your Railway project → Add Service → Database → PostgreSQL"
    exit 1
fi

# Deploy to Railway
print_info "Starting deployment to Railway..."
echo "This may take a few minutes..."

if railway up; then
    print_status "Deployment successful!"
else
    print_error "Deployment failed!"
    exit 1
fi

# Get the app URL
print_info "Getting app URL..."
APP_URL=$(railway domain 2>/dev/null || echo "URL not available yet")

if [[ "$APP_URL" != "URL not available yet" ]]; then
    print_status "App deployed at: $APP_URL"
    
    # Wait a moment for the app to start
    print_info "Waiting 30 seconds for app to start..."
    sleep 30
    
    # Test health endpoint
    print_info "Testing health endpoint..."
    if curl -s "$APP_URL/health" | grep -q "healthy"; then
        print_status "Health endpoint responding correctly"
    else
        print_warning "Health endpoint not responding as expected"
        print_info "The app might still be starting up. Try again in a few minutes."
    fi
    
    # Instructions for next steps
    echo ""
    echo "🎯 Next Steps:"
    echo "════════════════════════════════════════════════════"
    echo "1. Run database migrations:"
    echo "   railway connect postgres"
    echo "   Then execute: \i migrations/001_create_weekly_horoscopes.sql"
    echo ""
    echo "2. Test OpenAI integration:"
    echo "   curl -X POST \"$APP_URL/api/generate/test?admin_key=YOUR_ADMIN_KEY\""
    echo ""
    echo "3. Generate initial horoscopes:"
    echo "   curl -X POST \"$APP_URL/api/generate/daily?admin_key=YOUR_ADMIN_KEY\""
    echo "   curl -X POST \"$APP_URL/api/generate/weekly?admin_key=YOUR_ADMIN_KEY\""
    echo ""
    echo "4. Verify API endpoints:"
    echo "   curl \"$APP_URL/api/docs\""
    echo "   curl \"$APP_URL/api/coaching/getAllHoroscopes?lang=es\""
    echo ""
    echo "📊 Monitoring URLs:"
    echo "   Health: $APP_URL/health"
    echo "   API Docs: $APP_URL/api/docs"
    echo "   Admin Panel: $APP_URL/api/admin/health?admin_key=YOUR_ADMIN_KEY"
    echo ""
    print_status "Deployment complete! Your zodiac backend is now running on Railway 🎉"
else
    print_warning "Could not get app URL. Check Railway dashboard for deployment status."
fi

echo ""
print_info "See RAILWAY_DEPLOYMENT_GUIDE.md for complete setup instructions"