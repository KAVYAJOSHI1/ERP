#!/usr/bin/env bash
# ============================================================================
# ERP <-> IncidentAI golden-path integration test.
#
# Proves, against a CLEAN freshly-seeded Postgres (no reliance on the dev
# volume):
#   1. demo seed is reproducible
#   2. production resolves its warehouse from the DB (no hard-coded UUID)
#   3. a real backend failure (insufficient materials) is rejected
#   4. the failed transaction is persisted
#   5. an IncidentAI incident is created automatically from the backend
#   6. the ERP correlation id is the authoritative correlation id end-to-end
#   7. the transaction id is linked to the incident
#   8. a duplicate submission does NOT create a second incident
#   9. an IncidentAI -> ERP status callback updates the ERP-side status
#  10. the relationship + status survive a fresh read (persistence)
#  11. a successful production run really deducts stock
#
# Requires: docker, go, a node runtime (for the IncidentAI stub), psql client
#           via `docker exec`.
#
# Usage:  scripts/verify_golden_path.sh
# ============================================================================
set -euo pipefail

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; CYN=$'\033[0;36m'; NC=$'\033[0m'
pass=0; fail=0
ok()   { echo "${GRN}  PASS${NC} $1"; pass=$((pass+1)); }
bad()  { echo "${RED}  FAIL${NC} $1"; fail=$((fail+1)); }
info() { echo "${CYN}$1${NC}"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_CONTAINER="erp-goldenpath-db"
DB_PORT=5477
STUB_PORT=4555
INV_PORT=8191
PROD_PORT=8195
NODE_BIN="$(command -v node || echo /home/lenovo/.nvm/versions/node/v22.14.0/bin/node)"

PIDS=()
cleanup() {
  info "--- cleanup ---"
  for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done
  docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
  rm -f /tmp/erp_gp_stub.js /tmp/erp_gp_stub.log /tmp/erp_gp_inv.log /tmp/erp_gp_prod.log 2>/dev/null || true
}
trap cleanup EXIT

psql_q() { docker exec "$DB_CONTAINER" psql -U erp_user -d erp_db -tAc "$1" | tr -d '[:space:]'; }

# ---------------------------------------------------------------------------
info "1. Fresh Postgres + init scripts (clean seed, no dev volume)"
docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$DB_CONTAINER" \
  -e POSTGRES_USER=erp_user -e POSTGRES_PASSWORD=erp_password -e POSTGRES_DB=erp_db \
  -p ${DB_PORT}:5432 \
  -v "$ROOT/infra/postgres/init:/docker-entrypoint-initdb.d:ro" \
  postgres:16-alpine >/dev/null
for i in $(seq 1 40); do docker exec "$DB_CONTAINER" pg_isready -U erp_user -d erp_db >/dev/null 2>&1 && break; sleep 1; done
sleep 3

WH_ID=$(psql_q "SELECT id FROM inventory.warehouses WHERE name='Main Warehouse';")
[ -n "$WH_ID" ] && ok "warehouse 'Main Warehouse' seeded ($WH_ID)" || bad "warehouse not seeded"
CELLS=$(psql_q "SELECT quantity FROM inventory.stock_levels s JOIN inventory.products p ON p.id=s.product_id WHERE p.sku='PROD-LITH-001';")
[ "$CELLS" = "250.00" ] && ok "raw cell stock seeded = 250" || bad "raw cell stock = $CELLS (want 250.00)"
BOM_ID=$(psql_q "SELECT id FROM production.bill_of_materials WHERE name='Standard Battery Pack Assembly';")
WC_ID=$(psql_q "SELECT id FROM production.work_centers WHERE name='Assembly Line A';")
[ -n "$BOM_ID" ] && [ -n "$WC_ID" ] && ok "BOM + work center seeded" || bad "BOM/WC not seeded"
psql_q "SELECT to_regclass('audit.incident_links');" | grep -q incident_links && ok "audit.incident_links table exists" || bad "incident_links table missing"

# ---------------------------------------------------------------------------
info "2. IncidentAI ingest stub (counts calls, echoes correlation id)"
cat > /tmp/erp_gp_stub.js <<'EOF'
const http = require('http');
let hits = 0, lastCorr = null;
http.createServer((req, res) => {
  if (req.url === '/__hits') { res.end(JSON.stringify({ hits, lastCorr })); return; }
  let b = ''; req.on('data', d => b += d); req.on('end', () => {
    hits++;
    let corr = null;
    try { corr = JSON.parse(b).erp_context.correlation_id; } catch {}
    lastCorr = corr;
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ticket: { id: 'INC-STUB-' + corr, ticket_number: 'TKT-' + hits, status: 'TRIAGED', correlation_id: corr } }));
  });
}).listen(process.env.PORT || 4555);
EOF
PORT=$STUB_PORT "$NODE_BIN" /tmp/erp_gp_stub.js > /tmp/erp_gp_stub.log 2>&1 &
PIDS+=($!)
sleep 1
curl -sf "http://localhost:${STUB_PORT}/__hits" >/dev/null && ok "IncidentAI stub up on :$STUB_PORT" || bad "stub did not start"

