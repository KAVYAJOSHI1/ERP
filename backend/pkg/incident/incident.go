// Package incident is the ERP side of the ERP <-> IncidentAI link.
//
// When a real backend operation fails, a Go service calls Reporter.Report,
// which:
//
//  1. persists an audit.incident_links row (idempotent on the gateway
//     X-Correlation-ID — one failed operation, one incident, ever), and
//  2. escalates the failure to the existing IncidentAI ingest endpoint,
//     forwarding the ERP correlation id as the authoritative correlation id,
//     together with the transaction id, module, operation, SKU/product and the
//     real error message.
//
// The relationship is durable: the ERP keeps the incident id/number and its
// resolution status long after any UI toast disappears. IncidentAI advances the
// status through the gateway callback, which calls UpdateStatus.
package incident

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ERP-side incident lifecycle.
const (
	StatusOpen       = "OPEN"
	StatusInProgress = "IN_PROGRESS"
	StatusResolved   = "RESOLVED"
	StatusRolledBack = "ROLLED_BACK"
)

const defaultIngestURL = "http://localhost:4000/api/incidents/ingest"

// Link mirrors one audit.incident_links row.
type Link struct {
	ID               string    `gorm:"column:id;primaryKey;default:gen_random_uuid()" json:"id"`
	CorrelationID    string    `gorm:"column:correlation_id" json:"correlation_id"`
	TransactionID    string    `gorm:"column:transaction_id" json:"transaction_id"`
	Module           string    `gorm:"column:module" json:"module"`
	Operation        string    `gorm:"column:operation" json:"operation"`
	ProductID        string    `gorm:"column:product_id" json:"product_id,omitempty"`
	SKU              string    `gorm:"column:sku" json:"sku,omitempty"`
	Route            string    `gorm:"column:route" json:"route,omitempty"`
	ErrorMessage     string    `gorm:"column:error_message" json:"error_message"`
	IncidentID       string    `gorm:"column:incident_id" json:"incident_id"`
	IncidentNumber   string    `gorm:"column:incident_number" json:"incident_number"`
	IncidentStatus   string    `gorm:"column:incident_status" json:"incident_status"`
	IncidentAIStatus string    `gorm:"column:incident_ai_status" json:"incident_ai_status,omitempty"`
	Reporter         string    `gorm:"column:reporter" json:"reporter,omitempty"`
	CreatedAt        time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt        time.Time `gorm:"column:updated_at" json:"updated_at"`
}

// TableName pins the table across every service regardless of that service's
// GORM schema prefix (production./inventory./procurement.).
func (Link) TableName() string { return "audit.incident_links" }

// FailureParams describes one ERP operational failure.
type FailureParams struct {
	CorrelationID string // gateway X-Correlation-ID — required, used as the idempotency key
	TransactionID string // ERP domain row id (e.g. production_runs.id) if one was persisted
	Module        string // "Production" | "Inventory" | "Procurement"
	Operation     string // e.g. "production_run.create"
	ProductID     string // optional
	SKU           string // optional
	Route         string // ERP UI route for the return link, e.g. "/production"
	ErrorMessage  string // the real backend error text
	Reporter      string // optional; defaults to the automated ERP reporter
}

// Reporter escalates failures to IncidentAI and records the link.
type Reporter struct {
	db         *gorm.DB
	ingestURL  string
	httpClient *http.Client
}

// NewReporter builds a Reporter. The IncidentAI ingest URL comes from
// INCIDENTAI_INGEST_URL, defaulting to the local IncidentAI backend.
func NewReporter(db *gorm.DB) *Reporter {
	url := strings.TrimSpace(os.Getenv("INCIDENTAI_INGEST_URL"))
	if url == "" {
		url = defaultIngestURL
	}
	return &Reporter{
		db:         db,
		ingestURL:  url,
		httpClient: &http.Client{Timeout: 8 * time.Second},
	}
}

// DB exposes the underlying handle (helper for callers that also read links).
func (r *Reporter) DB() *gorm.DB { return r.db }

