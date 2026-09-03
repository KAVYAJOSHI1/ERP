#!/usr/bin/env node
/**
 * IncidentAI -> ERP status bridge  (webhook sidecar)
 * ================================================================
 * IncidentAI has no outbound webhook and cannot be modified in this task. This
 * sidecar closes the loop using ONLY the two apps' existing public contracts:
 *
 *   1. logs into IncidentAI            POST  /api/auth/login        (demo dev account)
 *   2. polls IncidentAI tickets        GET   /api/tickets           (Bearer token)
 *   3. for every ticket that originated from the ERP
 *      (erp_context.source === "erp-backend-auto" or it has a correlation_id),
 *      forwards its current status to the ERP callback
 *                                      POST  /api/incident-callback/status
 *                                            X-Incident-Secret: <shared secret>
 *
 * The ERP side is untouched — it already normalizes the status and persists it
 * to audit.incident_links. This is exactly what an IncidentAI webhook would do;
 * nothing here fakes a status, everything comes from IncidentAI's real API.
 *
 * Run it alongside the demo:   node scripts/incidentai-status-bridge.mjs
 * Stop with Ctrl-C.
 *
 * Env (all have demo defaults):
 *   INCIDENTAI_API_URL          http://localhost:4000
 *   ERP_GATEWAY_URL             http://localhost:5000
 *   INCIDENT_CALLBACK_SECRET    erp-incident-callback-dev-secret
 *   INCIDENTAI_DEV_EMAIL        developer@incidentai.demo
 *   INCIDENTAI_DEV_PASSWORD     demopass123
 *   BRIDGE_POLL_MS              4000
 */

const INCIDENTAI_API_URL = process.env.INCIDENTAI_API_URL || 'http://localhost:4000';
const ERP_GATEWAY_URL = process.env.ERP_GATEWAY_URL || 'http://localhost:5000';
const SECRET = process.env.INCIDENT_CALLBACK_SECRET || 'erp-incident-callback-dev-secret';
const EMAIL = process.env.INCIDENTAI_DEV_EMAIL || 'developer@incidentai.demo';
const PASSWORD = process.env.INCIDENTAI_DEV_PASSWORD || 'demopass123';
const POLL_MS = Number(process.env.BRIDGE_POLL_MS || 4000);

const lastPushed = new Map(); // correlation_id -> last status forwarded

async function login() {
  const r = await fetch(`${INCIDENTAI_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`IncidentAI login failed (${r.status})`);
  return (await r.json()).token;
}

async function fetchTickets(token) {
  const r = await fetch(`${INCIDENTAI_API_URL}/api/tickets`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 401) throw Object.assign(new Error('token expired'), { code: 'REAUTH' });
  if (!r.ok) throw new Error(`GET /api/tickets -> ${r.status}`);
  return (await r.json()).tickets || [];
}

async function pushStatus({ correlation_id, incident_id, status }) {
  const r = await fetch(`${ERP_GATEWAY_URL}/api/incident-callback/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Incident-Secret': SECRET },
    body: JSON.stringify({ correlation_id, incident_id, status }),
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

// Only forward tickets this ERP instance actually raised: the automated
// escalation path stamps erp_context.source = "erp-backend-auto". (A ticket the
// ERP doesn't know about would just 404 at the callback anyway.)
function isErpOriginated(t) {
  const ctx = t.erp_context || {};
  if (ctx.source === 'erp-backend-auto') return true;
  // manual "Report Issue" from this ERP: no source field, but erp + correlation_id
  return ctx.erp === 'Smart Manufacturing ERP' && Boolean(ctx.correlation_id);
}

async function loop() {
  let token = await login();
  console.log(`[bridge] logged into IncidentAI as ${EMAIL}; polling every ${POLL_MS}ms`);

  for (;;) {
    try {
      const tickets = await fetchTickets(token);
      for (const t of tickets) {
        if (!isErpOriginated(t)) continue;
        const corr = (t.erp_context && t.erp_context.correlation_id) || t.correlation_id;
        if (!corr) continue;
        if (lastPushed.get(corr) === t.status) continue;

        const res = await pushStatus({ correlation_id: corr, incident_id: t.id, status: t.status });
        if (res.ok) {
          lastPushed.set(corr, t.status);
          const erp = res.body && res.body.incident ? res.body.incident.status : '?';
          console.log(`[bridge] ${t.ticket_number || t.id}  ${t.status}  ->  ERP ${erp}   (corr ${corr})`);
        } else if (res.status === 404) {
          // ticket not from this ERP instance — remember so we don't retry every tick
          lastPushed.set(corr, t.status);
        } else {
          console.warn(`[bridge] push failed for ${corr}: ${res.status} ${JSON.stringify(res.body)}`);
        }
      }
    } catch (err) {
      if (err.code === 'REAUTH') {
        console.log('[bridge] re-authenticating…');
        token = await login();
      } else {
        console.warn(`[bridge] ${err.message}`);
      }
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

loop().catch((err) => {
  console.error('[bridge] fatal:', err.message);
  process.exit(1);
});
