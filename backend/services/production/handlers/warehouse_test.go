package handlers

import (
	"os"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set — skipping DB-backed warehouse test")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	return db
}

func TestResolveWarehouseID_FromSeededDatabase(t *testing.T) {
	db := testDB(t)
	resetWarehouseCacheForTest()
	t.Setenv("PRODUCTION_WAREHOUSE_NAME", "Main Warehouse")

	id, err := ResolveWarehouseID(db)
	if err != nil {
		t.Fatalf("ResolveWarehouseID: %v", err)
	}
	if id == "" {
		t.Fatal("resolved empty warehouse id")
	}

	// Must match the actual row, not a hard-coded constant.
	var want string
	if err := db.Table("inventory.warehouses").
		Select("id").Where("name = ?", "Main Warehouse").
		Order("created_at asc").Limit(1).Scan(&want).Error; err != nil {
		t.Fatalf("lookup expected id: %v", err)
	}
	if id != want {
		t.Errorf("resolved %q, want %q (the seeded Main Warehouse row)", id, want)
	}

	// Cached on the second call.
	resetWarehouseCacheForTest()
	id2, err := ResolveWarehouseID(db)
	if err != nil || id2 != id {
		t.Errorf("second resolution = (%q,%v), want (%q,nil)", id2, err, id)
	}
}

func TestResolveWarehouseID_FallsBackToFirstWarehouse(t *testing.T) {
	db := testDB(t)
	resetWarehouseCacheForTest()
	t.Setenv("PRODUCTION_WAREHOUSE_NAME", "No Such Warehouse Name 12345")

	id, err := ResolveWarehouseID(db)
	if err != nil {
		t.Fatalf("ResolveWarehouseID (fallback): %v", err)
	}

	var want string
	if err := db.Table("inventory.warehouses").
		Select("id").Where("deleted_at IS NULL").
		Order("created_at asc").Limit(1).Scan(&want).Error; err != nil {
		t.Fatalf("lookup first warehouse: %v", err)
	}
	if id != want {
		t.Errorf("fallback resolved %q, want first warehouse %q", id, want)
	}
	resetWarehouseCacheForTest()
}
