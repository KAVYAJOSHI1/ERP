#!/usr/bin/env bash
# ============================================================================
# COMPLETE ERP <-> IncidentAI SYNCHRONIZATION  (nothing faked, nothing manual)
# ----------------------------------------------------------------------------
# clean DB
#  -> ERP login (through the gateway)
#  -> create an intentionally invalid production run
#  -> ERP backend rejects it, persists the failed run
#  -> ERP auto-escalates to the REAL IncidentAI (:4000)  -> a real ticket
#  -> assert: one authoritative correlation id (request == run == link == ticket)
#             transaction id linked, link persisted, status OPEN
#  -> a developer RESOLVES the ticket in IncidentAI     (real PATCH /api/tickets/:id)
#  -> the status bridge (scripts/incidentai-status-bridge.mjs) forwards it
#     via the real ERP callback  (no manual push, no frontend edits)
#  -> assert: ERP incident_links.incident_status == RESOLVED  (from the DB)
#  -> re-read the ERP API -> still RESOLVED
#  -> repeat for ROLLED_BACK
#
# Requires: docker, go, node, and the REAL IncidentAI backend reachable on :4000.
# Uses throwaway Postgres/Redis — never touches the dev volume.
# ============================================================================
set -uo pipefail
RED=$'\033[0;31m'; GRN=$'\033[0;32m'; CYN=$'\033[0;36m'; YEL=$'\033[1;33m'; NC=$'\033[0m'
pass=0; fail=0
ok(){ echo "${GRN}  PASS${NC} $1"; pass=$((pass+1)); }
bad(){ echo "${RED}  FAIL${NC} $1"; fail=$((fail+1)); }
info(){ echo "${CYN}$1${NC}"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$(command -v node || echo /home/lenovo/.nvm/versions/node/v22.14.0/bin/node)"
INCIDENTAI_API="${INCIDENTAI_API_URL:-http://localhost:4000}"
DEV_EMAIL="${INCIDENTAI_DEV_EMAIL:-developer@incidentai.demo}"
DEV_PASS="${INCIDENTAI_DEV_PASSWORD:-demopass123}"
SECRET="erp-incident-callback-dev-secret"

DBC=erp-fullloop-db; RDC=erp-fullloop-redis
DB_PORT=5479; RD_PORT=6400
GW_PORT=5090; AUTH_PORT=8590; INV_PORT=8591; PROD_PORT=8595
PIDS=()
cleanup(){
  info "--- cleanup ---"
  for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done
  lsof -ti "tcp:$GW_PORT" "tcp:$AUTH_PORT" "tcp:$INV_PORT" "tcp:$PROD_PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
  docker rm -f "$DBC" "$RDC" >/dev/null 2>&1 || true
  rm -f /tmp/erp_fl_*.log 2>/dev/null || true
}
trap cleanup EXIT
psq(){ docker exec "$DBC" psql -U erp_user -d erp_db -tAc "$1" | tr -d '[:space:]'; }
jget(){ "$NODE_BIN" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{let v=JSON.parse(s);for(const k of process.argv[1].split("."))v=v&&v[k];console.log(v??"")}catch{console.log("")}})' "$1"; }

# --- precondition: real IncidentAI must be up ---
if ! curl -sf "${INCIDENTAI_API}/api/health" >/dev/null 2>&1 && ! curl -s "${INCIDENTAI_API}/api/incidents/ingest" >/dev/null 2>&1; then
  echo "${YEL}SKIP: real IncidentAI not reachable at ${INCIDENTAI_API} — start it and re-run.${NC}"
  exit 0
fi
IA_TOKEN=$(curl -s -X POST "${INCIDENTAI_API}/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"${DEV_EMAIL}\",\"password\":\"${DEV_PASS}\"}" | jget token)
[ -n "$IA_TOKEN" ] && ok "authenticated to the real IncidentAI as ${DEV_EMAIL}" || { echo "${YEL}SKIP: could not log into IncidentAI${NC}"; exit 0; }

info "1. Throwaway Postgres (fresh seed) + Redis"
docker rm -f "$DBC" "$RDC" >/dev/null 2>&1 || true
docker run -d --name "$DBC" -e POSTGRES_USER=erp_user -e POSTGRES_PASSWORD=erp_password -e POSTGRES_DB=erp_db \
  -p ${DB_PORT}:5432 -v "$ROOT/infra/postgres/init:/docker-entrypoint-initdb.d:ro" postgres:16-alpine >/dev/null
docker run -d --name "$RDC" -p ${RD_PORT}:6379 redis:7-alpine >/dev/null
for i in $(seq 1 40); do docker exec "$DBC" pg_isready -U erp_user -d erp_db >/dev/null 2>&1 && break; sleep 1; done
sleep 3
BOM_ID=$(psq "SELECT id FROM production.bill_of_materials WHERE name='Standard Battery Pack Assembly';")
WC_ID=$(psq  "SELECT id FROM production.work_centers WHERE name='Assembly Line A';")
[ -n "$BOM_ID" ] && [ -n "$WC_ID" ] && ok "clean seed present" || { bad "seed missing"; exit 1; }