// Report escalates a failure exactly once per correlation id.
//
// The returned *Link is always non-nil on a successful persist even when
// IncidentAI is unreachable — in that case IncidentID is empty and a non-nil
// error is returned so the caller can log it; the row is retryable.
func (r *Reporter) Report(ctx context.Context, p FailureParams) (*Link, error) {
	if r == nil || r.db == nil {
		return nil, errors.New("incident: reporter not initialised")
	}
	if strings.TrimSpace(p.CorrelationID) == "" {
		return nil, errors.New("incident: correlation_id is required (idempotency key)")
	}
	if p.Reporter == "" {
		p.Reporter = "Smart Manufacturing ERP (automated)"
	}

	// 1. Idempotent insert keyed on correlation_id.
	row := Link{
		CorrelationID:  p.CorrelationID,
		TransactionID:  p.TransactionID,
		Module:         p.Module,
		Operation:      p.Operation,
		ProductID:      p.ProductID,
		SKU:            p.SKU,
		Route:          p.Route,
		ErrorMessage:   p.ErrorMessage,
		IncidentStatus: StatusOpen,
		Reporter:       p.Reporter,
	}
	if err := r.db.WithContext(ctx).
		Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "correlation_id"}}, DoNothing: true}).
		Create(&row).Error; err != nil {
		return nil, fmt.Errorf("incident: persist link: %w", err)
	}

	// 2. Load the authoritative row (ours, or one a concurrent request created).
	link, err := GetByCorrelation(r.db.WithContext(ctx), p.CorrelationID)
	if err != nil {
		return nil, fmt.Errorf("incident: reload link: %w", err)
	}
	if link == nil {
		return nil, errors.New("incident: link vanished after insert")
	}

	// Already escalated -> idempotent no-op.
	if link.IncidentID != "" {
		return link, nil
	}

	// 3. Escalate to IncidentAI, forwarding the ERP correlation id.
	incID, incNum, aiStatus, ingErr := r.ingest(ctx, *link)
	if ingErr != nil {
		return link, fmt.Errorf("incident: IncidentAI ingest failed (link persisted, retryable): %w", ingErr)
	}

	if err := r.db.WithContext(ctx).Model(&Link{}).
		Where("correlation_id = ? AND (incident_id IS NULL OR incident_id = '')", p.CorrelationID).
		Updates(map[string]any{
			"incident_id":        incID,
			"incident_number":    incNum,
			"incident_ai_status": aiStatus,
			"updated_at":         time.Now().UTC(),
		}).Error; err != nil {
		return link, fmt.Errorf("incident: record incident id: %w", err)
	}

	link.IncidentID = incID
	link.IncidentNumber = incNum
	link.IncidentAIStatus = aiStatus
	return link, nil
}

type ingestResponse struct {
	Ticket struct {
		ID            string `json:"id"`
		TicketNumber  string `json:"ticket_number"`
		Status        string `json:"status"`
		CorrelationID string `json:"correlation_id"`
	} `json:"ticket"`
}

func (r *Reporter) ingest(ctx context.Context, link Link) (id, number, aiStatus string, err error) {
	text := fmt.Sprintf("[AUTOMATED] %s operation %q was rejected by the Smart Manufacturing ERP backend: %s",
		link.Module, link.Operation, link.ErrorMessage)
	if link.SKU != "" {
		text += fmt.Sprintf(" (SKU %s)", link.SKU)
	}

	payload := map[string]any{
		"text":     text,
		"reporter": link.Reporter,
		// erp_context is z.any() on the IncidentAI side; correlation_id here is
		// treated by IncidentAI as the authoritative correlation id for the ticket.
		"erp_context": map[string]any{
			"erp":            "Smart Manufacturing ERP",
			"module":         link.Module,
			"operation":      link.Operation,
			"correlation_id": link.CorrelationID,
			"transaction_id": link.TransactionID,
			"record_id":      link.TransactionID,
			"product_id":     link.ProductID,
			"sku":            link.SKU,
			"route":          link.Route,
			"error_message":  link.ErrorMessage,
			"source":         "erp-backend-auto",
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
		},
	}

	buf, err := json.Marshal(payload)
	if err != nil {
		return "", "", "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, r.ingestURL, bytes.NewReader(buf))
	if err != nil {
		return "", "", "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", "", fmt.Errorf("IncidentAI ingest returned %d: %s", resp.StatusCode, truncate(string(body), 240))
	}

	var parsed ingestResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", "", "", fmt.Errorf("IncidentAI ingest: unparseable response: %w", err)
	}
	if parsed.Ticket.ID == "" {
		return "", "", "", errors.New("IncidentAI ingest: response missing ticket.id")
	}
	return parsed.Ticket.ID, parsed.Ticket.TicketNumber, parsed.Ticket.Status, nil
}

// View is a JSON-ready summary of a link for embedding in an API error body.
func View(link *Link) map[string]any {
	if link == nil {
		return nil
	}
	return map[string]any{
		"id":             link.IncidentID,
		"number":         link.IncidentNumber,
		"status":         link.IncidentStatus,
		"correlation_id": link.CorrelationID,
		"transaction_id": link.TransactionID,
		"route":          link.Route,
		"escalated":      link.IncidentID != "",
	}
}

