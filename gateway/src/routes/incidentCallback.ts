import { Router, Request, Response } from 'express';

/**
 * IncidentAI -> ERP status callback.
 * ---------------------------------
 * IncidentAI advances the ERP-side status of an incident that originated from an
 * ERP operation. This route is what an IncidentAI webhook posts to; during the
 * demo `scripts/incident_status_push.sh` posts the same request.
 *
 *   POST /api/incident-callback/status
 *   headers: X-Incident-Secret: <shared secret>   (env INCIDENT_CALLBACK_SECRET)
 *
 * Accepted request bodies (either shape — the production service normalizes):
 *
 *   FLAT:
 *     { "correlation_id": "<uuid>", "incident_id": "INC-...", "status": "RESOLVED" }
 *
 *   TICKET-SHAPED (an IncidentAI ticket object, optionally wrapped in an event):
 *     { "ticket": { "id": "INC-...", "ticket_number": "TKT-9001",
 *                   "correlation_id": "<uuid>", "status": "VERIFIED" } }
 *     { "event": "ticket.updated", "ticket": { ...as above... } }
 *
 * `status` is IncidentAI's own vocabulary (NEW, TRIAGED, ASSIGNED, IN_PROGRESS,
 * APPROVED, VERIFICATION, VERIFICATION_FAILED, ROLLBACK_REQUIRED, ROLLED_BACK,
 * RESOLVED, VERIFIED, KNOWLEDGE_CAPTURED, SELF_SERVICE_RESOLVED, CLOSED, ...).
 * The ERP maps every one onto OPEN | IN_PROGRESS | RESOLVED | ROLLED_BACK via
 * the single centralized mapper in backend/pkg/incident (NormalizeStatus).
 *
 * Security: NOT behind JWT/RBAC (IncidentAI holds no ERP user token) — guarded
 * by a shared secret only. The ERP status is written to audit.incident_links by
 * the production service; it is never derived from the ERP UI.
 *
 * Example responses IncidentAI would send for the common transitions:
 *   developer picks up ticket   -> status "TRIAGED"  -> ERP IN_PROGRESS
 *   verification passes/applied  -> status "VERIFIED" -> ERP RESOLVED
 *   fix reverted                 -> status "ROLLED_BACK" -> ERP ROLLED_BACK
 */

const router = Router();

const PRODUCTION_SERVICE_URL =
  process.env.PRODUCTION_SERVICE_URL || 'http://localhost:8085';
const CALLBACK_SECRET =
  process.env.INCIDENT_CALLBACK_SECRET || 'erp-incident-callback-dev-secret';

router.post('/status', async (req: Request, res: Response) => {
  const provided = req.header('X-Incident-Secret') || req.header('x-incident-secret');
  if (!provided || provided !== CALLBACK_SECRET) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing incident callback secret' });
    return;
  }

  const body = req.body || {};
  const ticket = body.ticket || {};
  const correlation_id = body.correlation_id || ticket.correlation_id;
  const incident_id = body.incident_id || ticket.id;
  const status = body.status || ticket.status;

  if (!status || (!correlation_id && !incident_id)) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'status and one of correlation_id / incident_id are required (flat or ticket-shaped body)',
    });
    return;
  }

  try {
    const upstream = await fetch(`${PRODUCTION_SERVICE_URL}/production/incident-callback/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': (req as any).correlationId || '',
      },
      body: JSON.stringify({ correlation_id, incident_id, status }),
    });
    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err: any) {
    res.status(502).json({
      error: 'Bad Gateway',
      message: 'Could not reach the production service to record the incident status',
      detail: err?.message,
    });
  }
});

export default router;
