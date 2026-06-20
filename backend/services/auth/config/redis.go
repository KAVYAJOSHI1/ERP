package config

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client
var Ctx = context.Background()

func ConnectRedis() {
	redisHost := os.Getenv("REDIS_HOST")
	redisPort := os.Getenv("REDIS_PORT")
	redisPassword := os.Getenv("REDIS_PASSWORD")

	if redisHost == "" {
		redisHost = "localhost"
	}
	if redisPort == "" {
		redisPort = "6375"
	}

	addr := fmt.Sprintf("%s:%s", redisHost, redisPort)
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: redisPassword,
		DB:       0,
	})

	var err error
	for i := 1; i <= 5; i++ {
		slog.Info("Connecting to Redis", "attempt", i, "address", addr)
		_, err = rdb.Ping(Ctx).Result()
		if err == nil {
			break
		}
		slog.Warn("Failed to connect to Redis, retrying...", "error", err, "attempt", i, "next_attempt_in", "2s")
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		slog.Error("Redis connection failed", "error", err)
		os.Exit(1)
	}

	slog.Info("Successfully connected to Redis", "address", addr)
	RedisClient = rdb
}
