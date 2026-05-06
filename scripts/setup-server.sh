#!/bin/bash
# Setup script for Ubuntu server
# Run this after deploying the app to test.tadfoq.com

set -e

echo "=== Logistics Dashboard Server Setup ==="
echo "Domain: test.tadfoq.com"
echo ""

# 1. Install dependencies
echo "[1/6] Installing dependencies..."
sudo apt-get update
sudo apt-get install -y curl cron nodejs npm mysql-client

# 2. Copy health check script
echo "[2/6] Setting up health check script..."
sudo cp scripts/logistics-health-check.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/logistics-health-check.sh

# 3. Create log file
sudo touch /var/log/logistics-health-check.log
sudo chmod 666 /var/log/logistics-health-check.log

# 4. Add cron jobs
echo "[3/6] Adding cron jobs..."

# Backup current crontab
crontab -l > /tmp/crontab_backup 2>/dev/null || true

# Add new cron jobs
cat << 'CRON' | crontab -
# Logistics Dashboard - Health check every 5 minutes
*/5 * * * * /usr/local/bin/logistics-health-check.sh >> /var/log/logistics-cron.log 2>&1

# Logistics Dashboard - Process RFQ timeouts every 5 minutes
*/5 * * * * curl -s -X POST "https://test.tadfoq.com/api/v1/rfqs/process-timeouts" -H "Authorization: Bearer webhook-secret-2024" >> /var/log/logistics-cron.log 2>&1
CRON

echo "[4/6] Cron jobs installed:"
crontab -l | grep -E "logistics|tadfoq" || true

# 5. Test health check once
echo ""
echo "[5/6] Testing health check endpoint..."
if /usr/local/bin/logistics-health-check.sh; then
    echo "✓ Health check passed"
else
    echo "✗ Health check failed — check logs at /var/log/logistics-health-check.log"
fi

# 6. Show status
echo ""
echo "[6/6] Setup complete!"
echo ""
echo "Logs:"
echo "  Health check:  tail -f /var/log/logistics-health-check.log"
echo "  Cron output:   tail -f /var/log/logistics-cron.log"
echo ""
echo "Health endpoint: https://test.tadfoq.com/api/health"
echo ""
echo "To check status manually:"
echo "  curl https://test.tadfoq.com/api/health"
