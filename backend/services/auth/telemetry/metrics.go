package telemetry

import "github.com/prometheus/client_golang/prometheus"

var (
	LoginsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "erp_auth_logins_total",
			Help: "Total login attempts by status",
		},
		[]string{"status"},
	)
	RegistrationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "erp_auth_registrations_total",
			Help: "Total registration attempts by status",
		},
		[]string{"status"},
	)
	TokenRefreshesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "erp_auth_token_refreshes_total",
			Help: "Total token refresh attempts by status",
		},
		[]string{"status"},
	)
	LogoutsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "erp_auth_logouts_total",
		Help: "Total logout operations",
	})
)

func init() {
	prometheus.MustRegister(
		LoginsTotal,
		RegistrationsTotal,
		TokenRefreshesTotal,
		LogoutsTotal,
	)
}
