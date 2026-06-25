# ============================================================================
# Go Starter Kit — Makefile
# ============================================================================
# Usage:
#   make build              Build full binary (frontend + backend)
#   make build-backend      Build backend only
#   make build-frontend     Build frontend only
#   make dev                Run both in development mode
#   make dev-backend        Run backend in dev mode
#   make dev-frontend       Run frontend dev server
#   make test               Run all tests
#   make lint               Run linter
#   make clean              Remove build artifacts
#   make release VERSION=x  Create a tagged release
#   make docker             Build Docker image
#   make help               Show this help
# ============================================================================

# --- Configuration ---
APP_NAME     := go-starter-kit
CMD_DIR      := ./cmd/server
BIN_DIR      := ./bin
WEB_DIR      := ./web
VERSION_FILE := ./VERSION

# --- Version ---
# Priority: CLI override > git tag > VERSION file > "dev"
ifdef VERSION
	APP_VERSION := $(VERSION)
else
	GIT_TAG := $(shell git describe --tags --abbrev=0 2>/dev/null)
	ifdef GIT_TAG
		APP_VERSION := $(GIT_TAG)
	else
		APP_VERSION := $(shell cat $(VERSION_FILE) 2>/dev/null || echo "dev")
	endif
endif

# --- Build metadata ---
GIT_COMMIT  := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH  := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
BUILD_TIME  := $(shell date -u '+%Y-%m-%dT%H:%M:%SZ')
GO_VERSION  := $(shell go version | awk '{print $$3}')
BUILD_OS    := $(shell go env GOOS)
BUILD_ARCH  := $(shell go env GOARCH)

# --- Go build flags ---
PKG_PATH    := github.com/bonheur/go-starter-kit/internal/handler
LDFLAGS     := -s -w \
	-X '$(PKG_PATH).Version=$(APP_VERSION)' \
	-X '$(PKG_PATH).GitCommit=$(GIT_COMMIT)' \
	-X '$(PKG_PATH).GitBranch=$(GIT_BRANCH)' \
	-X '$(PKG_PATH).BuildTime=$(BUILD_TIME)' \
	-X '$(PKG_PATH).GoVersion=$(GO_VERSION)' \
	-X '$(PKG_PATH).BuildOS=$(BUILD_OS)' \
	-X '$(PKG_PATH).BuildArch=$(BUILD_ARCH)'

# --- Output binary ---
BINARY      := $(BIN_DIR)/$(APP_NAME)

