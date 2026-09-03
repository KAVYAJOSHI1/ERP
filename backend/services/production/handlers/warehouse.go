package handlers

import (
	"fmt"
	"os"
	"sync"

	"gorm.io/gorm"
)

// Warehouse resolution
// --------------------
// The warehouse used by production is resolved from persisted inventory state at
// runtime — never a hard-coded UUID. This keeps the service correct after
// `docker compose down -v && up` + a fresh seed, where the warehouse row is
// created by infra/postgres/init with a known id but the service must not assume
// that id.
//
// Resolution order:
//  1. env PRODUCTION_WAREHOUSE_NAME (default "Main Warehouse"), matched by name
//  2. the oldest warehouse row (first created)
// The result is cached for the process lifetime; a failed resolution is not
// cached so a transient DB issue can be retried.

const defaultWarehouseName = "Main Warehouse"

var (
	warehouseMu     sync.Mutex
	warehouseID     string
	warehouseCached bool
)

type warehouseRow struct {
	ID string
}

// ResolveWarehouseID returns the production warehouse id.
func ResolveWarehouseID(db *gorm.DB) (string, error) {
	warehouseMu.Lock()
	if warehouseCached {
		id := warehouseID
		warehouseMu.Unlock()
		return id, nil
	}
	warehouseMu.Unlock()

	id, err := lookupWarehouseID(db)
	if err != nil {
		return "", err
	}

	warehouseMu.Lock()
	warehouseID = id
	warehouseCached = true
	warehouseMu.Unlock()
	return id, nil
}

func lookupWarehouseID(db *gorm.DB) (string, error) {
	if db == nil {
		return "", fmt.Errorf("warehouse resolution: nil database handle")
	}

	name := os.Getenv("PRODUCTION_WAREHOUSE_NAME")
	if name == "" {
		name = defaultWarehouseName
	}

	var row warehouseRow

	// 1. Preferred: warehouse matched by name.
	if err := db.Table("inventory.warehouses").
		Select("id").
		Where("name = ? AND deleted_at IS NULL", name).
		Order("created_at asc").
		Limit(1).
		Scan(&row).Error; err != nil {
		return "", fmt.Errorf("warehouse resolution query failed: %w", err)
	}
	if row.ID != "" {
		return row.ID, nil
	}

	// 2. Fallback: the first warehouse that exists.
	if err := db.Table("inventory.warehouses").
		Select("id").
		Where("deleted_at IS NULL").
		Order("created_at asc").
		Limit(1).
		Scan(&row).Error; err != nil {
		return "", fmt.Errorf("warehouse resolution fallback query failed: %w", err)
	}
	if row.ID == "" {
		return "", fmt.Errorf("warehouse resolution: no rows in inventory.warehouses (is the database seeded?)")
	}
	return row.ID, nil
}

// resetWarehouseCacheForTest clears the cached resolution. Test-only.
func resetWarehouseCacheForTest() {
	warehouseMu.Lock()
	warehouseCached = false
	warehouseID = ""
	warehouseMu.Unlock()
}
