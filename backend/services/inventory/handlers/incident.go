package handlers

import (
	"context"
	"log/slog"
	"time"

	"backend/pkg/incident"
	"inventory-service/config"
	"inventory-service/models"

	"github.com/gofiber/fiber/v2"
)

// IncidentReporter escalates ERP operational failures to IncidentAI. Wired from main().
var IncidentReporter *incident.Reporter

// escalateFailure reports an inventory operational failure to IncidentAI exactly
// once per correlation id and returns a JSON-ready view (or nil).
func escalateFailure(correlationID, transactionID, operation, productID, sku, errMsg string) fiber.Map {
	if IncidentReporter == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()

	link, err := IncidentReporter.Report(ctx, incident.FailureParams{
		CorrelationID: correlationID,
		TransactionID: transactionID,
		Module:        "Inventory",
		Operation:     operation,
		ProductID:     productID,
		SKU:           sku,
		Route:         "/inventory",
		ErrorMessage:  errMsg,
	})
	if err != nil {
		slog.Error("incident escalation", "correlation_id", correlationID, "operation", operation, "error", err.Error())
	}
	if link == nil {
		return nil
	}
	return incident.View(link)
}

func lookupSKU(productID string) string {
	if productID == "" || config.DB == nil {
		return ""
	}
	var p models.Product
	if err := config.DB.Select("sku").Where("id = ?", productID).First(&p).Error; err != nil {
		return ""
	}
	return p.SKU
}
