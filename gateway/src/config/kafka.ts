import { Kafka, Producer } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'erp-gateway',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

export const kafkaClient: Producer = kafka.producer();

export async function connectKafka(): Promise<void> {
  await kafkaClient.connect();
  console.log('Kafka producer connected');
}

export async function disconnectKafka(): Promise<void> {
  await kafkaClient.disconnect();
}
