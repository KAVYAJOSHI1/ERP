#!/bin/bash
echo "Starting Docker Infrastructure..."
docker compose up -d

echo "Starting Gateway..."
cd gateway
npm run dev > ../gateway.log 2>&1 &
echo $! > ../gateway.pid
cd ..

echo "Starting Auth Service..."
cd backend/services/auth
go run main.go > ../../../auth.log 2>&1 &
echo $! > ../../../auth.pid
cd ../../../

echo "Starting Inventory Service..."
cd backend/services/inventory
go run main.go > ../../../inventory.log 2>&1 &
echo $! > ../../../inventory.pid
cd ../../../

echo "Starting Procurement Service..."
cd backend/services/procurement
go run main.go > ../../../procurement.log 2>&1 &
echo $! > ../../../procurement.pid
cd ../../../

echo "Starting Finance Service..."
cd backend/services/finance
go run main.go > ../../../finance.log 2>&1 &
echo $! > ../../../finance.pid
cd ../../../

echo "Starting Intelligence Service..."
cd backend/services/intelligence
go run main.go > ../../../intelligence.log 2>&1 &
echo $! > ../../../intelligence.pid
cd ../../../

echo "Starting Production Service..."
cd backend/services/production
go run . > ../../../production.log 2>&1 &
echo $! > ../../../production.pid
cd ../../../

echo "Starting Frontend..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
echo $! > ../frontend.pid
cd ..

echo "All services started!"
echo "Check *.log for output."
echo "You can stop them by running: kill \$(cat *.pid)"
