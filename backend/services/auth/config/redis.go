package config

import (
	"context"
	"fmt"
	"log"
	"os"

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

	_, err := rdb.Ping(Ctx).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	log.Printf("Successfully connected to Redis at %s", addr)
	RedisClient = rdb
}
