package consolelog

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Event represents a single telemetry event sent to Console Log.
type Event struct {
	Type      string         `json:"type"`                // 'log', 'metric', 'error'
	Timestamp string         `json:"timestamp"`           // RFC3339 formatted string
	Level     string         `json:"level,omitempty"`     // debug, info, warn, error, fatal
	Message   string         `json:"message"`             // Main message or metric name
	Payload   map[string]any `json:"payload,omitempty"`   // Additional metadata
}

// Config holds setup parameters for the Console Log Client.
type Config struct {
	StreamKey     string
	Endpoint      string        // Defaults to http://localhost:8080
	BatchSize     int           // Defaults to 20
	FlushInterval time.Duration // Defaults to 2 * time.Second
	MaxQueueSize  int           // Defaults to 1000
	MaxRetries    int           // Defaults to 5
	RetryDelay    time.Duration // Defaults to 1 * time.Second
}

// Client is a thread-safe ingestion client that sends logs, metrics, and errors in batches.
type Client struct {
	cfg        Config
	queue      chan Event
	httpClient *http.Client
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
}

// NewClient instantiates a new Client and boots up the background worker.
func NewClient(cfg Config) (*Client, error) {
	if cfg.StreamKey == "" {
		return nil, errors.New("consolelog: StreamKey is required")
	}

	if cfg.Endpoint == "" {
		cfg.Endpoint = "http://localhost:8080"
	}
	// Strip trailing slash
	if len(cfg.Endpoint) > 0 && cfg.Endpoint[len(cfg.Endpoint)-1] == '/' {
		cfg.Endpoint = cfg.Endpoint[:len(cfg.Endpoint)-1]
	}

	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 20
	}
	if cfg.FlushInterval <= 0 {
		cfg.FlushInterval = 2 * time.Second
	}
	if cfg.MaxQueueSize <= 0 {
		cfg.MaxQueueSize = 1000
	}
	if cfg.MaxRetries <= 0 {
		cfg.MaxRetries = 5
	}
	if cfg.RetryDelay <= 0 {
		cfg.RetryDelay = 1 * time.Second
	}

	ctx, cancel := context.WithCancel(context.Background())

	c := &Client{
		cfg:   cfg,
		queue: make(chan Event, cfg.MaxQueueSize),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		ctx:    ctx,
		cancel: cancel,
	}

	c.wg.Add(1)
	go c.worker()

	return c, nil
}

// Enqueue pushes a telemetry event to the queue. If queue is full, the event is dropped.
func (c *Client) Enqueue(ev Event) {
	if ev.Timestamp == "" {
		ev.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	select {
	case c.queue <- ev:
	default:
		// Queue full, drop event to avoid blocking target application
	}
}

// Log enqueues a standard log message.
func (c *Client) Log(level, message string, payload map[string]any) {
	t := "log"
	if level == "error" || level == "fatal" {
		t = "error"
	}
	c.Enqueue(Event{
		Type:    t,
		Level:   level,
		Message: message,
		Payload: payload,
	})
}

// Metric enqueues a numerical measurement event.
func (c *Client) Metric(name string, value float64, payload map[string]any) {
	p := make(map[string]any)
	for k, v := range payload {
		p[k] = v
	}
	p["value"] = value

	c.Enqueue(Event{
		Type:    "metric",
		Message: name,
		Payload: p,
	})
}

// Close gracefully stops the worker, draining all remaining items in the queue.
func (c *Client) Close() error {
	c.cancel()
	close(c.queue)
	c.wg.Wait()
	return nil
}

// worker loops on events, batching and flushing them periodically.
func (c *Client) worker() {
	defer c.wg.Done()

	var batch []Event
	ticker := time.NewTicker(c.cfg.FlushInterval)
	defer ticker.Stop()

	flushBatch := func() {
		if len(batch) == 0 {
			return
		}
		err := c.sendBatch(batch)
		if err != nil {
			// In production, we log internally or just discard.
			// Since we want robust logging:
			fmt.Printf("[Console Log SDK] Failed to send telemetry batch: %v\n", err)
		}
		batch = nil
	}

	for {
		select {
		case ev, ok := <-c.queue:
			if !ok {
				// Queue closed, flush last items and exit
				flushBatch()
				return
			}
			batch = append(batch, ev)
			if len(batch) >= c.cfg.BatchSize {
				flushBatch()
			}
		case <-ticker.C:
			flushBatch()
		case <-c.ctx.Done():
			// Context canceled, pull whatever is remaining in queue
			for ev := range c.queue {
				batch = append(batch, ev)
				if len(batch) >= c.cfg.BatchSize {
					flushBatch()
				}
			}
			flushBatch()
			return
		}
	}
}

// sendBatch posts a list of events to the backend with backoff retry support.
func (c *Client) sendBatch(batch []Event) error {
	bodyBytes, err := json.Marshal(batch)
	if err != nil {
		return fmt.Errorf("marshal batch: %w", err)
	}

	endpoint := fmt.Sprintf("%s/api/v1/ingest", c.cfg.Endpoint)
	attempts := 0
	delay := c.cfg.RetryDelay

	for {
		attempts++
		req, err := http.NewRequestWithContext(c.ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
		if err != nil {
			return fmt.Errorf("create HTTP request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Stream-Key", c.cfg.StreamKey)

		resp, err := c.httpClient.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
			// If Bad Request (400), don't retry (invalid formatting/payload)
			if resp.StatusCode == http.StatusBadRequest {
				return fmt.Errorf("server rejected request with HTTP 400 (Bad Request)")
			}
			err = fmt.Errorf("HTTP status: %d", resp.StatusCode)
		}

		if attempts >= c.cfg.MaxRetries || c.ctx.Err() != nil {
			return fmt.Errorf("failed after %d attempts: %w", attempts, err)
		}

		// Exponential backoff wait
		select {
		case <-time.After(delay):
			delay *= 2
		case <-c.ctx.Done():
			return c.ctx.Err()
		}
	}
}
