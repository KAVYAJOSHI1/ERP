package telemetry

import "github.com/prometheus/client_golang/prometheus"

var (
	ForecastRequestsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "erp_intelligence_forecast_requests_total",
		Help: "Total demand forecast API requests",
	})
	ForecastItemsReturned = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "erp_intelligence_forecast_items_returned",
		Help: "Number of product forecasts returned in the last request",
	})
	ForecastActionRequiredItems = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "erp_intelligence_action_required_items",
		Help: "Number of products currently requiring immediate procurement action",
	})
)

func init() {
	prometheus.MustRegister(
		ForecastRequestsTotal,
		ForecastItemsReturned,
		ForecastActionRequiredItems,
	)
}
