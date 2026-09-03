#!/usr/bin/env bash
# ============================================================================
# End-to-end check THROUGH the real API gateway, on throwaway infra
# (never touches the dev volume):
#
#   login -> POST /api/production/runs (failing) -> assert the GATEWAY-issued
#   X-Correlation-ID is the exact id carried on the auto-created incident, then
#   IncidentAI -> ERP status callback flows back through
#   /api/incident-callback/status (shared-secret guarded).
#
# Requires: docker, go, node.  Usage: scripts/verify_gateway_e2e.sh
# ============================================================================
set -euo pipefail
RED=$'\033[0;31m'; GRN=$'\033[0;32m'; CYN=$'\033[0;36m'; NC=$'\033[0m'
pass=0; fail=0
ok(){ echo "${GRN}  PASS${NC} $1"; pass=$((pass+1)); }
bad(){ echo "${RED}  FAIL${NC} $1"; fail=$((fail+1)); }
info(){ echo "${CYN}$1${NC}"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$(command -v node || echo /home/lenovo/.nvm/versions/node/v22.14.0/bin/node)"
DBC=erp-gwe2e-db; RDC=erp-gwe2e-redis
DB_PORT=5478; RD_PORT=6399; STUB_PORT=4557
GW_PORT=5099; AUTH_PORT=8490; INV_PORT=8491; PROD_PORT=8495
PIDS=()
cleanup(){
  info "--- cleanup ---"
  for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done
  docker rm -f "$DBC" "$RDC" >/dev/null 2>&1 || true
  rm -f /tmp/erp_gwe2e_*.log /tmp/erp_gwe2e_stub.js /tmp/erp_gwe2e_hdrs 2>/dev/null || true
}
trap cleanup EXIT
psq(){ docker exec "$DBC" psql -U erp_user -d erp_db -tAc "$1" | tr -d '[:space:]'; }
jget(){ "$NODE_BIN" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{let v=JSON.parse(s);for(const k of process.argv[1].split("."))v=v&&v[k];console.log(v??"")}catch{console.log("")}})' "$1"; }

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

info "2. IncidentAI ingest stub"
cat > /tmp/erp_gwe2e_stub.js <<'EOF'
const http=require('http');let hits=0,last=null;
http.createServer((req,res)=>{if(req.url==='/__hits'){res.end(JSON.stringify({hits,last}));return;}
let b='';req.on('data',d=>b+=d).on('end',()=>{hits++;let c=null;try{c=JSON.parse(b).erp_context.correlation_id}catch{}last=c;
res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify({ticket:{id:'INC-'+c,ticket_number:'TKT-'+hits,status:'TRIAGED',correlation_id:c}}))})}).listen(process.env.PORT)
EOF
PORT=$STUB_PORT "$NODE_BIN" /tmp/erp_gwe2e_stub.js >/tmp/erp_gwe2e_stub.log 2>&1 & PIDS+=($!)
sleep 1

info "3. Start auth + inventory + production + gateway"
DB_ENV=(DB_HOST=localhost DB_PORT=$DB_PORT DB_USER=erp_user DB_PASSWORD=erp_password DB_NAME=erp_db DB_SSLMODE=disable KAFKA_BROKERS=localhost:59092)
INGEST="http://localhost:$STUB_PORT/api/incidents/ingest"
( cd "$ROOT/backend/services/auth" && env "${DB_ENV[@]}" REDIS_HOST=localhost REDIS_PORT=$RD_PORT AUTH_SERVICE_PORT=$AUTH_PORT go run . >/tmp/erp_gwe2e_auth.log 2>&1 ) & PIDS+=($!)
( cd "$ROOT/backend/services/inventory" && env "${DB_ENV[@]}" INVENTORY_SERVICE_PORT=$INV_PORT INCIDENTAI_INGEST_URL="$INGEST" go run . >/tmp/erp_gwe2e_inv.log 2>&1 ) & PIDS+=($!)
( cd "$ROOT/backend/services/production" && env "${DB_ENV[@]}" PRODUCTION_SERVICE_PORT=$PROD_PORT INVENTORY_SERVICE_URL="http://localhost:$INV_PORT" INCIDENTAI_INGEST_URL="$INGEST" go run . >/tmp/erp_gwe2e_prod.log 2>&1 ) & PIDS+=($!)
( cd "$ROOT/gateway" && env PORT=$GW_PORT NODE_ENV=development JWT_SECRET=super_secret_jwt_key_change_me_in_production \
    REDIS_HOST=localhost REDIS_PORT=$RD_PORT KAFKA_BROKERS=localhost:59092 \
    AUTH_SERVICE_URL="http://localhost:$AUTH_PORT" INVENTORY_SERVICE_URL="http://localhost:$INV_PORT" \
    PRODUCTION_SERVICE_URL="http://localhost:$PROD_PORT" INCIDENT_CALLBACK_SECRET="erp-incident-callback-dev-secret" \
    "$NODE_BIN" node_modules/.bin/ts-node-dev --transpile-only src/index.ts >/tmp/erp_gwe2e_gw.log 2>&1 ) & PIDS+=($!)

for i in $(seq 1 80); do
  curl -sf "http://localhost:$GW_PORT/health" >/dev/null 2>&1 && \
  curl -sf "http://localhost:$PROD_PORT/health" >/dev/null 2>&1 && \
  curl -sf "http://localhost:$INV_PORT/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf "http://localhost:$GW_PORT/health" >/dev/null && ok "gateway up" || { bad "gateway down"; tail -25 /tmp/erp_gwe2e_gw.log; exit 1; }
