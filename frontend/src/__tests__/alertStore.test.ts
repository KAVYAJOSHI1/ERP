/**
 * Run with: npx jest src/__tests__/alertStore.test.ts
 * Requires: npm install --save-dev jest @types/jest ts-jest jest-environment-jsdom
 */

import { useAlertStore } from '../lib/alertStore';

// crypto.randomUUID is not available in Node test environments by default
beforeAll(() => {
  let counter = 0;
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `test-id-${++counter}` },
    configurable: true,
  });
});

beforeEach(() => {
  useAlertStore.setState({ alerts: [] });
});

const sampleAlert = {
  type: 'THERMAL_SPIKE',
  pallet_id: 'PAL-LITH-001',
  sensor_id: 'SNS-BATT-001',
  location: 'Warehouse-Zone-A',
  temperature_c: 33.5,
  detected_at: '2026-06-10T12:00:00Z',
};

describe('useAlertStore', () => {
  it('starts with no alerts', () => {
    expect(useAlertStore.getState().alerts).toHaveLength(0);
  });

  it('addAlert appends to the front of the list', () => {
    const { addAlert } = useAlertStore.getState();
    addAlert(sampleAlert);
    const alerts = useAlertStore.getState().alerts;
    expect(alerts).toHaveLength(1);
    expect(alerts[0].pallet_id).toBe('PAL-LITH-001');
    expect(alerts[0].id).toBeDefined();
    expect(alerts[0].receivedAt).toBeGreaterThan(0);
  });

  it('latest alert appears first', () => {
    const { addAlert } = useAlertStore.getState();
    addAlert({ ...sampleAlert, pallet_id: 'PAL-001' });
    addAlert({ ...sampleAlert, pallet_id: 'PAL-002' });
    const alerts = useAlertStore.getState().alerts;
    expect(alerts[0].pallet_id).toBe('PAL-002');
  });

  it('dismissAlert removes the correct alert', () => {
    const { addAlert, dismissAlert } = useAlertStore.getState();
    addAlert(sampleAlert);
    const id = useAlertStore.getState().alerts[0].id;
    dismissAlert(id);
    expect(useAlertStore.getState().alerts).toHaveLength(0);
  });

  it('clearAll empties the store', () => {
    const { addAlert, clearAll } = useAlertStore.getState();
    addAlert(sampleAlert);
    addAlert(sampleAlert);
    clearAll();
    expect(useAlertStore.getState().alerts).toHaveLength(0);
  });

  it('caps at 50 alerts', () => {
    const { addAlert } = useAlertStore.getState();
    for (let i = 0; i < 60; i++) {
      addAlert({ ...sampleAlert, pallet_id: `PAL-${i}` });
    }
    expect(useAlertStore.getState().alerts).toHaveLength(50);
  });
});
