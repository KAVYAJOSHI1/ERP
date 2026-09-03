package incident

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestNormalizeStatus(t *testing.T) {
	// Every value in IncidentAI's INCIDENT_STATUSES vocabulary (server/constants.js)
	// plus the closed-status set and defensive aliases.
	cases := map[string]string{
		// -> OPEN
		"NEW": StatusOpen, "open": StatusOpen, "INGESTED": StatusOpen,
		// -> IN_PROGRESS
		"TRIAGED": StatusInProgress, "ASSIGNED": StatusInProgress, "IN_PROGRESS": StatusInProgress,
		"REMEDIATION_PENDING": StatusInProgress, "APPROVED": StatusInProgress,
		"VERIFICATION": StatusInProgress, "VERIFICATION_FAILED": StatusInProgress,
		"ROLLBACK_REQUIRED": StatusInProgress, "ESCALATED": StatusInProgress,
		"BLOCKED": StatusInProgress, "REOPENED": StatusInProgress,
		// -> RESOLVED
		"RESOLVED": StatusResolved, "VERIFIED": StatusResolved, "KNOWLEDGE_CAPTURED": StatusResolved,
		"SELF_SERVICE_RESOLVED": StatusResolved, "RESOLVED_DUPLICATE_MERGED": StatusResolved,
		"CLOSED": StatusResolved,
		// -> ROLLED_BACK
		"ROLLED_BACK": StatusRolledBack, "rollback": StatusRolledBack, "REVERTED": StatusRolledBack,
	}
	for in, want := range cases {
		got, ok := NormalizeStatus(in)
		if !ok || got != want {
			t.Errorf("NormalizeStatus(%q) = (%q,%v), want (%q,true)", in, got, ok, want)
		}
	}
	if _, ok := NormalizeStatus("banana"); ok {
		t.Error("NormalizeStatus(banana) should not be recognised")
	}
	if _, ok := NormalizeStatus(""); ok {
		t.Error("NormalizeStatus(empty) should not be recognised")
	}
}

// fakeIncidentAI returns a stub of the IncidentAI ingest endpoint and counts hits.
func fakeIncidentAI(t *testing.T, hits *int64) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt64(hits, 1)
		body, _ := io.ReadAll(r.Body)
		var parsed struct {
			Text       string                 `json:"text"`
			ERPContext map[string]interface{} `json:"erp_context"`
		}
		_ = json.Unmarshal(body, &parsed)
		if parsed.ERPContext["correlation_id"] == "" || parsed.ERPContext["correlation_id"] == nil {
			t.Errorf("ingest payload missing erp_context.correlation_id: %s", body)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ticket": map[string]any{
				"id":             "INC-test-" + parsed.ERPContext["correlation_id"].(string),
				"ticket_number":  "TKT-9001",
				"status":         "TRIAGED",
				"correlation_id": parsed.ERPContext["correlation_id"],
			},
		})
	}))
}

// testDB connects to TEST_DATABASE_URL (a fresh, seeded Postgres) or skips.
func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set — skipping DB-backed incident test")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	return db
}

