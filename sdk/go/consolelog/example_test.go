package consolelog_test

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/bonheur/go-starter-kit/sdk/go/consolelog"
)

// Example demonstrates how to set up the Console Log client, register the slog handler,
// and wrap HTTP servers with telemetry middleware.
func Example() {
	// 1. Initialize the Console Log client
	streamKey := os.Getenv("CONSOLE_LOG_STREAM_KEY")
	if streamKey == "" {
		streamKey = "demo-stream-key"
	}

	client, err := consolelog.NewClient(consolelog.Config{
		StreamKey:     streamKey,
		Endpoint:      "http://localhost:8080",
		BatchSize:     5,
		FlushInterval: 1 * time.Second,
	})
	if err != nil {
		fmt.Printf("Failed to create client: %v\n", err)
		return
	}
	defer client.Close()

	// 2. Configure slog to direct all output to Console Log
	handler := consolelog.NewSlogHandler(client, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})
	logger := slog.New(handler)
	slog.SetDefault(logger)

	// 3. Log using the standard slog library
	slog.Info("Service has started up", slog.String("env", "production"))
	slog.Warn("Cache missing rate is high", slog.Float64("rate", 85.2))
	slog.Error("Database connection drop-off encountered", slog.String("db", "users_replica"))

	// 4. Track custom metrics directly
	client.Metric("job.execution_time_sec", 4.12, map[string]any{
		"job_name": "daily_billing_sync",
	})

	// 5. Wrap HTTP servers
	mux := http.NewServeMux()
	mux.HandleFunc("/api/hello", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"message":"hello world"}`))
	})
	mux.HandleFunc("/api/panic", func(w http.ResponseWriter, r *http.Request) {
		panic("simulated fatal panic")
	})

	// Apply instrumentation middleware
	instrumentedHandler := consolelog.Middleware(client)(mux)

	// In a real application, you would serve this:
	// _ = http.ListenAndServe(":3000", instrumentedHandler)
	_ = instrumentedHandler
}
