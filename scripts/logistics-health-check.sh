#!/bin/bash
# Logistics Dashboard Health Check Cron Script
# Place at: /usr/local/bin/logistics-health-check.sh
# Logs to: /var/log/logistics-health-check.log

APP_URL="${APP_URL:-https://test.tadfoq.com}"
HEALTH_ENDPOINT="${APP_URL}/api/health"
LOG_FILE="${LOG_FILE:-/var/log/logistics-health-check.log}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
MAX_RETRIES=3
RETRY_DELAY=5

# Create log file
sudo touch "$LOG_FILE" 2>/dev/null || touch "$LOG_FILE"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_health() {
    local attempt=$1
    local response
    local http_code
    local body

    response=$(curl -s -w "\n%{http_code}" --max-time 15 "$HEALTH_ENDPOINT" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        log "OK (attempt $attempt) — $HEALTH_ENDPOINT"
        log "  Response: $body"
        return 0
    else
        log "FAIL (attempt $attempt) — HTTP $http_code — $HEALTH_ENDPOINT"
        log "  Response: $body"
        return 1
    fi
}

log "--- Health check started ---"

success=false
for i in $(seq 1 $MAX_RETRIES); do
    if check_health "$i"; then
        success=true
        break
    fi

    if [ "$i" -lt "$MAX_RETRIES" ]; then
        log "  Retrying in ${RETRY_DELAY}s..."
        sleep "$RETRY_DELAY"
    fi
done

if [ "$success" = false ]; then
    log "CRITICAL: Health check failed after $MAX_RETRIES attempts"

    if [ -n "$ALERT_EMAIL" ]; then
        echo "test.tadfoq.com health check failed after $MAX_RETRIES attempts. Check $LOG_FILE." | \
            mail -s "[ALERT] test.tadfoq.com is DOWN" "$ALERT_EMAIL" 2>/dev/null || true
    fi

    exit 1
fi

log "--- Health check completed ---"
exit 0
