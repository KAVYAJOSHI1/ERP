#!/usr/bin/env bash
# ============================================================================
# IncidentAI -> ERP incident status: ONE-SHOT MANUAL PUSH (testing / fallback).
#
# For the actual demo, prefer the sidecar that forwards automatically:
#     node scripts/incidentai-status-bridge.mjs
#
# This script pushes a single status to the ERP callback by hand — useful in
# tests, or to nudge one incident without running the bridge:
#
#   scripts/incident_status_push.sh <CORRELATION_ID|INCIDENT_ID> <STATUS>
#
#   STATUS in: OPEN | IN_PROGRESS | RESOLVED | ROLLED_BACK
#
# Env:
#   ERP_GATEWAY_URL           default http://localhost:5000
#   INCIDENT_CALLBACK_SECRET  default erp-incident-callback-dev-secret
# ============================================================================
set -euo pipefail

ID="${1:-}"
STATUS="${2:-}"
if [ -z "$ID" ] || [ -z "$STATUS" ]; then
  echo "usage: $0 <correlation_id|incident_id> <OPEN|IN_PROGRESS|RESOLVED|ROLLED_BACK>" >&2
  exit 2
fi

GW="${ERP_GATEWAY_URL:-http://localhost:5000}"
SECRET="${INCIDENT_CALLBACK_SECRET:-erp-incident-callback-dev-secret}"

# Send the id as both fields; the ERP matches on either.
curl -sS -X POST "${GW}/api/incident-callback/status" \
  -H 'Content-Type: application/json' \
  -H "X-Incident-Secret: ${SECRET}" \
  -d "{\"correlation_id\":\"${ID}\",\"incident_id\":\"${ID}\",\"status\":\"${STATUS}\"}"
echo
