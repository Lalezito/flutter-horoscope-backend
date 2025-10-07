#!/bin/bash

set -e

ROLLBACK_TARGET="${1:-previous}"
BACKUP_DIR="/tmp/zodiac-backups"
RAILWAY_PROJECT_ID="${RAILWAY_PROJECT_ID:-}"
CURRENT_VERSION=$(date +%Y%m%d-%H%M%S)

echo "🔄 Initiating rollback to: $ROLLBACK_TARGET"
echo "Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "=========================================="

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup current state
backup_current_state() {
    echo "💾 Backing up current state..."
    
    # Create timestamp for backup
    BACKUP_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    
    # Git backup
    if [ -d ".git" ]; then
        echo "📝 Creating git tag for current state..."
        git tag "backup-before-rollback-$BACKUP_TIMESTAMP" || echo "⚠️  Git tag creation failed"
    fi
    
    # Configuration backup
    echo "⚙️  Backing up configuration files..."
    cp -r . "$BACKUP_DIR/app-backup-$BACKUP_TIMESTAMP" || echo "⚠️  File backup failed"
    
    # Environment variables backup
    if command -v railway &> /dev/null && [ -n "$RAILWAY_PROJECT_ID" ]; then
        echo "🌍 Backing up environment variables..."
        railway variables > "$BACKUP_DIR/env-backup-$BACKUP_TIMESTAMP.txt" 2>/dev/null || echo "⚠️  Environment backup failed"
    fi
    
    echo "✅ Current state backed up to $BACKUP_DIR"
}

# Database migration rollback
rollback_database() {
    echo "🗃️  Rolling back database migrations..."
    
    case $ROLLBACK_TARGET in
        "previous")
            echo "Rolling back to previous migration..."
            if [ -f "package.json" ] && grep -q "migrate:rollback" package.json; then
                npm run migrate:rollback || echo "⚠️  Database rollback script failed"
            else
                echo "⚠️  No database rollback script found"
            fi
            ;;
        "specific")
            if [ -n "$2" ]; then
                echo "Rolling back to specific migration: $2"
                npm run migrate:rollback -- --to="$2" || echo "⚠️  Specific migration rollback failed"
            else
                echo "⚠️  No specific migration target provided"
            fi
            ;;
        *)
            echo "⚠️  Unknown rollback target: $ROLLBACK_TARGET"
            ;;
    esac
    
    echo "✅ Database rollback completed"
}

# Application rollback
rollback_application() {
    echo "🚀 Rolling back application..."
    
    if [ -d ".git" ]; then
        # Get previous deployment commit
        PREVIOUS_COMMIT=$(git log --oneline -n 2 --format="%H" | tail -1)
        
        if [ -n "$PREVIOUS_COMMIT" ]; then
            echo "📍 Rolling back to commit: $PREVIOUS_COMMIT"
            git checkout $PREVIOUS_COMMIT || echo "⚠️  Git checkout failed"
        else
            echo "⚠️  Could not determine previous commit"
        fi
    fi
    
    # Deploy previous version using Railway CLI
    if command -v railway &> /dev/null && [ -n "$RAILWAY_PROJECT_ID" ]; then
        echo "🚂 Deploying previous version to Railway..."
        railway up --detach || echo "⚠️  Railway deployment failed"
    else
        echo "⚠️  Railway CLI not available or project ID not set"
    fi
    
    echo "✅ Application rollback completed"
}

# Health validation after rollback
validate_rollback() {
    echo "🔍 Validating rollback..."
    
    echo "⏳ Waiting 30 seconds for deployment to stabilize..."
    sleep 30
    
    # Check if validation script exists
    if [ -f "./scripts/validate-deployment.sh" ]; then
        echo "🧪 Running validation script..."
        if ./scripts/validate-deployment.sh; then
            echo "✅ Rollback validation successful"
            return 0
        else
            echo "❌ Rollback validation failed"
            return 1
        fi
    else
        echo "⚠️  Validation script not found, performing basic checks..."
        
        # Basic health check
        if command -v curl &> /dev/null; then
            HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "https://api.zodiaclifecoach.app/health" || echo "000")
            if [ "$HEALTH_CHECK" = "200" ]; then
                echo "✅ Basic health check passed"
                return 0
            else
                echo "❌ Basic health check failed (HTTP $HEALTH_CHECK)"
                return 1
            fi
        else
            echo "⚠️  No curl available for health check"
            return 0
        fi
    fi
}

# Notification system
send_notification() {
    local status="$1"
    local message="$2"
    
    echo "📢 Sending notification: $status"
    
    # Slack notification (if webhook URL is set)
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"🔄 Zodiac App rollback $status: $message\"}" \
            || echo "⚠️  Slack notification failed"
    fi
    
    # Discord notification (if webhook URL is set)
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        curl -X POST "$DISCORD_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            --data "{\"content\":\"🔄 Zodiac App rollback $status: $message\"}" \
            || echo "⚠️  Discord notification failed"
    fi
    
    # Email notification (if configured)
    if command -v mail &> /dev/null && [ -n "$NOTIFICATION_EMAIL" ]; then
        echo "Zodiac App rollback $status: $message" | mail -s "Rollback Notification" "$NOTIFICATION_EMAIL" \
            || echo "⚠️  Email notification failed"
    fi
}

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    
    # Remove temporary files
    find /tmp -name "zodiac-rollback-*" -mtime +7 -exec rm -f {} \; 2>/dev/null || true
    
    # Clean up old backups (keep last 10)
    if [ -d "$BACKUP_DIR" ]; then
        cd "$BACKUP_DIR"
        ls -t app-backup-* 2>/dev/null | tail -n +11 | xargs rm -rf 2>/dev/null || true
        ls -t env-backup-* 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
        cd - > /dev/null
    fi
    
    echo "✅ Cleanup completed"
}

# Signal handlers
trap cleanup EXIT
trap 'echo "❌ Rollback interrupted"; exit 1' INT TERM

# Main execution
echo "🚀 Starting rollback process..."

# Pre-rollback checks
if [ "$ROLLBACK_TARGET" = "previous" ] && [ ! -d ".git" ]; then
    echo "❌ Git repository not found - cannot rollback to previous version"
    exit 1
fi

# Execute rollback sequence
echo "📋 Rollback sequence:"
echo "1. Backup current state"
echo "2. Rollback database"
echo "3. Rollback application"
echo "4. Validate rollback"
echo "5. Send notifications"
echo ""

if backup_current_state && rollback_database && rollback_application; then
    echo ""
    echo "🔄 Rollback deployment completed, validating..."
    
    if validate_rollback; then
        echo "✅ Rollback completed successfully"
        send_notification "SUCCESSFUL" "Rollback to $ROLLBACK_TARGET completed successfully at $(date -u)"
        
        echo ""
        echo "=========================================="
        echo "✅ ROLLBACK SUCCESSFUL"
        echo "Target: $ROLLBACK_TARGET"
        echo "Completed: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
        echo "Backup location: $BACKUP_DIR"
        echo "=========================================="
        exit 0
    else
        echo "❌ Rollback validation failed - Manual intervention required"
        send_notification "FAILED VALIDATION" "Rollback completed but validation failed - manual check required"
        exit 1
    fi
else
    echo "❌ Rollback process failed"
    send_notification "FAILED" "Rollback process failed - immediate attention required"
    exit 1
fi