func TestReport_PersistsLinkAndForwardsCorrelationID(t *testing.T) {
	db := testDB(t)
	var hits int64
	srv := fakeIncidentAI(t, &hits)
	defer srv.Close()

	corr := "TEST-CORR-" + time.Now().Format("150405.000000")
	db.Exec("DELETE FROM audit.incident_links WHERE correlation_id = ?", corr)

	r := &Reporter{db: db, ingestURL: srv.URL, httpClient: srv.Client()}

	link, err := r.Report(context.Background(), FailureParams{
		CorrelationID: corr,
		TransactionID: "run-abc-123",
		Module:        "Production",
		Operation:     "production_run.create",
		ProductID:     "prod-1",
		SKU:           "PROD-LITH-001",
		Route:         "/production",
		ErrorMessage:  "Insufficient stock: cannot make inventory level negative",
	})
	if err != nil {
		t.Fatalf("Report: %v", err)
	}
	if link.IncidentID == "" {
		t.Fatal("expected incident_id to be recorded")
	}
	if link.IncidentStatus != StatusOpen {
		t.Errorf("incident_status = %q, want OPEN", link.IncidentStatus)
	}
	if link.IncidentID != "INC-test-"+corr {
		t.Errorf("incident_id = %q, want INC-test-%s (correlation id must be authoritative)", link.IncidentID, corr)
	}

	// Idempotency: a second Report for the same correlation id must NOT hit IncidentAI again.
	link2, err := r.Report(context.Background(), FailureParams{
		CorrelationID: corr, Module: "Production", Operation: "production_run.create",
		ErrorMessage: "duplicate call",
	})
	if err != nil {
		t.Fatalf("second Report: %v", err)
	}
	if link2.IncidentID != link.IncidentID {
		t.Errorf("idempotency broken: %q != %q", link2.IncidentID, link.IncidentID)
	}
	if got := atomic.LoadInt64(&hits); got != 1 {
		t.Errorf("IncidentAI ingest called %d times, want exactly 1", got)
	}

	// Status update round-trip: IN_PROGRESS (from an IncidentAI "TRIAGED" callback).
	if u, err := UpdateStatus(db, corr, "", "TRIAGED"); err != nil || u.IncidentStatus != StatusInProgress {
		t.Fatalf("UpdateStatus(TRIAGED) -> (%v, %v), want IN_PROGRESS", u, err)
	}

	// -> RESOLVED (from an IncidentAI "VERIFIED" callback).
	updated, err := UpdateStatus(db, corr, "", "VERIFIED")
	if err != nil {
		t.Fatalf("UpdateStatus(VERIFIED): %v", err)
	}
	if updated.IncidentStatus != StatusResolved {
		t.Errorf("after UpdateStatus(VERIFIED), status = %q, want RESOLVED", updated.IncidentStatus)
	}

	// Persistence: a fresh read still shows RESOLVED.
	reread, err := GetByCorrelation(db, corr)
	if err != nil || reread == nil {
		t.Fatalf("GetByCorrelation: %v", err)
	}
	if reread.IncidentStatus != StatusResolved {
		t.Errorf("persisted status = %q, want RESOLVED", reread.IncidentStatus)
	}

	// -> ROLLED_BACK (from an IncidentAI "ROLLED_BACK" callback).
	if u, err := UpdateStatus(db, corr, "", "ROLLED_BACK"); err != nil || u.IncidentStatus != StatusRolledBack {
		t.Fatalf("UpdateStatus(ROLLED_BACK) -> (%v, %v), want ROLLED_BACK", u, err)
	}
	if rr, _ := GetByCorrelation(db, corr); rr == nil || rr.IncidentStatus != StatusRolledBack {
		t.Errorf("persisted status = %v, want ROLLED_BACK", rr)
	}

	db.Exec("DELETE FROM audit.incident_links WHERE correlation_id = ?", corr)
}

func TestReport_IngestFailureIsNonFatal(t *testing.T) {
	db := testDB(t)
	down := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer down.Close()

	corr := "TEST-CORR-DOWN-" + time.Now().Format("150405.000000")
	db.Exec("DELETE FROM audit.incident_links WHERE correlation_id = ?", corr)

	r := &Reporter{db: db, ingestURL: down.URL, httpClient: down.Client()}
	link, err := r.Report(context.Background(), FailureParams{
		CorrelationID: corr, Module: "Inventory", Operation: "stock.adjust",
		ErrorMessage: "boom",
	})
	if err == nil {
		t.Error("expected a non-nil (retryable) error when IncidentAI is down")
	}
	if link == nil || link.CorrelationID != corr {
		t.Fatal("link row must still be persisted when IncidentAI is unreachable")
	}
	if link.IncidentID != "" {
		t.Error("incident_id should be empty when ingest failed")
	}

	db.Exec("DELETE FROM audit.incident_links WHERE correlation_id = ?", corr)
}