info "2. Start ERP: auth + inventory + production + gateway (escalating to REAL IncidentAI)"
DB_ENV=(DB_HOST=localhost DB_PORT=$DB_PORT DB_USER=erp_user DB_PASSWORD=erp_password DB_NAME=erp_db DB_SSLMODE=disable KAFKA_BROKERS=localhost:59092)
INGEST="${INCIDENTAI_API}/api/incidents/ingest"
( cd "$ROOT/backend/services/auth" && env "${DB_ENV[@]}" REDIS_HOST=localhost REDIS_PORT=$RD_PORT AUTH_SERVICE_PORT=$AUTH_PORT go run . >/tmp/erp_fl_auth.log 2>&1 ) & PIDS+=($!)
( cd "$ROOT/backend/services/inventory" && env "${DB_ENV[@]}" INVENTORY_SERVICE_PORT=$INV_PORT INCIDENTAI_INGEST_URL="$INGEST" go run . >/tmp/erp_fl_inv.log 2>&1 ) & PIDS+=($!)
( cd "$ROOT/backend/services/production" && env "${DB_ENV[@]}" PRODUCTION_SERVICE_PORT=$PROD_PORT INVENTORY_SERVICE_URL="http://localhost:$INV_PORT" INCIDENTAI_INGEST_URL="$INGEST" go run . >/tmp/erp_fl_prod.log 2>&1 ) & PIDS+=($!)
( cd "$ROOT/gateway" && env PORT=$GW_PORT NODE_ENV=development JWT_SECRET=super_secret_jwt_key_change_me_in_production \
    REDIS_HOST=localhost REDIS_PORT=$RD_PORT KAFKA_BROKERS=localhost:59092 \
    AUTH_SERVICE_URL="http://localhost:$AUTH_PORT" INVENTORY_SERVICE_URL="http://localhost:$INV_PORT" \
    PRODUCTION_SERVICE_URL="http://localhost:$PROD_PORT" INCIDENT_CALLBACK_SECRET="$SECRET" \
    "$NODE_BIN" node_modules/.bin/ts-node-dev --transpile-only src/index.ts >/tmp/erp_fl_gw.log 2>&1 ) & PIDS+=($!)
for i in $(seq 1 80); do
  curl -sf "http://localhost:$GW_PORT/health" >/dev/null 2>&1 && curl -sf "http://localhost:$PROD_PORT/health" >/dev/null 2>&1 && curl -sf "http://localhost:$INV_PORT/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf "http://localhost:$GW_PORT/health" >/dev/null && ok "ERP gateway + services up" || { bad "ERP down"; tail -20 /tmp/erp_fl_gw.log; exit 1; }

