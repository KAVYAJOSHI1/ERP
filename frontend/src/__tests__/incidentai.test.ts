import { describe, it, expect } from 'vitest';
import { incidentUrl, incidentStatusPresentation, INCIDENTAI_APP_URL } from '../lib/incidentai';

describe('incidentUrl', () => {
  it('never links to a bare homepage when an incident id is known', () => {
    const url = incidentUrl('INC-abc', 'TKT-9001');
    expect(url).toContain('incident=INC-abc');
    expect(url).toContain('ticket=TKT-9001');
    expect(url.startsWith(INCIDENTAI_APP_URL)).toBe(true);
  });

  it('is deterministic (same inputs -> same URL)', () => {
    expect(incidentUrl('INC-1', 'TKT-1')).toBe(incidentUrl('INC-1', 'TKT-1'));
  });

  it('falls back to the console root only when nothing is known', () => {
    expect(incidentUrl()).toBe(`${INCIDENTAI_APP_URL.replace(/\/+$/, '')}/`);
    expect(incidentUrl(null, null)).toBe(`${INCIDENTAI_APP_URL.replace(/\/+$/, '')}/`);
  });

  it('works with just an id (no ticket number)', () => {
    expect(incidentUrl('INC-x')).toContain('incident=INC-x');
  });
});

describe('incidentStatusPresentation', () => {
  it('maps the four ERP states to distinct labels', () => {
    expect(incidentStatusPresentation('OPEN').label).toBe('OPEN');
    expect(incidentStatusPresentation('IN_PROGRESS').label).toBe('IN PROGRESS');
    expect(incidentStatusPresentation('RESOLVED').label).toBe('RESOLVED');
    expect(incidentStatusPresentation('ROLLED_BACK').label).toBe('ROLLED BACK');
  });

  it('is case / space tolerant', () => {
    expect(incidentStatusPresentation('rolled back').label).toBe('ROLLED BACK');
    expect(incidentStatusPresentation('resolved').dot).toBe(incidentStatusPresentation('RESOLVED').dot);
  });

  it('falls back to PENDING for unknown / missing status', () => {
    expect(incidentStatusPresentation(undefined).label).toBe('PENDING');
    expect(incidentStatusPresentation('WAT').label).toBe('PENDING');
  });
});
