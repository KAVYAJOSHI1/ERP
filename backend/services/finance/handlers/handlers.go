package handlers

import (
	"finance-service/config"
	"finance-service/models"

	"github.com/gofiber/fiber/v2"
)

func GetAccounts(c *fiber.Ctx) error {
	var accounts []models.Account
	if err := config.DB.Order("name asc").Find(&accounts).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(accounts)
}

func GetLedgerEntries(c *fiber.Ctx) error {
	var entries []models.LedgerEntry
	if err := config.DB.Preload("Account").Order("created_at desc").Limit(100).Find(&entries).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(entries)
}

func GetInvoices(c *fiber.Ctx) error {
	var invoices []models.Invoice
	if err := config.DB.Order("issued_at desc").Find(&invoices).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(invoices)
}
