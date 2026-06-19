#!/bin/bash
set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0;30m' # No Color
RESET='\033[0m'

echo -e "${CYAN}=== Smart ERP Shop Floor E2E Integration Tester ===${RESET}"

# Configure database details
export PGPASSWORD=erp_password
DB_CMD="psql -h localhost -p 5435 -U erp_user -d erp_db -t -A -c"

# 1. Fetch initial stock levels
RAW_CELL_ID="87b6c1ef-22c8-4663-9eff-cede3a5d4f75"
FIN_PACK_ID="b98df12a-3532-4bf1-a6b1-0f8aa2c111ea"

INIT_CELL_QTY=$($DB_CMD "SELECT quantity FROM inventory.stock_levels WHERE product_id = '$RAW_CELL_ID';")
INIT_PACK_QTY=$($DB_CMD "SELECT quantity FROM inventory.stock_levels WHERE product_id = '$FIN_PACK_ID';")

echo -e "Initial Raw Material Cells Stock: ${YELLOW}${INIT_CELL_QTY}${RESET}"
echo -e "Initial Finished Battery Packs Stock: ${YELLOW}${INIT_PACK_QTY}${RESET}"

if (( $(echo "$INIT_CELL_QTY < 100" | bc -l) )); then
    echo -e "${YELLOW}[System Adjust] Low raw cells. Replenishing 500 cells for test...${RESET}"
    $DB_CMD "UPDATE inventory.stock_levels SET quantity = quantity + 500 WHERE product_id = '$RAW_CELL_ID';"
    INIT_CELL_QTY=$($DB_CMD "SELECT quantity FROM inventory.stock_levels WHERE product_id = '$RAW_CELL_ID';")
    echo -e "Updated Raw Material Cells Stock: ${YELLOW}${INIT_CELL_QTY}${RESET}"
fi

# 2. Dispatch a Production Run (1 Battery Pack)
BOM_ID="77edf12a-3532-4bf1-a6b1-0f8aa2c8888e"
WC_ID="338ca798-16ca-4485-be77-29c1b2fb49e5"

echo -e "\n${CYAN}[Action] Dispatching production run of 1 Battery Pack...${RESET}"
RESPONSE=$(curl -s -X POST http://localhost:8085/production/runs \
  -H "Content-Type: application/json" \
  -d "{\"bom_id\": \"$BOM_ID\", \"work_center_id\": \"$WC_ID\", \"quantity\": 1}")

RUN_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | grep -o '[^"]*$')
STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*' | grep -o '[^"]*$')

if [ -z "$RUN_ID" ]; then
    echo -e "${RED}[ERROR] Failed to dispatch production run. Response: $RESPONSE${RESET}"
    exit 1
fi

echo -e "Production Run Dispatched! ID: ${GREEN}$RUN_ID${RESET}, Status: ${GREEN}$STATUS${RESET}"

# 3. Verify immediate material deduction in inventory
MID_CELL_QTY=$($DB_CMD "SELECT quantity FROM inventory.stock_levels WHERE product_id = '$RAW_CELL_ID';")
EXPECTED_CELLS=$(echo "$INIT_CELL_QTY - 100" | bc -l)

echo -e "Verifying inventory deduction..."
if (( $(echo "$MID_CELL_QTY == $EXPECTED_CELLS" | bc -l) )); then
    echo -e "${GREEN}[SUCCESS] Raw cells successfully deducted! Current: $MID_CELL_QTY (Expected: $EXPECTED_CELLS)${RESET}"
else
    echo -e "${RED}[FAILURE] Inventory deduction failed. Current: $MID_CELL_QTY (Expected: $EXPECTED_CELLS)${RESET}"
fi

# 4. Wait for simulated completion time (30 seconds + leeway)
echo -e "\n${YELLOW}[Simulation] Waiting 37 seconds for shop floor assembly to complete...${RESET}"
for i in {37..1}; do
    printf "\rTime remaining: %2d seconds" $i
    sleep 1
done
echo -e "\n"

# 5. Check updated status
FINAL_RUN_STATUS=$($DB_CMD "SELECT status FROM production.production_runs WHERE id = '$RUN_ID';")
echo -e "Production Run Final Status: ${GREEN}${FINAL_RUN_STATUS}${RESET}"

# 6. Verify final finished product stock increase
FINAL_PACK_QTY=$($DB_CMD "SELECT quantity FROM inventory.stock_levels WHERE product_id = '$FIN_PACK_ID';")
EXPECTED_PACKS=$(echo "$INIT_PACK_QTY + 1" | bc -l)

if (( $(echo "$FINAL_PACK_QTY == $EXPECTED_PACKS" | bc -l) )); then
    echo -e "${GREEN}[SUCCESS] Finished Goods stock increased! Current: $FINAL_PACK_QTY (Expected: $EXPECTED_PACKS)${RESET}"
else
    echo -e "${RED}[FAILURE] Finished Goods stock not updated. Current: $FINAL_PACK_QTY (Expected: $EXPECTED_PACKS)${RESET}"
fi

# 7. Check if replenishment PO was auto-generated
echo -e "\n${CYAN}Checking Auto-Procurement Integration...${RESET}"
RECENT_PO_ID=$($DB_CMD "SELECT po_id FROM procurement.po_line_items WHERE product_id = '$RAW_CELL_ID' OR product_id = '$FIN_PACK_ID' ORDER BY created_at DESC LIMIT 1;")

if [ -n "$RECENT_PO_ID" ]; then
    PO_STATUS=$($DB_CMD "SELECT status FROM procurement.purchase_orders WHERE id = '$RECENT_PO_ID';")
    echo -e "${GREEN}[SUCCESS] Found active replenishment PO: $RECENT_PO_ID (Status: $PO_STATUS)${RESET}"
else
    echo -e "${YELLOW}[NOTE] No new replenishment PO detected. This might be due to existing inventory levels or consumer group lag.${RESET}"
fi

echo -e "\n${GREEN}=== E2E Test Completed ===${RESET}"