# --- Colors ---
CYAN   := \033[36m
GREEN  := \033[32m
YELLOW := \033[33m
RED    := \033[31m
RESET  := \033[0m
BOLD   := \033[1m

# ============================================================================
# Default target
# ============================================================================
.DEFAULT_GOAL := help

# ============================================================================
# Build targets
# ============================================================================

## build: Build full binary with embedded frontend (default)
.PHONY: build
build: build-frontend build-full
	@echo "$(GREEN)[OK] Full build complete: $(BINARY) ($(APP_VERSION))$(RESET)"

## build-full: Build Go binary with embedded frontend (requires web/dist)
.PHONY: build-full
build-full:
	@echo "$(CYAN)> Building Go binary with embedded frontend...$(RESET)"
	@mkdir -p $(BIN_DIR)
	@mkdir -p $(CMD_DIR)/web
	@cp -r $(WEB_DIR)/dist $(CMD_DIR)/web/dist
	CGO_ENABLED=0 go build \
		-tags embed_frontend \
		-ldflags "$(LDFLAGS)" \
		-trimpath \
		-o $(BINARY) \
		$(CMD_DIR)
	@rm -rf $(CMD_DIR)/web
	@echo "$(GREEN)[OK] Binary built: $(BINARY)$(RESET)"
	@echo "  Version:  $(APP_VERSION)"
	@echo "  Commit:   $(GIT_COMMIT)"
	@echo "  Size:     $$(du -h $(BINARY) | cut -f1)"

## build-backend: Build backend only (no embedded frontend)
.PHONY: build-backend
build-backend:
	@echo "$(CYAN)> Building Go backend only...$(RESET)"
	@mkdir -p $(BIN_DIR)
	CGO_ENABLED=0 go build \
		-ldflags "$(LDFLAGS)" \
		-trimpath \
		-o $(BINARY) \
		$(CMD_DIR)
	@echo "$(GREEN)[OK] Backend built: $(BINARY) ($(APP_VERSION))$(RESET)"

## build-frontend: Build React frontend for production
.PHONY: build-frontend
build-frontend:
	@echo "$(CYAN)> Building React frontend...$(RESET)"
	@cd $(WEB_DIR) && npm install --silent && npm run build
	@echo "$(GREEN)[OK] Frontend built: $(WEB_DIR)/dist$(RESET)"

## build-all-platforms: Build for multiple platforms
.PHONY: build-all-platforms
build-all-platforms: build-frontend
	@echo "$(CYAN)> Building for all platforms...$(RESET)"
	@mkdir -p $(BIN_DIR)
	@for platform in "linux/amd64" "linux/arm64" "darwin/amd64" "darwin/arm64" "windows/amd64"; do \
		os=$$(echo $$platform | cut -d/ -f1); \
		arch=$$(echo $$platform | cut -d/ -f2); \
		ext=""; \
		if [ "$$os" = "windows" ]; then ext=".exe"; fi; \
		output="$(BIN_DIR)/$(APP_NAME)-$$os-$$arch$$ext"; \
		echo "  -> $$os/$$arch"; \
		cp -r $(WEB_DIR)/dist $(CMD_DIR)/web/dist; \
		GOOS=$$os GOARCH=$$arch CGO_ENABLED=0 go build \
			-tags embed_frontend \
			-ldflags "$(LDFLAGS)" \
			-trimpath \
			-o $$output \
			$(CMD_DIR); \
		rm -rf $(CMD_DIR)/web; \
	done
	@echo "$(GREEN)[OK] All platform builds complete$(RESET)"
	@ls -lh $(BIN_DIR)/

# ============================================================================
# Development targets
# ============================================================================

## dev: Run backend and frontend in development mode (parallel)
.PHONY: dev
dev:
	@echo "$(CYAN)> Starting development servers...$(RESET)"
	@echo "  Backend:  http://localhost:8080"
	@echo "  Frontend: http://localhost:5173"
	@$(MAKE) -j2 dev-backend dev-frontend

## dev-backend: Run Go backend with live reload (using go run)
.PHONY: dev-backend
dev-backend:
	@echo "$(CYAN)> Starting Go backend (dev mode)...$(RESET)"
	APP_ENV=development LOG_LEVEL=debug SERVE_FRONTEND=false go run \
		-ldflags "$(LDFLAGS)" \
		$(CMD_DIR)

## dev-frontend: Run Vite dev server with HMR
.PHONY: dev-frontend
dev-frontend:
	@echo "$(CYAN)> Starting Vite dev server...$(RESET)"
	@cd $(WEB_DIR) && npm run dev

# ============================================================================
# Testing & Quality
# ============================================================================

## test: Run all Go tests
.PHONY: test
test:
	@echo "$(CYAN)> Running tests...$(RESET)"
	go test -v -race -count=1 -coverprofile=coverage.out ./...
	@echo "$(GREEN)[OK] Tests passed$(RESET)"

## test-coverage: Run tests and open coverage report
.PHONY: test-coverage
test-coverage: test
	@echo "$(CYAN)> Generating coverage report...$(RESET)"
	go tool cover -html=coverage.out -o coverage.html
	@echo "$(GREEN)[OK] Coverage report: coverage.html$(RESET)"

## lint: Run Go vet and staticcheck
.PHONY: lint
lint:
	@echo "$(CYAN)> Running linter...$(RESET)"
	go vet ./...
	@if command -v staticcheck > /dev/null 2>&1; then \
		staticcheck ./...; \
	else \
		echo "$(YELLOW)[WARN] staticcheck not installed. Run: go install honnef.co/go/tools/cmd/staticcheck@latest$(RESET)"; \
	fi
	@echo "$(GREEN)[OK] Lint passed$(RESET)"

## fmt: Format Go source code
.PHONY: fmt
fmt:
	@echo "$(CYAN)> Formatting code...$(RESET)"
	go fmt ./...
	@echo "$(GREEN)[OK] Code formatted$(RESET)"

# ============================================================================
# Release
# ============================================================================

## release: Create a tagged release (use VERSION=x.y.z)
.PHONY: release
release:
ifndef VERSION
	@echo "$(RED)[ERR] VERSION is required. Usage: make release VERSION=1.0.0$(RESET)"
	@exit 1
endif
	@echo "$(CYAN)> Creating release v$(VERSION)...$(RESET)"
	@echo "$(VERSION)" > $(VERSION_FILE)
	@git add $(VERSION_FILE)
	@git commit -m "release: v$(VERSION)" || true
	@git tag -a "v$(VERSION)" -m "Release v$(VERSION)"
	@echo "$(GREEN)[OK] Release v$(VERSION) created$(RESET)"
	@echo "  Push with: git push origin main --tags"

## version: Display current version
.PHONY: version
version:
	@echo "$(BOLD)Version:$(RESET)  $(APP_VERSION)"
	@echo "$(BOLD)Commit:$(RESET)   $(GIT_COMMIT)"
	@echo "$(BOLD)Branch:$(RESET)   $(GIT_BRANCH)"
	@echo "$(BOLD)Built:$(RESET)    $(BUILD_TIME)"
	@echo "$(BOLD)Go:$(RESET)       $(GO_VERSION)"

# ============================================================================
# Docker
# ============================================================================

## docker: Build Docker image
.PHONY: docker
docker:
	@echo "$(CYAN)> Building Docker image...$(RESET)"
	docker build \
		--build-arg VERSION=$(APP_VERSION) \
		--build-arg GIT_COMMIT=$(GIT_COMMIT) \
		-t $(APP_NAME):$(APP_VERSION) \
		-t $(APP_NAME):latest \
		.
	@echo "$(GREEN)[OK] Docker image built: $(APP_NAME):$(APP_VERSION)$(RESET)"

## docker-run: Run the Docker container
.PHONY: docker-run
docker-run:
	docker run --rm -p 8080:8080 $(APP_NAME):latest

# ============================================================================
# Cleanup
# ============================================================================

## clean: Remove all build artifacts
.PHONY: clean
clean:
	@echo "$(CYAN)> Cleaning build artifacts...$(RESET)"
	@rm -rf $(BIN_DIR)
	@rm -rf $(WEB_DIR)/dist
	@rm -rf $(CMD_DIR)/web
	@rm -f coverage.out coverage.html
	@rm -f server
	@echo "$(GREEN)[OK] Clean$(RESET)"

# ============================================================================
# Help
# ============================================================================

## help: Show this help message
.PHONY: help
help:
	@echo ""
	@echo "$(BOLD)$(APP_NAME)$(RESET) - Fullstack Go + React Starter Kit"
	@echo ""
	@echo "$(BOLD)Usage:$(RESET)"
	@echo "  make $(CYAN)<target>$(RESET) [$(YELLOW)VARIABLE=value$(RESET)]"
	@echo ""
	@echo "$(BOLD)Targets:$(RESET)"
	@grep -E '^## ' $(MAKEFILE_LIST) | \
		sed -E 's/^## //' | \
		awk -F: '{printf "  $(CYAN)%-24s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(BOLD)Variables:$(RESET)"
	@echo "  $(YELLOW)VERSION$(RESET)                  Override version (e.g., make build VERSION=1.2.3)"
	@echo ""
	@echo "$(BOLD)Examples:$(RESET)"
	@echo "  make build               Build full binary (frontend + backend)"
	@echo "  make dev                 Start dev servers (backend + frontend)"
	@echo "  make build VERSION=2.0   Build with specific version"
	@echo "  make release VERSION=1.0 Create a git-tagged release"
	@echo ""