curl -sf "http://localhost:$PROD_PORT/health" >/dev/null && ok "production up" || { bad "production down"; tail -25 /tmp/erp_gwe2e_prod.log; exit 1; }

info "4. Login via the gateway"
TOKEN=$(curl -s -X POST "http://localhost:$GW_PORT/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"production@erp.com","password":"admin123"}' | jget access_token)
[ -n "$TOKEN" ] && ok "got access token" || { bad "login failed"; exit 1; }

info "5. Failing production run through the gateway (qty 9 -> needs 900 cells)"
BODY=$(curl -s -D /tmp/erp_gwe2e_hdrs -X POST "http://localhost:$GW_PORT/api/production/runs" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"bom_id\":\"$BOM_ID\",\"work_center_id\":\"$WC_ID\",\"quantity\":9}")
GW_CORR=$(grep -i '^x-correlation-id:' /tmp/erp_gwe2e_hdrs | tr -d '\r' | awk '{print $2}')
INC_CORR=$(echo "$BODY" | jget incident.correlation_id)
INC_ID=$(echo "$BODY" | jget incident.id)
TXN=$(echo "$BODY" | jget transaction_id)

[ -n "$GW_CORR" ] && ok "gateway issued X-Correlation-ID ($GW_CORR)" || bad "no gateway correlation id"
[ "$GW_CORR" = "$INC_CORR" ] && ok "incident.correlation_id == gateway X-Correlation-ID (identical end-to-end)" || bad "mismatch gw=$GW_CORR inc=$INC_CORR"
S_LAST=$(curl -s "http://localhost:$STUB_PORT/__hits" | jget last)
[ "$S_LAST" = "$GW_CORR" ] && ok "IncidentAI received the gateway correlation id" || bad "IncidentAI saw $S_LAST"
[ -n "$TXN" ] && ok "response carries transaction_id ($TXN)" || bad "no transaction_id"
LINK=$(psq "SELECT incident_status||'|'||module||'|'||transaction_id FROM audit.incident_links WHERE correlation_id='$GW_CORR';")
[ "$LINK" = "OPEN|Production|$TXN" ] && ok "audit.incident_links row: $LINK" || bad "link row=$LINK"

info "6. Callback through the gateway (IncidentAI vocabulary + ticket-shaped body)"
NOAUTH=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:$GW_PORT/api/incident-callback/status" \
  -H 'Content-Type: application/json' -d "{\"correlation_id\":\"$GW_CORR\",\"status\":\"OPEN\"}")
[ "$NOAUTH" = "401" ] && ok "callback without the shared secret is rejected (401)" || bad "unauth callback HTTP $NOAUTH"

# 'ASSIGNED' -> IN_PROGRESS
curl -s -o /dev/null -X POST "http://localhost:$GW_PORT/api/incident-callback/status" \
  -H 'Content-Type: application/json' -H 'X-Incident-Secret: erp-incident-callback-dev-secret' \
  -d "{\"correlation_id\":\"$GW_CORR\",\"status\":\"ASSIGNED\"}"
S1=$(psq "SELECT incident_status FROM audit.incident_links WHERE correlation_id='$GW_CORR';")
[ "$S1" = "IN_PROGRESS" ] && ok "'ASSIGNED' -> ERP IN_PROGRESS" || bad "ASSIGNED gave $S1"

# ticket-shaped 'VERIFIED' -> RESOLVED
CB=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:$GW_PORT/api/incident-callback/status" \
  -H 'Content-Type: application/json' -H 'X-Incident-Secret: erp-incident-callback-dev-secret' \
  -d "{\"event\":\"ticket.updated\",\"ticket\":{\"id\":\"$INC_ID\",\"correlation_id\":\"$GW_CORR\",\"status\":\"VERIFIED\"}}")
[ "$CB" = "200" ] && ok "ticket-shaped callback via gateway accepted (200)" || bad "callback HTTP $CB"
FIN=$(psq "SELECT incident_status FROM audit.incident_links WHERE correlation_id='$GW_CORR';")
[ "$FIN" = "RESOLVED" ] && ok "'VERIFIED' -> ERP status RESOLVED and persisted" || bad "status=$FIN"

# rollback
curl -s -o /dev/null -X POST "http://localhost:$GW_PORT/api/incident-callback/status" \
  -H 'Content-Type: application/json' -H 'X-Incident-Secret: erp-incident-callback-dev-secret' \
  -d "{\"correlation_id\":\"$GW_CORR\",\"status\":\"ROLLED_BACK\"}"
SR=$(psq "SELECT incident_status FROM audit.incident_links WHERE correlation_id='$GW_CORR';")
RUN_SR=$(curl -s "http://localhost:$PROD_PORT/production/runs" | jget '0.incident.incident_status')
[ "$SR" = "ROLLED_BACK" ] && ok "rollback -> ERP status ROLLED_BACK (DB + GET /production/runs)" || bad "rollback db=$SR runs=$RUN_SR"

echo
if [ "$fail" -eq 0 ]; then echo "${GRN}==== GATEWAY E2E: $pass passed, $fail failed ====${NC}"; exit 0
else echo "${RED}==== GATEWAY E2E: $pass passed, $fail failed ====${NC}"; exit 1; fi
