#!/usr/bin/env bash
# =============================================================================
# startup.sh — Container entrypoint script
# Runs Django migrations & static file collection, then hands off to supervisord
# =============================================================================
set -euo pipefail

echo "──────────────────────────────────────────────"
echo " Client Management System — Container Startup"
echo "──────────────────────────────────────────────"

# ── Working directory for Django management commands ──────────────────────────
cd /app/backend

# ── 1. Apply database migrations ──────────────────────────────────────────────
echo "[startup] Running database migrations..."
python manage.py migrate --noinput

# ── 2. Collect static files ───────────────────────────────────────────────────
echo "[startup] Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "[startup] Startup tasks complete. Launching supervisord..."

# ── 3. Hand off to supervisord (replaces this shell as PID 1) ─────────────────
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