info "3. ERP login + intentionally invalid production run (qty 20 -> needs 2000 cells, have 250)"
TOKEN=$(curl -s -X POST "http://localhost:$GW_PORT/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"production@erp.com","password":"admin123"}' | jget access_token)
[ -n "$TOKEN" ] && ok "ERP access token" || { bad "ERP login failed"; exit 1; }

BODY=$(curl -s -D /tmp/erp_fl_hdrs -X POST "http://localhost:$GW_PORT/api/production/runs" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"bom_id\":\"$BOM_ID\",\"work_center_id\":\"$WC_ID\",\"quantity\":20}")
GW_CORR=$(grep -i '^x-correlation-id:' /tmp/erp_fl_hdrs | tr -d '\r' | awk '{print $2}')
INC_ID=$(echo "$BODY" | jget incident.id)
INC_NUM=$(echo "$BODY" | jget incident.number)
INC_CORR=$(echo "$BODY" | jget incident.correlation_id)
TXN=$(echo "$BODY" | jget transaction_id)

echo "$BODY" | grep -q '"error":"Insufficient Materials"' && ok "backend rejected the run (real validation)" || bad "not rejected: $BODY"
[ -n "$INC_ID" ] && ok "real IncidentAI ticket created automatically: $INC_NUM ($INC_ID)" || { bad "no incident in response: $BODY"; tail -20 /tmp/erp_fl_prod.log; exit 1; }
[ "$GW_CORR" = "$INC_CORR" ] && ok "one authoritative correlation id: gateway == response ($GW_CORR)" || bad "corr mismatch gw=$GW_CORR resp=$INC_CORR"

info "4. Verify the correlation id all the way into the REAL IncidentAI ticket"
IA_TICKET=$(curl -s "${INCIDENTAI_API}/api/tickets/${INC_ID}" -H "Authorization: Bearer $IA_TOKEN")
IA_CORR=$(echo "$IA_TICKET" | jget ticket.correlation_id)
IA_CTX_CORR=$(echo "$IA_TICKET" | jget ticket.erp_context.correlation_id)
[ "$IA_CORR" = "$GW_CORR" ] && ok "IncidentAI ticket.correlation_id == ERP correlation id" || bad "IncidentAI ticket.correlation_id=$IA_CORR"
[ "$IA_CTX_CORR" = "$GW_CORR" ] && ok "IncidentAI ticket.erp_context.correlation_id == ERP correlation id" || bad "erp_context.correlation_id=$IA_CTX_CORR"
IA_TXN=$(echo "$IA_TICKET" | jget ticket.erp_context.transaction_id)
[ "$IA_TXN" = "$TXN" ] && ok "IncidentAI ticket carries the ERP transaction id ($TXN)" || bad "IncidentAI transaction_id=$IA_TXN"

info "5. Persistence: ERP link row + failed run"
LINK=$(psq "SELECT incident_status||'|'||incident_id||'|'||transaction_id FROM audit.incident_links WHERE correlation_id='$GW_CORR';")
[ "$LINK" = "OPEN|$INC_ID|$TXN" ] && ok "audit.incident_links persisted: $LINK" || bad "link=$LINK"
[ "$(psq "SELECT status FROM production.production_runs WHERE id='$TXN';")" = "failed" ] && ok "failed production run persisted" || bad "run not persisted failed"

info "6. Developer RESOLVES the ticket in IncidentAI (real PATCH), bridge forwards it"
curl -s -o /dev/null -X PATCH "${INCIDENTAI_API}/api/tickets/${INC_ID}" \
  -H "Authorization: Bearer $IA_TOKEN" -H 'Content-Type: application/json' -d '{"status":"RESOLVED"}'
NEWSTAT=$(curl -s "${INCIDENTAI_API}/api/tickets/${INC_ID}" -H "Authorization: Bearer $IA_TOKEN" | jget ticket.status)
[ "$NEWSTAT" = "RESOLVED" ] && ok "IncidentAI ticket is now RESOLVED" || bad "IncidentAI status=$NEWSTAT"

env INCIDENTAI_API_URL="$INCIDENTAI_API" ERP_GATEWAY_URL="http://localhost:$GW_PORT" \
    INCIDENT_CALLBACK_SECRET="$SECRET" INCIDENTAI_DEV_EMAIL="$DEV_EMAIL" INCIDENTAI_DEV_PASSWORD="$DEV_PASS" \
    BRIDGE_POLL_MS=2000 "$NODE_BIN" "$ROOT/scripts/incidentai-status-bridge.mjs" >/tmp/erp_fl_bridge.log 2>&1 &
BRIDGE_PID=$!
PIDS+=($BRIDGE_PID)

ERP_STATUS=""
for i in $(seq 1 20); do
  ERP_STATUS=$(psq "SELECT incident_status FROM audit.incident_links WHERE correlation_id='$GW_CORR';")
  [ "$ERP_STATUS" = "RESOLVED" ] && break
  sleep 1
done
[ "$ERP_STATUS" = "RESOLVED" ] && ok "bridge forwarded RESOLVED -> ERP incident_links.incident_status (from DB, no manual push)" || { bad "ERP status=$ERP_STATUS"; cat /tmp/erp_fl_bridge.log; }

info "7. Re-read the ERP API — still RESOLVED"
RUN_STAT=$(curl -s "http://localhost:$PROD_PORT/production/runs" | jget '0.incident.incident_status')
[ "$RUN_STAT" = "RESOLVED" ] && ok "GET /production/runs shows RESOLVED after a fresh read" || bad "runs status=$RUN_STAT"

info "8. Rollback: developer sets ROLLED_BACK in IncidentAI, bridge forwards it"
curl -s -o /dev/null -X PATCH "${INCIDENTAI_API}/api/tickets/${INC_ID}" \
  -H "Authorization: Bearer $IA_TOKEN" -H 'Content-Type: application/json' -d '{"status":"ROLLED_BACK"}'
RB=""
for i in $(seq 1 20); do
  RB=$(psq "SELECT incident_status FROM audit.incident_links WHERE correlation_id='$GW_CORR';")
  [ "$RB" = "ROLLED_BACK" ] && break
  sleep 1
done
RUN_RB=$(curl -s "http://localhost:$PROD_PORT/production/runs" | jget '0.incident.incident_status')
[ "$RB" = "ROLLED_BACK" ] && [ "$RUN_RB" = "ROLLED_BACK" ] && ok "bridge forwarded ROLLED_BACK -> ERP DB + API both show ROLLED_BACK" || bad "rollback db=$RB api=$RUN_RB"

kill "$BRIDGE_PID" 2>/dev/null || true

echo
if [ "$fail" -eq 0 ]; then echo "${GRN}==== FULL LOOP: $pass passed, $fail failed ====${NC}"; exit 0
else echo "${RED}==== FULL LOOP: $pass passed, $fail failed ====${NC}"; exit 1; fi
