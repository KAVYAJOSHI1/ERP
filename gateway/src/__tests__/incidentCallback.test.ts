import express from 'express';
import request from 'supertest';

// Fix the secret before the route module reads it.
process.env.INCIDENT_CALLBACK_SECRET = 'test-secret-123';
process.env.PRODUCTION_SERVICE_URL = 'http://production.test:8085';

import incidentCallbackRoutes from '../routes/incidentCallback';

const app = express();
app.use(express.json());
app.use('/api/incident-callback', incidentCallbackRoutes);

const okBody = { correlation_id: 'ERP-CORR-1', incident_id: 'INC-1', status: 'RESOLVED' };

describe('POST /api/incident-callback/status', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ message: 'incident status updated', incident: { status: 'RESOLVED' } }),
    });
    (global as any).fetch = fetchMock;
  });

  it('rejects a request with no secret (401)', async () => {
    const res = await request(app).post('/api/incident-callback/status').send(okBody);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong secret (401)', async () => {
    const res = await request(app)
      .post('/api/incident-callback/status')
      .set('X-Incident-Secret', 'nope')
      .send(okBody);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a valid secret but missing status (400)', async () => {
    const res = await request(app)
      .post('/api/incident-callback/status')
      .set('X-Incident-Secret', 'test-secret-123')
      .send({ correlation_id: 'ERP-CORR-1' });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a valid secret but no identifier (400)', async () => {
    const res = await request(app)
      .post('/api/incident-callback/status')
      .set('X-Incident-Secret', 'test-secret-123')
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(400);
  });

  it('forwards to the production service with a valid secret + flat body', async () => {
    const res = await request(app)
      .post('/api/incident-callback/status')
      .set('X-Incident-Secret', 'test-secret-123')
      .send(okBody);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://production.test:8085/production/incident-callback/status');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toMatchObject(okBody);
  });

  it('accepts a ticket-shaped IncidentAI webhook body and flattens it', async () => {
    const res = await request(app)
      .post('/api/incident-callback/status')
      .set('X-Incident-Secret', 'test-secret-123')
      .send({
        event: 'ticket.updated',
        ticket: { id: 'INC-7', ticket_number: 'TKT-7', correlation_id: 'ERP-CORR-7', status: 'VERIFIED' },
      });

    expect(res.status).toBe(200);
    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({
      correlation_id: 'ERP-CORR-7',
      incident_id: 'INC-7',
      status: 'VERIFIED',
    });
  });

  it('rejects a ticket-shaped body with no status (400)', async () => {
    const res = await request(app)
      .post('/api/incident-callback/status')
      .set('X-Incident-Secret', 'test-secret-123')
      .send({ ticket: { id: 'INC-8', correlation_id: 'ERP-CORR-8' } });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 502 if the production service is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await request(app)
      .post('/api/incident-callback/status')
      .set('X-Incident-Secret', 'test-secret-123')
      .send(okBody);
    expect(res.status).toBe(502);
  });
});
