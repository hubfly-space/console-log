package consolelog

import (
	"context"
	"log/slog"
	"time"
)

// SlogHandler is a custom slog.Handler that routes logs to Console Log.
type SlogHandler struct {
	client *Client
	opts   slog.HandlerOptions
	attrs  []slog.Attr
	groups []string
}

// NewSlogHandler initializes a new slog.Handler using the Console Log Client.
func NewSlogHandler(client *Client, opts *slog.HandlerOptions) *SlogHandler {
	handlerOpts := slog.HandlerOptions{
		Level: slog.LevelInfo,
	}
	if opts != nil {
		handlerOpts = *opts
	}
	return &SlogHandler{
		client: client,
		opts:   handlerOpts,
	}
}

// Enabled returns true if the log level is configured to be active.
func (h *SlogHandler) Enabled(ctx context.Context, lvl slog.Level) bool {
	minLvl := slog.LevelInfo
	if h.opts.Level != nil {
		minLvl = h.opts.Level.Level()
	}
	return lvl >= minLvl
}

// Handle serializes the log record and enqueues it via the Client.
func (h *SlogHandler) Handle(ctx context.Context, r slog.Record) error {
	payload := make(map[string]any)

	// Append contextual attributes
	r.Attrs(func(a slog.Attr) bool {
		h.addAttrToMap(payload, a)
		return true
	})

	// Add attributes attached via WithAttrs
	for _, a := range h.attrs {
		h.addAttrToMap(payload, a)
	}

	// Record metadata
	if r.PC != 0 && h.opts.AddSource {
		// If caller details are requested
		payload["source"] = slog.Source{
			Function: "",
			File:     "",
			Line:     0,
		}
	}

	// Map level
	levelStr := "info"
	switch {
	case r.Level < slog.LevelInfo:
		levelStr = "debug"
	case r.Level < slog.LevelWarn:
		levelStr = "info"
	case r.Level < slog.LevelError:
		levelStr = "warn"
	default:
		levelStr = "error"
	}

	event := Event{
		Type:      "log",
		Timestamp: r.Time.UTC().Format(time.RFC3339),
		Level:     levelStr,
		Message:   r.Message,
		Payload:   payload,
	}

	// Route errors to 'error' event type instead of standard log
	if levelStr == "error" {
		event.Type = "error"
	}

	h.client.Enqueue(event)
	return nil
}

// WithAttrs returns a new SlogHandler with the given attributes pre-applied.
func (h *SlogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	if len(attrs) == 0 {
		return h
	}
	newAttrs := append([]slog.Attr{}, h.attrs...)
	newAttrs = append(newAttrs, attrs...)
	return &SlogHandler{
		client: h.client,
		opts:   h.opts,
		attrs:  newAttrs,
		groups: h.groups,
	}
}

// WithGroup returns a new SlogHandler with the given group name.
func (h *SlogHandler) WithGroup(name string) slog.Handler {
	if name == "" {
		return h
	}
	return &SlogHandler{
		client: h.client,
		opts:   h.opts,
		attrs:  h.attrs,
		groups: append(h.groups, name),
	}
}

// Helper to safely marshal slog.Value types into a map.
func (h *SlogHandler) addAttrToMap(m map[string]any, a slog.Attr) {
	if a.Key == "" {
		return
	}
	
	switch a.Value.Kind() {
	case slog.KindGroup:
		groupAttrs := a.Value.Group()
		groupMap := make(map[string]any)
		for _, ga := range groupAttrs {
			h.addAttrToMap(groupMap, ga)
		}
		m[a.Key] = groupMap
	default:
		m[a.Key] = a.Value.Any()
	}
}
