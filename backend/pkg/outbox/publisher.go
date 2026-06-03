package outbox

import (
	"context"
	"encoding/json"
	"log"
	"time"

	pkgKafka "backend/pkg/kafka"

	"gorm.io/gorm"
)

type OutboxEvent struct {
	ID            string          `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	AggregateType string          `gorm:"type:varchar(100);not null" json:"aggregate_type"`
	AggregateID   string          `gorm:"type:varchar(255);not null" json:"aggregate_id"`
	EventType     string          `gorm:"type:varchar(100);not null" json:"event_type"`
	Payload       json.RawMessage `gorm:"type:jsonb;not null" json:"payload"`
	Published     bool            `gorm:"type:boolean;not null;default:false" json:"published"`
	CreatedAt     time.Time       `json:"created_at"`
}

type RelayWorker struct {
	db          *gorm.DB
	producer    *pkgKafka.Producer
	serviceName string
	tableName   string
	topicMap    map[string]string // Maps EventType to Kafka Topic
}

func NewRelayWorker(db *gorm.DB, producer *pkgKafka.Producer, serviceName string, tableName string, topicMap map[string]string) *RelayWorker {
	return &RelayWorker{
		db:          db,
		producer:    producer,
		serviceName: serviceName,
		tableName:   tableName,
		topicMap:    topicMap,
	}
}

func (w *RelayWorker) Start(ctx context.Context, interval time.Duration) {
	log.Printf("[%s Outbox Worker] Starting outbox relay loop every %v on table %s...", w.serviceName, interval, w.tableName)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Printf("[%s Outbox Worker] Stopping relay loop due to context cancel...", w.serviceName)
			return
		case <-ticker.C:
			w.processEvents(ctx)
		}
	}
}

func (w *RelayWorker) processEvents(ctx context.Context) {
	var events []OutboxEvent
	// Fetch a batch of unpublished events
	err := w.db.Table(w.tableName).
		Where("published = ?", false).
		Order("created_at asc").
		Limit(50).
		Find(&events).Error

	if err != nil {
		log.Printf("[%s Outbox Worker] Error fetching unpublished events from %s: %v", w.serviceName, w.tableName, err)
		return
	}

	if len(events) > 0 {
		log.Printf("[%s Outbox Worker] Found %d unpublished events in %s", w.serviceName, len(events), w.tableName)
	}

	for _, event := range events {
		topic, exists := w.topicMap[event.EventType]
		if !exists {
			log.Printf("[%s Outbox Worker] Unknown event type '%s' for event ID %s, skipping", w.serviceName, event.EventType, event.ID)
			continue
		}

		// Try to parse correlation_id from payload to propagate in headers if it exists
		headers := map[string]string{
			"X-Service-Origin": w.serviceName,
			"X-Event-ID":       event.ID,
		}
		var payloadMap map[string]interface{}
		if err := json.Unmarshal(event.Payload, &payloadMap); err == nil {
			if corrID, ok := payloadMap["correlation_id"].(string); ok {
				headers["X-Correlation-ID"] = corrID
			}
		}

		// Publish to Kafka
		err = pPublish(w.producer, ctx, topic, event.AggregateID, event.Payload, headers)
		if err != nil {
			log.Printf("[%s Outbox Worker] Failed to publish event %s to topic %s: %v", w.serviceName, event.ID, topic, err)
			continue
		}

		// Mark as published in DB
		err = w.db.Table(w.tableName).
			Where("id = ?", event.ID).
			Update("published", true).Error
		if err != nil {
			log.Printf("[%s Outbox Worker] Failed to mark event %s as published: %v", w.serviceName, event.ID, err)
		}
	}
}

// Helper to handle context or timeout for publish
func pPublish(producer *pkgKafka.Producer, ctx context.Context, topic string, key string, val []byte, headers map[string]string) error {
	pubCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return producer.Publish(pubCtx, topic, key, val, headers)
}