# ---------------------------------------------------------------------------
info "3. Start inventory + production services against the clean DB"
COMMON_ENV=(DB_HOST=localhost DB_PORT=$DB_PORT DB_USER=erp_user DB_PASSWORD=erp_password DB_NAME=erp_db DB_SSLMODE=disable KAFKA_BROKERS=localhost:59092)

( cd "$ROOT/backend/services/inventory" && env "${COMMON_ENV[@]}" \
    INVENTORY_SERVICE_PORT=$INV_PORT \
    INCIDENTAI_INGEST_URL="http://localhost:${STUB_PORT}/api/incidents/ingest" \
    go run . > /tmp/erp_gp_inv.log 2>&1 ) &
PIDS+=($!)

( cd "$ROOT/backend/services/production" && env "${COMMON_ENV[@]}" \
    PRODUCTION_SERVICE_PORT=$PROD_PORT \
    INVENTORY_SERVICE_URL="http://localhost:${INV_PORT}" \
    INCIDENTAI_INGEST_URL="http://localhost:${STUB_PORT}/api/incidents/ingest" \
    go run . > /tmp/erp_gp_prod.log 2>&1 ) &
PIDS+=($!)

for i in $(seq 1 60); do
  curl -sf "http://localhost:${INV_PORT}/health" >/dev/null 2>&1 && \
  curl -sf "http://localhost:${PROD_PORT}/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf "http://localhost:${INV_PORT}/health" >/dev/null && ok "inventory service up" || { bad "inventory service down"; cat /tmp/erp_gp_inv.log; }
curl -sf "http://localhost:${PROD_PORT}/health" >/dev/null && ok "production service up" || { bad "production service down"; cat /tmp/erp_gp_prod.log; }

# ---------------------------------------------------------------------------
info "4. Failing production run (qty 3 -> needs 300 cells, have 250)"
CORR="ERP-GP-$(date +%s%N)"
RESP=$(curl -s -o /tmp/erp_gp_resp.json -w '%{http_code}' -X POST "http://localhost:${PROD_PORT}/production/runs" \
  -H 'Content-Type: application/json' -H "X-Correlation-ID: ${CORR}" \
  -d "{\"bom_id\":\"${BOM_ID}\",\"work_center_id\":\"${WC_ID}\",\"quantity\":3}")
BODY=$(cat /tmp/erp_gp_resp.json)
[ "$RESP" = "400" ] && ok "backend rejected the run (HTTP 400)" || bad "expected 400, got $RESP :: $BODY"

echo "$BODY" | grep -q '"error":"Insufficient Materials"' && ok "error = Insufficient Materials" || bad "wrong error body: $BODY"
R_CORR=$(echo "$BODY" | "$NODE_BIN" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).incident.correlation_id)}catch{console.log("")}})')
R_TXN=$(echo "$BODY"  | "$NODE_BIN" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).transaction_id)}catch{console.log("")}})')
R_INC=$(echo "$BODY"  | "$NODE_BIN" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).incident.id)}catch{console.log("")}})')

[ "$R_CORR" = "$CORR" ] && ok "response incident.correlation_id == request X-Correlation-ID ($CORR)" || bad "correlation mismatch: sent $CORR, got $R_CORR"
STUB_CORR=$(curl -s "http://localhost:${STUB_PORT}/__hits" | "$NODE_BIN" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).lastCorr))')
[ "$STUB_CORR" = "$CORR" ] && ok "IncidentAI received the SAME correlation id (authoritative)" || bad "IncidentAI saw $STUB_CORR"
[ -n "$R_TXN" ] && ok "response carries transaction_id ($R_TXN)" || bad "no transaction_id in response"
[ "$R_INC" = "INC-STUB-$CORR" ] && ok "incident id recorded ($R_INC)" || bad "incident id = $R_INC"

