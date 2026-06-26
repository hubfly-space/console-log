package consolelog

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestClientEnqueueAndFlush(t *testing.T) {
	var mu sync.Mutex
	var receivedEvents []Event

	// Setup local test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Stream-Key") != "test-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		bodyBytes, err := io.ReadAll(r.Body)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		var events []Event
		err = json.Unmarshal(bodyBytes, &events)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		mu.Lock()
		receivedEvents = append(receivedEvents, events...)
		mu.Unlock()

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"success":true}`))
	}))
	defer server.Close()

	client, err := NewClient(Config{
		StreamKey:     "test-key",
		Endpoint:      server.URL,
		BatchSize:     2,
		FlushInterval: 20 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	client.Log("info", "Hello from test log", map[string]any{"user_id": 123})
	client.Metric("test_metric", 4.5, map[string]any{"env": "test"})

	// Wait for background worker to flush
	time.Sleep(100 * time.Millisecond)

	client.Close()

	mu.Lock()
	defer mu.Unlock()

	if len(receivedEvents) != 2 {
		t.Fatalf("Expected 2 events, got %d", len(receivedEvents))
	}

	if receivedEvents[0].Message != "Hello from test log" || receivedEvents[0].Level != "info" {
		t.Errorf("Unexpected log event: %+v", receivedEvents[0])
	}

	if receivedEvents[1].Message != "test_metric" || receivedEvents[1].Type != "metric" {
		t.Errorf("Unexpected metric event: %+v", receivedEvents[1])
	}
}

func TestSlogHandlerIntegration(t *testing.T) {
	var mu sync.Mutex
	var receivedEvents []Event

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		bodyBytes, _ := io.ReadAll(r.Body)
		var events []Event
		json.Unmarshal(bodyBytes, &events)

		mu.Lock()
		receivedEvents = append(receivedEvents, events...)
		mu.Unlock()

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client, _ := NewClient(Config{
		StreamKey:     "test-key",
		Endpoint:      server.URL,
		BatchSize:     1,
		FlushInterval: 10 * time.Millisecond,
	})
	defer client.Close()

	handler := NewSlogHandler(client, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})
	logger := slog.New(handler)

	logger.Warn("Warning message test", slog.String("context", "slog"))

	time.Sleep(50 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()

	if len(receivedEvents) != 1 {
		t.Fatalf("Expected 1 event, got %d", len(receivedEvents))
	}

	if receivedEvents[0].Message != "Warning message test" || receivedEvents[0].Level != "warn" {
		t.Errorf("Unexpected event: %+v", receivedEvents[0])
	}
}

func TestMiddlewarePanicCapture(t *testing.T) {
	var mu sync.Mutex
	var receivedEvents []Event

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		bodyBytes, _ := io.ReadAll(r.Body)
		var events []Event
		json.Unmarshal(bodyBytes, &events)

		mu.Lock()
		receivedEvents = append(receivedEvents, events...)
		mu.Unlock()

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client, _ := NewClient(Config{
		StreamKey:     "test-key",
		Endpoint:      server.URL,
		BatchSize:     1,
		FlushInterval: 10 * time.Millisecond,
	})
	defer client.Close()

	panicHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("test panic")
	})

	mHandler := Middleware(client)(panicHandler)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test-panic", nil)

	mHandler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", rec.Code)
	}

	time.Sleep(50 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()

	// There should be two events: 1 metric event for the latency and 1 error event for the panic
	if len(receivedEvents) < 2 {
		t.Fatalf("Expected at least 2 events (error + metric), got %d", len(receivedEvents))
	}

	var hasPanicError = false
	var hasLatencyMetric = false

	for _, ev := range receivedEvents {
		if ev.Type == "error" && ev.Level == "fatal" {
			hasPanicError = true
		}
		if ev.Type == "metric" && ev.Message == "http.request.latency_ms" {
			hasLatencyMetric = true
		}
	}

	if !hasPanicError {
		t.Error("Expected panic error event to be sent")
	}
	if !hasLatencyMetric {
		t.Error("Expected latency metric event to be sent")
	}
}
