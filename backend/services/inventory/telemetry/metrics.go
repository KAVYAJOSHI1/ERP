package telemetry

import "github.com/prometheus/client_golang/prometheus"

var (
	StockAdjustmentsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "erp_inventory_stock_adjustments_total",
			Help: "Total stock adjustment operations by type",
		},
		[]string{"type"},
	)
	ProductsCreatedTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "erp_inventory_products_created_total",
		Help: "Total products created",
	})
	WarehousesCreatedTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "erp_inventory_warehouses_created_total",
		Help: "Total warehouses created",
	})
	ReorderAlertsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "erp_inventory_reorder_alerts_total",
		Help: "Total times stock fell at or below reorder point after adjustment",
	})
)

func init() {
	prometheus.MustRegister(
		StockAdjustmentsTotal,
		ProductsCreatedTotal,
		WarehousesCreatedTotal,
		ReorderAlertsTotal,
	)
}
