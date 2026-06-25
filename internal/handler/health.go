// Package handler provides HTTP handlers for the API.
package handler

import (
	"encoding/json"
	"net/http"
	"runtime"
	"sync/atomic"
	"time"
)

// HealthHandler provides the /healthz endpoint.
type HealthHandler struct {
	startTime   time.Time
	requestCount atomic.Int64
}

// NewHealthHandler creates a new health handler.
func NewHealthHandler() *HealthHandler {
	return &HealthHandler{
		startTime: time.Now(),
	}
}

// IncrementRequests increments the total request counter.
// Call this from middleware or router to track request volume.
func (h *HealthHandler) IncrementRequests() {
	h.requestCount.Add(1)
}

// healthResponse is the JSON response for the health check endpoint.
type healthResponse struct {
	Status    string         `json:"status"`
	Timestamp string         `json:"timestamp"`
	Uptime    string         `json:"uptime"`
	System    systemInfo     `json:"system"`
	Stats     requestStats   `json:"stats"`
}

type systemInfo struct {
	Version      string `json:"version"`
	GoVersion    string `json:"go_version"`
	OS           string `json:"os"`
	Arch         string `json:"arch"`
	CPUs         int    `json:"cpus"`
	Goroutines   int    `json:"goroutines"`
	MemAllocMB   float64 `json:"mem_alloc_mb"`
	MemSysMB     float64 `json:"mem_sys_mb"`
	GCCycles     uint32 `json:"gc_cycles"`
}

type requestStats struct {
	TotalRequests int64 `json:"total_requests"`
}

// ServeHTTP handles GET /healthz requests.
func (h *HealthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	resp := healthResponse{
		Status:    "ok",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Uptime:    time.Since(h.startTime).Round(time.Second).String(),
		System: systemInfo{
			GoVersion:    runtime.Version(),
			OS:           runtime.GOOS,
			Arch:         runtime.GOARCH,
			CPUs:         runtime.NumCPU(),
			Goroutines:   runtime.NumGoroutine(),
			MemAllocMB:   float64(mem.Alloc) / 1024 / 1024,
			MemSysMB:     float64(mem.Sys) / 1024 / 1024,
			GCCycles:     mem.NumGC,
		},
		Stats: requestStats{
			TotalRequests: h.requestCount.Load(),
		},
	}

	writeJSON(w, http.StatusOK, resp)
}

// writeJSON writes a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(data)
}
