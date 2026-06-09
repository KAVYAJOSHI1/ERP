import { Router, Request, Response } from 'express';
import { kafkaClient } from '../config/kafka';

const router = Router();

interface TelemetryPayload {
  sensor_id: string;
  pallet_id: string;
  location?: string;
  temperature_c: number;
  timestamp?: string;
}

router.post('/telemetry', async (req: Request, res: Response) => {
  const { sensor_id, pallet_id, temperature_c }: TelemetryPayload = req.body;

  if (!sensor_id || !pallet_id || temperature_c === undefined) {
    res.status(400).json({ error: 'sensor_id, pallet_id, and temperature_c are required' });
    return;
  }

  const message = {
    key: pallet_id,
    value: JSON.stringify({
      ...req.body,
      ingested_at: new Date().toISOString(),
    }),
  };

  // Fire-and-forget: publish to Kafka without blocking the response
  kafkaClient
    .send({ topic: 'iot.telemetry.battery', messages: [message] })
    .catch((err: Error) => console.error('Kafka publish error:', err));

  res.status(202).send();
});

export default router;
