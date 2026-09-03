package handlers

import (
	"context"
	"log/slog"
	"time"

	"backend/pkg/incident"
	"production-service/config"

	"github.com/gofiber/fiber/v2"
)

// IncidentReporter escalates ERP operational failures to IncidentAI.
// Wired from main(); nil in unit tests that don't exercise escalation.
var IncidentReporter *incident.Reporter

// escalateFailure reports a backend failure to IncidentAI exactly once per
// correlation id and returns a JSON-ready view of the resulting link (or nil if
// no reporter is configured). It never blocks the caller from responding: an
// unreachable IncidentAI still yields a persisted link with escalated=false.
func escalateFailure(correlationID, transactionID, operation, productID, sku, route, errMsg string) fiber.Map {
	if IncidentReporter == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()

	link, err := IncidentReporter.Report(ctx, incident.FailureParams{
		CorrelationID: correlationID,
		TransactionID: transactionID,
		Module:        "Production",
		Operation:     operation,
		ProductID:     productID,
		SKU:           sku,
		Route:         route,
		ErrorMessage:  errMsg,
	})
	if err != nil {
		slog.Error("incident escalation", "correlation_id", correlationID, "operation", operation, "error", err.Error())
	}
	if link == nil {
		return nil
	}
	return incidentView(link)
}

func incidentView(link *incident.Link) fiber.Map {
	return fiber.Map{
		"id":             link.IncidentID,
		"number":         link.IncidentNumber,
		"status":         link.IncidentStatus,
		"correlation_id": link.CorrelationID,
		"transaction_id": link.TransactionID,
		"route":          link.Route,
		"escalated":      link.IncidentID != "",
	}
}

// lookupSKU best-effort resolves a product SKU from the inventory schema.
func lookupSKU(productID string) string {
	if productID == "" || config.DB == nil {
		return ""
	}
	var row struct{ SKU string }
	config.DB.Table("inventory.products").Select("sku").Where("id = ?", productID).Scan(&row)
	return row.SKU
}

// IncidentCallbackStatus is the endpoint IncidentAI calls (through the gateway's
// secret-guarded POST /api/incident-callback/status route) to advance the
// ERP-side status of an incident that originated from an ERP operation.
//
// It accepts BOTH the flat shape and a ticket-shaped payload, so a real
// IncidentAI webhook can post its own ticket object verbatim:
//
//	FLAT (what scripts/incident_status_push.sh sends):
//	  { "correlation_id": "<uuid>", "incident_id": "INC-...", "status": "RESOLVED" }
//
//	TICKET-SHAPED (an IncidentAI ticket object / webhook body):
//	  { "ticket": { "id": "INC-...", "ticket_number": "TKT-9001",
//	                "correlation_id": "<uuid>", "status": "VERIFIED" } }
//	  { "event": "ticket.updated", "ticket": { ... } }
//
// `status` is IncidentAI's own vocabulary; incident.NormalizeStatus maps every
// INCIDENT_STATUSES value onto OPEN | IN_PROGRESS | RESOLVED | ROLLED_BACK:
//
//	NEW / OPEN                                   -> OPEN
//	TRIAGED / ASSIGNED / IN_PROGRESS /           -> IN_PROGRESS
//	  REMEDIATION_PENDING / APPROVED /
//	  VERIFICATION / VERIFICATION_FAILED /
//	  ROLLBACK_REQUIRED / ESCALATED / BLOCKED / REOPENED
//	RESOLVED / VERIFIED / KNOWLEDGE_CAPTURED /   -> RESOLVED
//	  SELF_SERVICE_RESOLVED / CLOSED /
//	  RESOLVED_DUPLICATE_MERGED
//	ROLLED_BACK                                  -> ROLLED_BACK
func IncidentCallbackStatus(c *fiber.Ctx) error {
	type ticketShape struct {
		ID            string `json:"id"`
		TicketNumber  string `json:"ticket_number"`
		CorrelationID string `json:"correlation_id"`
		Status        string `json:"status"`
	}
	var body struct {
		CorrelationID string      `json:"correlation_id"`
		IncidentID    string      `json:"incident_id"`
		Status        string      `json:"status"`
		Ticket        ticketShape `json:"ticket"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	correlationID, incidentID, status := body.CorrelationID, body.IncidentID, body.Status
	if correlationID == "" {
		correlationID = body.Ticket.CorrelationID
	}
	if incidentID == "" {
		incidentID = body.Ticket.ID
	}
	if status == "" {
		status = body.Ticket.Status
	}

	if status == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "status is required"})
	}
	if correlationID == "" && incidentID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "correlation_id or incident_id is required"})
	}

	link, err := incident.UpdateStatus(config.DB, correlationID, incidentID, status)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not Found", "message": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "incident status updated", "incident": incidentView(link)})
}

// GetIncidentLink lets the ERP UI read the current status of an incident tied to
// an operation.  GET /production/incident-links?correlation_id=... | ?incident_id=...
func GetIncidentLink(c *fiber.Ctx) error {
	correlationID := c.Query("correlation_id")
	incidentID := c.Query("incident_id")
	if correlationID == "" && incidentID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "correlation_id or incident_id is required"})
	}
	link, err := incident.GetOne(config.DB, correlationID, incidentID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": err.Error()})
	}
	if link == nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not Found", "message": "no incident link found"})
	}
	return c.JSON(link)
}
