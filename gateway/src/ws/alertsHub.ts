import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import jwt from 'jsonwebtoken';
import { Kafka } from 'kafkajs';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';

export interface AlertMessage {
  type: string;
  pallet_id: string;
  sensor_id: string;
  location: string;
  temperature_c: number;
  detected_at: string;
}

const clients = new Set<WebSocket>();

export function broadcast(data: AlertMessage): void {
  const payload = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function extractToken(req: IncomingMessage): string | null {
  try {
    const url = new URL(req.url || '', 'http://localhost');
    return url.searchParams.get('token');
  } catch {
    return null;
  }
}

export function initAlertsHub(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws/alerts' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const token = extractToken(req);
    if (!token) {
      ws.close(4001, 'Unauthorized: missing token');
      return;
    }
    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      ws.close(4001, 'Unauthorized: invalid token');
      return;
    }
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });

  const kafka = new Kafka({
    clientId: 'erp-gateway-ws',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  });
  const consumer = kafka.consumer({ groupId: 'gateway-alerts-ws' });

  (async () => {
    await consumer.connect();
    await consumer.subscribe({ topic: 'inventory.alerts.critical', fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const alert: AlertMessage = JSON.parse(message.value.toString());
          broadcast(alert);
        } catch (e) {
          console.error('[AlertsHub] Failed to parse alert message:', e);
        }
      },
    });
    console.log('[AlertsHub] Listening on inventory.alerts.critical');
  })().catch((err) => console.error('[AlertsHub] Kafka consumer error:', err));
}
