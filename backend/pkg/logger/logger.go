package logger

import (
	"log/slog"
	"os"
)

// InitJSONLogger initializes slog as a structured JSON logger writing to stdout
func InitJSONLogger(serviceName string) {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	logger := slog.New(handler).With("service", serviceName)
	slog.SetDefault(logger)
}