# ---------------------------------------------------------------------------
info "5. Correlation-ID chain + persistence in the database"
FAILED_RUN_STATUS=$(psql_q "SELECT status FROM production.production_runs WHERE id='${R_TXN}';")
[ "$FAILED_RUN_STATUS" = "failed" ] && ok "failed production run persisted (status=failed)" || bad "run status = '$FAILED_RUN_STATUS'"
RUN_CORR=$(psql_q "SELECT correlation_id FROM production.production_runs WHERE id='${R_TXN}';")
[ "$RUN_CORR" = "$CORR" ] && ok "production_runs.correlation_id == request correlation id (one authoritative id)" || bad "run correlation_id=$RUN_CORR"
LINK_ROW=$(psql_q "SELECT incident_id||'|'||incident_status||'|'||transaction_id||'|'||module FROM audit.incident_links WHERE correlation_id='${CORR}';")
[ "$LINK_ROW" = "INC-STUB-${CORR}|OPEN|${R_TXN}|Production" ] && ok "audit.incident_links row correct: $LINK_ROW" || bad "link row = $LINK_ROW"
CHAIN_OK=$(psql_q "SELECT (r.correlation_id = l.correlation_id) FROM production.production_runs r JOIN audit.incident_links l ON l.transaction_id = r.id::text WHERE r.id='${R_TXN}';")
[ "$CHAIN_OK" = "t" ] && ok "production_runs.correlation_id == incident_links.correlation_id (joined on transaction_id)" || bad "chain broken: $CHAIN_OK"
CELLS_AFTER=$(psql_q "SELECT quantity FROM inventory.stock_levels s JOIN inventory.products p ON p.id=s.product_id WHERE p.sku='PROD-LITH-001';")
[ "$CELLS_AFTER" = "250.00" ] && ok "no stock was deducted by the rejected run (still 250)" || bad "stock changed to $CELLS_AFTER"

# ---------------------------------------------------------------------------
info "6. Duplicate submission — no second incident"
curl -s -X POST "http://localhost:${PROD_PORT}/production/runs" \
  -H 'Content-Type: application/json' -H "X-Correlation-ID: ${CORR}" \
  -d "{\"bom_id\":\"${BOM_ID}\",\"work_center_id\":\"${WC_ID}\",\"quantity\":3}" >/dev/null
HITS=$(curl -s "http://localhost:${STUB_PORT}/__hits" | "$NODE_BIN" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).hits))')
[ "$HITS" = "1" ] && ok "IncidentAI ingest called exactly once for the correlation id" || bad "ingest called $HITS times"
LINK_COUNT=$(psql_q "SELECT count(*) FROM audit.incident_links WHERE correlation_id='${CORR}';")
[ "$LINK_COUNT" = "1" ] && ok "exactly one incident_links row for the correlation id" || bad "$LINK_COUNT link rows"

# ---------------------------------------------------------------------------
info "7. IncidentAI -> ERP status callback (IncidentAI vocabulary + ticket-shaped body)"
# 'TRIAGED' is IncidentAI's status once a developer picks up the ticket.
CB1=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:${PROD_PORT}/production/incident-callback/status" \
  -H 'Content-Type: application/json' -d "{\"correlation_id\":\"${CORR}\",\"status\":\"TRIAGED\"}")
S1=$(psql_q "SELECT incident_status FROM audit.incident_links WHERE correlation_id='${CORR}';")
[ "$CB1" = "200" ] && [ "$S1" = "IN_PROGRESS" ] && ok "callback 'TRIAGED' -> ERP IN_PROGRESS" || bad "TRIAGED gave HTTP $CB1 status $S1"

# 'VERIFIED' is a closed/resolved status in IncidentAI; ticket-shaped payload.
CB2=$(curl -s -o /tmp/erp_gp_cb.json -w '%{http_code}' -X POST "http://localhost:${PROD_PORT}/production/incident-callback/status" \
  -H 'Content-Type: application/json' \
  -d "{\"event\":\"ticket.updated\",\"ticket\":{\"id\":\"${R_INC}\",\"ticket_number\":\"TKT-1\",\"correlation_id\":\"${CORR}\",\"status\":\"VERIFIED\"}}")
[ "$CB2" = "200" ] && ok "ticket-shaped callback accepted (HTTP 200)" || bad "callback HTTP $CB2 :: $(cat /tmp/erp_gp_cb.json)"
NEW_STATUS=$(psql_q "SELECT incident_status FROM audit.incident_links WHERE correlation_id='${CORR}';")
[ "$NEW_STATUS" = "RESOLVED" ] && ok "callback 'VERIFIED' -> ERP incident status RESOLVED" || bad "status = $NEW_STATUS"

