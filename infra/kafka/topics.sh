#!/bin/bash

# Wait for Kafka to be ready
echo "Waiting for Kafka to be ready..."
until docker exec erp-kafka kafka-topics --bootstrap-server localhost:9092 --list &>/dev/null; do
  echo "Kafka is not ready yet, retrying in 2 seconds..."
  sleep 2
done

echo "Kafka is ready! Creating topics..."

# Create topics
topics=(
  "erp.inventory.stock-updated"
  "erp.procurement.po-created"
  "erp.production.started"
  "erp.production.completed"
  "erp.finance.invoice-generated"
  "erp.intelligence.reorder-recommended"
  "erp.audit.all-events"
)

for topic in "${topics[@]}"; do
  echo "Creating topic: $topic"
  docker exec erp-kafka kafka-topics --bootstrap-server localhost:9092 \
    --create --topic "$topic" \
    --partitions 1 \
    --replication-factor 1 \
    --if-not-exists
done

echo "All topics created successfully!"
