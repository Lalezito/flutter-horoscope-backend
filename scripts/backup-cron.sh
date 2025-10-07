#!/bin/bash

# Backup Cron Execution Script
# This script is called by cron to execute backup operations

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-system.js"
LOG_FILE="/var/log/backup-system.log"
LOCK_FILE="/tmp/backup-system.lock"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function to send alert
send_alert() {
    local level="$1"
    local message="$2"
    
    if [ -n "${WEBHOOK_ALERT_URL:-}" ]; then
        curl -X POST "$WEBHOOK_ALERT_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🛡️ Backup Cron Alert: $message\", \"level\":\"$level\", \"timestamp\":\"$(date -Iseconds)\"}" \
            2>/dev/null || log "Failed to send alert"
    fi
}

# Function to acquire lock
acquire_lock() {
    local operation="$1"
    local lock_file="${LOCK_FILE}.${operation}"
    
    if [ -f "$lock_file" ]; then
        local pid=$(cat "$lock_file")
        if kill -0 "$pid" 2>/dev/null; then
            log "Backup operation $operation is already running (PID: $pid)"
            exit 1
        else
            log "Removing stale lock file for operation $operation"
            rm -f "$lock_file"
        fi
    fi
    
    echo $$ > "$lock_file"
}

# Function to release lock
release_lock() {
    local operation="$1"
    local lock_file="${LOCK_FILE}.${operation}"
    rm -f "$lock_file"
}

# Cleanup function
cleanup() {
    release_lock "$OPERATION"
}

# Trap to ensure cleanup
trap cleanup EXIT INT TERM

# Main execution
main() {
    OPERATION="${1:-status}"
    
    log "Starting backup operation: $OPERATION"
    
    # Acquire lock
    acquire_lock "$OPERATION"
    
    # Validate required environment variables
    if [ -z "${DATABASE_URL:-}" ]; then
        log "ERROR: DATABASE_URL environment variable is not set"
        send_alert "error" "DATABASE_URL not configured for backup operation"
        exit 1
    fi
    
    # Execute backup operation
    case "$OPERATION" in
        "full")
            log "Executing full backup..."
            if node "$BACKUP_SCRIPT" full 2>&1 | tee -a "$LOG_FILE"; then
                log "Full backup completed successfully"
                send_alert "info" "Full backup completed successfully"
            else
                log "Full backup failed"
                send_alert "error" "Full backup operation failed"
                exit 1
            fi
            ;;
            
        "incremental")
            log "Executing incremental backup..."
            if node "$BACKUP_SCRIPT" incremental 2>&1 | tee -a "$LOG_FILE"; then
                log "Incremental backup completed successfully"
            else
                log "Incremental backup failed"
                send_alert "error" "Incremental backup operation failed"
                exit 1
            fi
            ;;
            
        "test")
            log "Executing backup testing..."
            if node "$BACKUP_SCRIPT" test 2>&1 | tee -a "$LOG_FILE"; then
                log "Backup testing completed successfully"
                send_alert "info" "Backup testing passed - All systems operational"
            else
                log "Backup testing failed"
                send_alert "error" "Backup testing FAILED - Immediate attention required"
                exit 1
            fi
            ;;
            
        "retention")
            log "Executing retention policy enforcement..."
            if node "$BACKUP_SCRIPT" retention 2>&1 | tee -a "$LOG_FILE"; then
                log "Retention policy enforcement completed successfully"
            else
                log "Retention policy enforcement failed"
                send_alert "warning" "Retention policy enforcement failed"
                exit 1
            fi
            ;;
            
        "status")
            log "Checking backup system status..."
            node "$BACKUP_SCRIPT" status 2>&1 | tee -a "$LOG_FILE"
            ;;
            
        *)
            log "Invalid operation: $OPERATION"
            echo "Usage: $0 {full|incremental|test|retention|status}"
            exit 1
            ;;
    esac
    
    log "Backup operation $OPERATION completed"
}

# Create log file if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

# Execute main function
main "$@"