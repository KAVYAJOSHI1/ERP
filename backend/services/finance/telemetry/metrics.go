package telemetry

import "github.com/prometheus/client_golang/prometheus"

var (
	InvoicesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "erp_finance_invoices_total",
			Help: "Total invoices processed by status",
		},
		[]string{"status"},
	)
	LedgerEntriesTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "erp_finance_ledger_entries_total",
		Help: "Total double-entry ledger postings recorded",
	})
	InvoicePDFUploadsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "erp_finance_invoice_pdf_uploads_total",
			Help: "Total invoice PDF uploads to MinIO by status",
		},
		[]string{"status"},
	)
	InvoicedAmountTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "erp_finance_invoiced_amount_total",
		Help: "Total monetary amount invoiced (USD)",
	})
)

func init() {
	prometheus.MustRegister(
		InvoicesTotal,
		LedgerEntriesTotal,
		InvoicePDFUploadsTotal,
		InvoicedAmountTotal,
	)
}
