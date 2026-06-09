package telemetry

import "github.com/prometheus/client_golang/prometheus"

var (
	PurchaseOrdersTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "erp_procurement_purchase_orders_total",
			Help: "Total purchase orders created by source",
		},
		[]string{"source"}, // manual, auto
	)
	PurchaseOrderStatusUpdatesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "erp_procurement_purchase_order_status_updates_total",
			Help: "Total PO status transitions",
		},
		[]string{"status"},
	)
	VendorsCreatedTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "erp_procurement_vendors_created_total",
		Help: "Total vendors created",
	})
	AutoReorderTriggersTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "erp_procurement_auto_reorder_triggers_total",
		Help: "Total automated reorder POs generated from Kafka stock breach events",
	})
)

func init() {
	prometheus.MustRegister(
		PurchaseOrdersTotal,
		PurchaseOrderStatusUpdatesTotal,
		VendorsCreatedTotal,
		AutoReorderTriggersTotal,
	)
}
