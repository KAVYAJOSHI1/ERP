package main

import (
	"encoding/json"
	"testing"
	"time"
)

func TestIsThermalSpike(t *testing.T) {
	cases := []struct {
		temp    float64
		isSpike bool
	}{
		{19.9, false},
		{20.0, false},
		{23.5, false},
		{27.9, false},
		{28.0, true},  // exactly at threshold
		{30.5, true},
		{35.0, true},
	}
	for _, c := range cases {
		got := IsThermalSpike(c.temp)
		if got != c.isSpike {
			t.Errorf("IsThermalSpike(%.1f) = %v, want %v", c.temp, got, c.isSpike)
		}
	}
}

func TestCriticalAlertJSON(t *testing.T) {
	now := time.Date(2026, 6, 10, 12, 0, 0, 0, time.UTC)
	alert := CriticalAlert{
		Type:         "THERMAL_SPIKE",
		PalletID:     "PAL-LITH-001",
		SensorID:     "SNS-BATT-001",
		Location:     "Warehouse-Zone-A",
		TemperatureC: 33.5,
		DetectedAt:   now,
	}
	b, err := json.Marshal(alert)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}
	var decoded CriticalAlert
	if err := json.Unmarshal(b, &decoded); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if decoded.Type != "THERMAL_SPIKE" {
		t.Errorf("Type = %q, want THERMAL_SPIKE", decoded.Type)
	}
	if decoded.TemperatureC != 33.5 {
		t.Errorf("TemperatureC = %v, want 33.5", decoded.TemperatureC)
	}
	if decoded.PalletID != "PAL-LITH-001" {
		t.Errorf("PalletID = %q, want PAL-LITH-001", decoded.PalletID)
	}
}

func TestTelemetryPayloadUnmarshal(t *testing.T) {
	raw := `{"sensor_id":"SNS-001","pallet_id":"PAL-001","location":"Zone-A","temperature_c":31.2,"timestamp":"2026-06-10T12:00:00Z"}`
	var p TelemetryPayload
	if err := json.Unmarshal([]byte(raw), &p); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if !IsThermalSpike(p.TemperatureC) {
		t.Errorf("expected 31.2°C to be a thermal spike")
	}
	if p.PalletID != "PAL-001" {
		t.Errorf("PalletID = %q, want PAL-001", p.PalletID)
	}
}
