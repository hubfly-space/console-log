# Go Starter Kit

[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat-square&logo=go)](https://go.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

A production-ready fullstack starter kit with **Go** backend and **React** frontend, compiled into a **single binary**. Zero external Go dependencies — stdlib only.

## Features

**Backend (Go)**
- HTTP server with graceful shutdown (SIGINT/SIGTERM)
- Middleware stack: request ID, structured logging, panic recovery, CORS, rate limiting, gzip compression, security headers
- `/healthz` — System health with metrics (memory, goroutines, uptime, GC)
- `/version` — Build info with git commit, branch, timestamp
- `/readyz` — Lightweight readiness probe
- **SQLite database** with WAL mode, auto-migrations, and production-tuned pragmas
- Environment-based configuration with sensible defaults
- Structured logging via `slog` (text/JSON formats)
- Frontend embedded via `go:embed` into the binary
- Pure Go SQLite driver (no CGO required)

**Frontend (React + Vite)**
- Modern dashboard showing real-time health & version
- Auto-refreshing system metrics (10s interval)
- Dark theme with Inter + JetBrains Mono typography
- Responsive design
- API proxy in development mode

**Build System (Makefile)**
- Single binary build with embedded frontend
- Auto-versioning from git tags
- Manual version override
- Multi-platform cross-compilation
- Docker support with multi-stage build

---

## Quick Start

### Prerequisites

- Go 1.22+
- Node.js 18+
- Make

### Development Mode

```bash
# Start both backend (port 8080) and frontend (port 5173)
make dev

# Or run them separately:
make dev-backend    # Go server on :8080
make dev-frontend   # Vite dev server on :5173 (proxies API to :8080)
```

### Build

```bash
# Build full binary (frontend + backend → single binary)
make build

# Build with specific version
make build VERSION=1.0.0

# Build backend only (no frontend)
make build-backend

# Build frontend only
make build-frontend

# Cross-compile for all platforms
make build-all-platforms
```

### Run

```bash
# Run the binary
./bin/go-starter-kit

# With custom configuration
SERVER_PORT=9090 APP_ENV=production LOG_FORMAT=json ./bin/go-starter-kit
```

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/healthz` | GET | Health check with system metrics |
| `/version` | GET | Build version and git info |
| `/readyz` | GET | Lightweight readiness probe |
| `/api/hello` | GET | Sample endpoint (`?name=World`) |

### Example Responses

**GET /healthz**
```json
{
  "status": "ok",
  "timestamp": "2026-05-14T20:09:54Z",
  "uptime": "7s",
  "system": {
    "go_version": "go1.25.3",
    "os": "linux",
    "arch": "amd64",
    "cpus": 8,
    "goroutines": 6,
    "mem_alloc_mb": 0.27,
    "mem_sys_mb": 8.21,
    "gc_cycles": 0
  },
  "stats": {
    "total_requests": 0
  }
}
```

**GET /version**
```json
{
  "version": "0.1.0",
  "git_commit": "ac25fd9",
  "git_branch": "master",
  "build_time": "2026-05-14T20:09:34Z",
  "go_version": "go1.25.3",
  "os": "linux",
  "arch": "amd64"
}
```

---

## Configuration

All configuration is via environment variables with sensible defaults:

| Variable | Default | Description |
|---|---|---|
| `SERVER_HOST` | `0.0.0.0` | Server bind host |
| `SERVER_PORT` | `8080` | Server port |
| `SERVER_READ_TIMEOUT` | `15s` | HTTP read timeout |
| `SERVER_WRITE_TIMEOUT` | `15s` | HTTP write timeout |
| `SERVER_IDLE_TIMEOUT` | `60s` | HTTP idle timeout |
| `SERVER_SHUTDOWN_TIMEOUT` | `30s` | Graceful shutdown timeout |
| `APP_NAME` | `go-starter-kit` | Application name |
| `APP_ENV` | `development` | Environment (development/staging/production) |
| `LOG_LEVEL` | `info` | Log level (debug/info/warn/error) |
| `LOG_FORMAT` | `text` | Log format (text/json) |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins |
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |
| `RATE_LIMIT_RPS` | `100` | Rate limit requests/second |
| `RATE_LIMIT_BURST` | `200` | Rate limit burst size |
| `COMPRESSION_ENABLED` | `true` | Enable gzip compression |
| `SERVE_FRONTEND` | `true` | Serve embedded frontend |
| `DB_PATH` | `data/app.db` | SQLite database file path (`:memory:` for in-memory) |
| `DB_BUSY_TIMEOUT` | `5000` | SQLite busy timeout in milliseconds |

---

## Makefile Targets

```bash
make help  # Show all available targets
```

| Target | Description |
|---|---|
| `build` | Build full binary (frontend + backend) |
| `build-backend` | Build backend only |
| `build-frontend` | Build frontend only |
| `build-all-platforms` | Cross-compile for linux/darwin/windows |
| `dev` | Run both servers in development mode |
| `dev-backend` | Run Go server with debug logging |
| `dev-frontend` | Run Vite dev server with HMR |
| `test` | Run all Go tests with race detector |
| `test-coverage` | Generate HTML coverage report |
| `lint` | Run go vet and staticcheck |
| `fmt` | Format Go source code |
| `release VERSION=x.y.z` | Create a tagged release |
| `version` | Display current version info |
| `docker` | Build Docker image |
| `docker-run` | Run the Docker container |
| `clean` | Remove all build artifacts |

---

## CI/CD (GitHub Actions)

This project includes fully configured GitHub Actions workflows for Continuous Integration and Releases.

### 1. Continuous Integration (`ci.yml`)
Triggered on `push` and `pull_request` to the `main` branch:
- **Backend Tests & Lint**: Runs `go vet`, `staticcheck`, and Go tests with the race detector enabled.
- **Frontend Build**: Installs npm dependencies and builds the Vite frontend.
- **Full Binary Build**: Combines the frontend and backend into a single binary artifact that can be downloaded from the run summary.

### 2. Automated Releases (`release.yml`)
Triggered automatically when pushing a semantic version tag (e.g., `v1.0.0`):
- **Cross-Compilation**: Builds combined binaries for Linux, macOS (Darwin), and Windows (`amd64` and `arm64`).
- **GitHub Release**: Creates a GitHub Release, generates notes, and attaches all compiled binaries.
- **Docker Image**: Builds and pushes a Docker image to GitHub Container Registry (GHCR) using the multi-stage Dockerfile.

---

## Versioning

The version is determined in this priority order:

1. **CLI override**: `make build VERSION=1.2.3`
2. **Git tag**: Latest `git describe --tags`
3. **VERSION file**: Content of `./VERSION`
4. **Fallback**: `"dev"`

### Creating a Release

```bash
# Create a tagged release
make release VERSION=1.0.0

# Push the tag
git push origin main --tags
```

---

## Project Structure

```
go-starter-kit/
├── cmd/server/
│   ├── main.go             # Entry point, logger setup, SPA routing
│   └── embed.go            # Build-tag gated frontend embedding
├── internal/
│   ├── config/config.go    # Env-based configuration
│   ├── database/
│   │   ├── database.go     # SQLite connection with WAL + production pragmas
│   │   ├── migrate.go      # Versioned migration runner
│   │   └── migrations.go   # Default schema (users, sessions, settings)
│   ├── handler/
│   │   ├── health.go       # /healthz endpoint
│   │   ├── version.go      # /version endpoint (ldflags injection)
│   │   └── api.go          # Sample API endpoints + /readyz
│   ├── middleware/
│   │   ├── chain.go        # Middleware chaining
│   │   ├── cors.go         # CORS handling
│   │   ├── logging.go      # Structured request logging
│   │   ├── recovery.go     # Panic recovery
│   │   ├── requestid.go    # X-Request-ID injection
│   │   ├── ratelimit.go    # Token bucket rate limiter
│   │   ├── compress.go     # Gzip compression
│   │   └── security.go     # Security headers
│   ├── router/router.go    # Route registration + middleware wiring
│   └── server/server.go    # HTTP server with graceful shutdown
├── data/                   # SQLite database files (gitignored)
├── web/                    # React frontend (Vite)
│   ├── src/
│   │   ├── App.tsx         # Main dashboard component
│   │   ├── api.ts          # API client
│   │   ├── hooks.ts        # Custom React hooks
│   │   └── components/     # UI components
│   ├── index.html
│   └── vite.config.ts
├── Makefile                # Build system
├── Dockerfile              # Multi-stage Docker build
├── VERSION                 # Current version
└── go.mod
```

---

## Docker

```bash
# Build image
make docker

# Run container
make docker-run

# Or manually:
docker build -t go-starter-kit .
docker run -p 8080:8080 go-starter-kit
```

---

## License

MIT
