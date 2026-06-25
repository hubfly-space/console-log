# ============================================================================
# Multi-stage Dockerfile for Go Starter Kit
# ============================================================================

# --- Stage 1: Build frontend ---
FROM node:22-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci --silent
COPY web/ ./
RUN npm run build

# --- Stage 2: Build backend ---
FROM golang:1.25-alpine AS backend-builder

ARG VERSION=dev
ARG GIT_COMMIT=unknown

WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download || true

COPY . .
COPY --from=frontend-builder /app/web/dist ./cmd/server/web/dist

RUN CGO_ENABLED=0 GOOS=linux go build \
    -tags embed_frontend \
    -ldflags "-s -w \
        -X 'github.com/bonheur/go-starter-kit/internal/handler.Version=${VERSION}' \
        -X 'github.com/bonheur/go-starter-kit/internal/handler.GitCommit=${GIT_COMMIT}' \
        -X 'github.com/bonheur/go-starter-kit/internal/handler.BuildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)'" \
    -trimpath \
    -o /app/bin/server \
    ./cmd/server

# --- Stage 3: Production ---
FROM alpine:3.21 AS production

RUN apk --no-cache add ca-certificates tzdata && \
    adduser -D -g '' appuser

WORKDIR /app

COPY --from=backend-builder /app/bin/server ./server

# Create data directory for SQLite database.
RUN mkdir -p /app/data && chown appuser:appuser /app/data
VOLUME ["/app/data"]

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

ENTRYPOINT ["./server"]
