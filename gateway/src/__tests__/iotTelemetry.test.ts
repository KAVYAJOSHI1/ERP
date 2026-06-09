import express from 'express';
import request from 'supertest';

// Build a minimal test app that mounts only the IoT route,
// with Kafka send stubbed out so no broker is needed.
jest.mock('../config/kafka', () => ({
  kafkaClient: {
    send: jest.fn().mockResolvedValue(undefined),
  },
  connectKafka: jest.fn().mockResolvedValue(undefined),
}));

import iotTelemetryRoutes from '../routes/iotTelemetry';

const app = express();
app.use(express.json());
app.use('/api/iot', iotTelemetryRoutes);

describe('POST /api/iot/telemetry', () => {
  const valid = {
    sensor_id: 'SNS-BATT-001',
    pallet_id: 'PAL-LITH-001',
    location: 'Warehouse-Zone-A',
    temperature_c: 22.5,
    timestamp: new Date().toISOString(),
  };

  it('returns 202 for a valid payload', async () => {
    const res = await request(app).post('/api/iot/telemetry').send(valid);
    expect(res.status).toBe(202);
  });

  it('returns 400 when sensor_id is missing', async () => {
    const { sensor_id, ...body } = valid;
    const res = await request(app).post('/api/iot/telemetry').send(body);
    expect(res.status).toBe(400);
  });

  it('returns 400 when pallet_id is missing', async () => {
    const { pallet_id, ...body } = valid;
    const res = await request(app).post('/api/iot/telemetry').send(body);
    expect(res.status).toBe(400);
  });

  it('returns 400 when temperature_c is missing', async () => {
    const { temperature_c, ...body } = valid;
    const res = await request(app).post('/api/iot/telemetry').send(body);
    expect(res.status).toBe(400);
  });

  it('returns 400 for a completely empty body', async () => {
    const res = await request(app).post('/api/iot/telemetry').send({});
    expect(res.status).toBe(400);
  });
});
