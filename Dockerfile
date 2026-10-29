# =============================================================================
# Dockerfile — Django + Next.js monolith on Render.com
# Architecture: Nginx (port 80) → Gunicorn (8000) | Next.js (3000)
# =============================================================================

# ─── Stage 1: Build Next.js ───────────────────────────────────────────────────
FROM node:20-slim AS node-builder

WORKDIR /app/frontend

# Install dependencies first (better layer caching)
COPY frontend/package*.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY frontend/ ./

# NEXT_PUBLIC_* vars are baked in at build time; pass them via --build-arg if needed
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ─── Stage 2: Final image ─────────────────────────────────────────────────────
FROM python:3.12-slim AS final

# Prevent Python from buffering stdout/stderr (important for container logs)
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # pip
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # app paths
    DJANGO_SETTINGS_MODULE=config.settings

# ── System packages: Node 20, Nginx, Supervisor ──────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        gnupg \
        ca-certificates \
        nginx \
        supervisor \
    # Node 20 via NodeSource
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    # Clean up apt caches to keep image lean
    && apt-get purge -y --auto-remove gnupg curl \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ───────────────────────────────────────────────────────
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Django source ─────────────────────────────────────────────────────────────
COPY backend/ .

# ── Next.js standalone output ─────────────────────────────────────────────────
# next build with output:'standalone' produces:
#   .next/standalone/  — self-contained Node server
#   .next/static/      — static assets
#   public/            — public assets
WORKDIR /app/frontend
COPY --from=node-builder /app/frontend/.next/standalone ./
COPY --from=node-builder /app/frontend/.next/static ./.next/static
# public/ may be empty but must exist for Next.js standalone server
COPY --from=node-builder /app/frontend/public ./public

# ── Nginx configuration ───────────────────────────────────────────────────────
COPY nginx.conf /etc/nginx/nginx.conf

# ── Supervisor configuration ──────────────────────────────────────────────────
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ── Startup script ────────────────────────────────────────────────────────────
COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

# Render expects the app to listen on $PORT (default 80 here)
EXPOSE 80

CMD ["/startup.sh"]
