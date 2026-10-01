# ==============================================================================
# Multi-Stage Production Dockerfile for QRDine SaaS
# Optimized for minimum image size, maximum security, and high performance
# ==============================================================================

# Stage 1: Build Frontend and Backend
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy all source files
COPY . .

# Build Vite client SPA and bundle Express TypeScript server
RUN npm run build

# ==============================================================================
# Stage 2: Minimal Production Runtime
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment flags
ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only (no dev dependencies or build tools)
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy compiled bundles and static assets from builder stage
COPY --from=builder /app/dist ./dist

# Switch to standard non-root node user for container security
USER node

# Expose default HTTP port
EXPOSE 3000

# Container Health Check (used by Docker, Kubernetes, AWS ECS, GCP Cloud Run)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Start the compiled ESM production server
CMD ["node", "dist/server.js"]