# ---------------------------------------------------------------------------
info "8. Persistence: fresh read of production runs shows the resolved incident"
RUNS=$(curl -s "http://localhost:${PROD_PORT}/production/runs")
RUN_INC_STATUS=$(echo "$RUNS" | "$NODE_BIN" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);const r=a.find(x=>x.id==="'"$R_TXN"'");console.log(r&&r.incident?r.incident.incident_status:"none")})')
[ "$RUN_INC_STATUS" = "RESOLVED" ] && ok "GET /production/runs joins incident status = RESOLVED" || bad "runs incident status = $RUN_INC_STATUS"

# ---------------------------------------------------------------------------
info "8b. Restart the production service — relationship + status survive"
lsof -ti "tcp:${PROD_PORT}" 2>/dev/null | xargs -r kill 2>/dev/null || true
sleep 3
( cd "$ROOT/backend/services/production" && env "${COMMON_ENV[@]}" \
    PRODUCTION_SERVICE_PORT=$PROD_PORT INVENTORY_SERVICE_URL="http://localhost:${INV_PORT}" \
    INCIDENTAI_INGEST_URL="http://localhost:${STUB_PORT}/api/incidents/ingest" \
    go run . > /tmp/erp_gp_prod2.log 2>&1 ) &
PIDS+=($!)
for i in $(seq 1 45); do curl -sf "http://localhost:${PROD_PORT}/health" >/dev/null 2>&1 && break; sleep 1; done
RS2=$(curl -s "http://localhost:${PROD_PORT}/production/runs" | "$NODE_BIN" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);const r=a.find(x=>x.id==="'"$R_TXN"'");console.log(r&&r.incident?(String(r.incident.incident_number||"?")+"/"+r.incident.incident_status):"none")})')
case "$RS2" in
  */RESOLVED) ok "after production-service restart: run still linked to incident, status still RESOLVED ($RS2)" ;;
  *) bad "after restart: $RS2" ;;
esac

# ---------------------------------------------------------------------------
info "8c. Rollback path: IncidentAI 'ROLLED_BACK' -> ERP ROLLED_BACK"
CBR=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:${PROD_PORT}/production/incident-callback/status" \
  -H 'Content-Type: application/json' -d "{\"incident_id\":\"${R_INC}\",\"status\":\"ROLLED_BACK\"}")
SR=$(psql_q "SELECT incident_status FROM audit.incident_links WHERE correlation_id='${CORR}';")
RUNSR=$(curl -s "http://localhost:${PROD_PORT}/production/runs" | "$NODE_BIN" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);const r=a.find(x=>x.id==="'"$R_TXN"'");console.log(r&&r.incident?r.incident.incident_status:"none")})')
[ "$CBR" = "200" ] && [ "$SR" = "ROLLED_BACK" ] && [ "$RUNSR" = "ROLLED_BACK" ] && ok "rollback: DB + GET /production/runs both show ROLLED_BACK" || bad "rollback gave HTTP $CBR db=$SR runs=$RUNSR"

# ---------------------------------------------------------------------------
info "9. Successful production run (qty 1 -> needs 100, have 250)"
OK_CORR="ERP-GP-OK-$(date +%s%N)"
OKRESP=$(curl -s -o /tmp/erp_gp_ok.json -w '%{http_code}' -X POST "http://localhost:${PROD_PORT}/production/runs" \
  -H 'Content-Type: application/json' -H "X-Correlation-ID: ${OK_CORR}" \
  -d "{\"bom_id\":\"${BOM_ID}\",\"work_center_id\":\"${WC_ID}\",\"quantity\":1}")
[ "$OKRESP" = "201" ] && ok "successful run accepted (HTTP 201)" || bad "expected 201, got $OKRESP :: $(cat /tmp/erp_gp_ok.json)"
CELLS_FINAL=$(psql_q "SELECT quantity FROM inventory.stock_levels s JOIN inventory.products p ON p.id=s.product_id WHERE p.sku='PROD-LITH-001';")
[ "$CELLS_FINAL" = "150.00" ] && ok "raw cell stock really deducted 250 -> 150" || bad "stock = $CELLS_FINAL (want 150.00)"
NO_INC=$(psql_q "SELECT count(*) FROM audit.incident_links WHERE correlation_id='${OK_CORR}';")
[ "$NO_INC" = "0" ] && ok "successful run created no incident" || bad "successful run created $NO_INC incident(s)"

# ---------------------------------------------------------------------------
echo
if [ "$fail" -eq 0 ]; then
  echo "${GRN}==== GOLDEN PATH: ${pass} passed, ${fail} failed ====${NC}"
  exit 0
else
  echo "${RED}==== GOLDEN PATH: ${pass} passed, ${fail} failed ====${NC}"
  exit 1
fi