// NormalizeStatus is the single, centralized mapping from an inbound IncidentAI
// ticket status onto the ERP-side incident lifecycle
// (OPEN | IN_PROGRESS | RESOLVED | ROLLED_BACK).
//
// It covers every value in IncidentAI's INCIDENT_STATUSES vocabulary
// (server/constants.js) plus a few defensive aliases. Unknown input -> (_, false).
//
//	IncidentAI ticket.status                                  ->  ERP incident_status
//	------------------------------------------------------------------------------
//	NEW, OPEN, INGESTED                                        ->  OPEN
//	TRIAGED, ASSIGNED, IN_PROGRESS, REMEDIATION_PENDING,       ->  IN_PROGRESS
//	  APPROVED, VERIFICATION, VERIFICATION_FAILED,
//	  ROLLBACK_REQUIRED, ESCALATED, BLOCKED, REOPENED,
//	  ACKNOWLEDGED, INVESTIGATING
//	RESOLVED, VERIFIED, KNOWLEDGE_CAPTURED,                    ->  RESOLVED
//	  SELF_SERVICE_RESOLVED, RESOLVED_DUPLICATE_MERGED,
//	  CLOSED, DONE
//	ROLLED_BACK, ROLLEDBACK, ROLLBACK, REVERTED               ->  ROLLED_BACK
func NormalizeStatus(s string) (string, bool) {
	switch strings.ToUpper(strings.TrimSpace(s)) {
	case "OPEN", "NEW", "INGESTED":
		return StatusOpen, true
	case "IN_PROGRESS", "INPROGRESS", "TRIAGED", "ASSIGNED", "REMEDIATION_PENDING",
		"APPROVED", "VERIFICATION", "VERIFICATION_FAILED", "ROLLBACK_REQUIRED",
		"ESCALATED", "BLOCKED", "REOPENED", "ACKNOWLEDGED", "INVESTIGATING":
		return StatusInProgress, true
	case "RESOLVED", "VERIFIED", "CLOSED", "KNOWLEDGE_CAPTURED", "SELF_SERVICE_RESOLVED",
		"RESOLVED_DUPLICATE_MERGED", "DONE":
		return StatusResolved, true
	case "ROLLED_BACK", "ROLLEDBACK", "ROLLBACK", "REVERTED":
		return StatusRolledBack, true
	}
	return "", false
}

// UpdateStatus advances the ERP-side incident status. Matches on correlation id
// and/or incident id. Returns the updated link.
func UpdateStatus(db *gorm.DB, correlationID, incidentID, rawStatus string) (*Link, error) {
	status, ok := NormalizeStatus(rawStatus)
	if !ok {
		return nil, fmt.Errorf("incident: unknown status %q (want OPEN|IN_PROGRESS|RESOLVED|ROLLED_BACK)", rawStatus)
	}
	correlationID = strings.TrimSpace(correlationID)
	incidentID = strings.TrimSpace(incidentID)
	if correlationID == "" && incidentID == "" {
		return nil, errors.New("incident: correlation_id or incident_id is required")
	}

	q := db.Model(&Link{})
	switch {
	case correlationID != "" && incidentID != "":
		q = q.Where("correlation_id = ? OR incident_id = ?", correlationID, incidentID)
	case correlationID != "":
		q = q.Where("correlation_id = ?", correlationID)
	default:
		q = q.Where("incident_id = ?", incidentID)
	}

	updates := map[string]any{"incident_status": status, "updated_at": time.Now().UTC()}
	if incidentID != "" {
		updates["incident_id"] = incidentID
	}

	res := q.Updates(updates)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, fmt.Errorf("incident: no link for correlation_id=%q incident_id=%q", correlationID, incidentID)
	}
	return GetOne(db, correlationID, incidentID)
}

// GetByCorrelation returns the link for a correlation id, or (nil, nil) if none.
func GetByCorrelation(db *gorm.DB, correlationID string) (*Link, error) {
	var l Link
	err := db.Where("correlation_id = ?", correlationID).Take(&l).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &l, nil
}

// GetOne returns the link matched by correlation id (preferred) or incident id.
func GetOne(db *gorm.DB, correlationID, incidentID string) (*Link, error) {
	var l Link
	q := db
	switch {
	case correlationID != "":
		q = q.Where("correlation_id = ?", correlationID)
	case incidentID != "":
		q = q.Where("incident_id = ?", incidentID)
	default:
		return nil, errors.New("incident: correlation_id or incident_id required")
	}
	if err := q.Take(&l).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &l, nil
}

// GetByTransactionIDs returns a map of transaction_id -> link for the given ids.
func GetByTransactionIDs(db *gorm.DB, txIDs []string) (map[string]*Link, error) {
	out := make(map[string]*Link)
	filtered := make([]string, 0, len(txIDs))
	for _, id := range txIDs {
		if strings.TrimSpace(id) != "" {
			filtered = append(filtered, id)
		}
	}
	if len(filtered) == 0 {
		return out, nil
	}
	var links []Link
	if err := db.Where("transaction_id IN ?", filtered).Find(&links).Error; err != nil {
		return nil, err
	}
	for i := range links {
		out[links[i].TransactionID] = &links[i]
	}
	return out, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
