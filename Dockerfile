# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/server apps/server

RUN npm ci

# Build the server
RUN npm run typecheck -w @asta/server

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/server apps/server

RUN npm ci --omit=dev

# Expose port (Fly.io uses 8080 by default, but we can override)
EXPOSE 8080

# Set environment variables for Fly.io
ENV PORT=8080
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/asta-legends.db

# Create data directory
RUN mkdir -p /data

# Start the server
CMD ["npm", "run", "start", "-w", "@asta/server"]
