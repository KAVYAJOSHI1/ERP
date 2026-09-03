-- ============================================================================
-- DEMO SEED  —  master / display data for the GLS demo golden path
-- ----------------------------------------------------------------------------
-- Principle: "Seeded data for display is acceptable. Processing and state
-- changes must be real."  Everything below is static *master data* (catalog,
-- recipes, opening balances). All movement on top of it — stock adjustments,
-- production deductions, POs, ledger entries — is performed for real by the
-- Go services at runtime.
--
-- Fixed UUIDs so `docker compose down -v && docker compose up -d` reproduces
-- the exact demo scenario. Idempotent (safe to re-run manually).
--
-- Runs after: 03 (warehouse), 04 (vendor), 05 (work center).
--
-- Golden-path arithmetic (BOM = 100 raw cells per finished pack):
--   raw cells on hand ......... 250   (below reorder point 1000 -> auto-PO demo)
--   run of qty 1  -> needs 100 -> SUCCEEDS  (leaves 150)
--   run of qty 3  -> needs 300 -> REJECTED  ("Insufficient Materials")  <-- failure demo
-- ============================================================================

-- ---- Products (catalog / master data) --------------------------------------
INSERT INTO inventory.products (id, sku, name, unit, category, description) VALUES
  ('87b6c1ef-22c8-4663-9eff-cede3a5d4f75', 'PROD-LITH-001', '21700 Lithium-Ion Battery Cell', 'pieces', 'Raw Materials',
   'High-density 21700 lithium-ion cell. Primary input for battery-pack assembly.'),
  ('b98df12a-3532-4bf1-a6b1-0f8aa2c111ea', 'PROD-PACK-001', 'EV Battery Pack Module', 'pieces', 'Finished Goods',
   'Assembled EV battery-pack module. Yielded output of the Standard Battery Pack Assembly recipe.'),
  ('c0000000-0000-4000-8000-000000000010', 'PROD-CHAS-001', 'Vehicle Chassis Frame', 'pieces', 'Raw Materials',
   'Welded aluminium chassis frame.'),
  ('c0000000-0000-4000-8000-000000000011', 'PROD-BMS-001',  'Battery Management System Board', 'pieces', 'Raw Materials',
   'BMS controller board with cell-balancing firmware.'),
  ('c0000000-0000-4000-8000-000000000012', 'PROD-MOT-001',  'Traction Motor Assembly', 'pieces', 'Finished Goods',
   'Permanent-magnet traction motor assembly.')
ON CONFLICT (sku) DO NOTHING;

-- ---- Opening stock levels + reorder points ---------------------------------
-- warehouse = Main Warehouse (d9336520-...)
INSERT INTO inventory.stock_levels (product_id, warehouse_id, quantity, reserved_qty, reorder_point) VALUES
  ('87b6c1ef-22c8-4663-9eff-cede3a5d4f75', 'd9336520-cdb8-4cf8-b0b3-87da46820efc',  250.00, 0.00, 1000.00),
  ('b98df12a-3532-4bf1-a6b1-0f8aa2c111ea', 'd9336520-cdb8-4cf8-b0b3-87da46820efc',    6.00, 0.00,    2.00),
  ('c0000000-0000-4000-8000-000000000010', 'd9336520-cdb8-4cf8-b0b3-87da46820efc',  500.00, 0.00,   50.00),
  ('c0000000-0000-4000-8000-000000000011', 'd9336520-cdb8-4cf8-b0b3-87da46820efc',  120.00, 0.00,   40.00),
  ('c0000000-0000-4000-8000-000000000012', 'd9336520-cdb8-4cf8-b0b3-87da46820efc',   14.00, 0.00,    5.00)
ON CONFLICT (product_id, warehouse_id) DO NOTHING;

-- ---- Bill of Materials: Standard Battery Pack Assembly ---------------------
INSERT INTO production.bill_of_materials (id, product_id, name, version) VALUES
  ('77edf12a-3532-4bf1-a6b1-0f8aa2c8888e', 'b98df12a-3532-4bf1-a6b1-0f8aa2c111ea',
   'Standard Battery Pack Assembly', '1.0')
ON CONFLICT (id) DO NOTHING;

INSERT INTO production.bom_components (id, bom_id, raw_material_id, quantity_required) VALUES
  ('bc000000-0000-4000-8000-000000000001', '77edf12a-3532-4bf1-a6b1-0f8aa2c8888e',
   '87b6c1ef-22c8-4663-9eff-cede3a5d4f75', 100.0000)
ON CONFLICT (id) DO NOTHING;

-- ---- A live vendor quotation (drives auto-PO unit price) ------------------
INSERT INTO procurement.quotations (id, vendor_id, product_id, unit_price, valid_until) VALUES
  ('40000000-0000-4000-8000-000000000001', 'a1b2c3d4-0000-4000-8000-000000000001',
   '87b6c1ef-22c8-4663-9eff-cede3a5d4f75', 12.50, TIMESTAMPTZ '2030-12-31 00:00:00+00')
ON CONFLICT (id) DO NOTHING;
