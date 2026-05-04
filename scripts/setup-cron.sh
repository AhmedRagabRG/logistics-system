#!/bin/bash
# Cron setup script for Logistics Dashboard RFQ processing
# Run this script to add the cron job

APP_URL="https://cb30-88-214-57-76.ngrok-free.app"
AUTH_TOKEN="webhook-secret-2024"
CRON_LINE="*/5 * * * * curl -s -X POST \"$APP_URL/api/v1/rfqs/process-timeouts\" -H \"Authorization: Bearer $AUTH_TOKEN\" > /dev/null 2>&1"

echo "Setting up cron job for RFQ timeout processing..."
echo "App URL: $APP_URL"
echo "Interval: Every 5 minutes"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "api/v1/rfqs/process-timeouts"; then
    echo "Cron job already exists. Skipping."
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
    echo "Cron job added successfully!"
fi

echo ""
echo "Current cron jobs:"
crontab -l | grep -E "(api/v1/rfqs/process-timeouts|^$)" || true
