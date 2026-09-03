import { beforeEach, describe, it, expect } from 'vitest';
import { useOpStatusStore } from '../lib/opStatusStore';

beforeEach(() => {
  useOpStatusStore.setState({ items: [], lastCorrelationId: null });
});

describe('useOpStatusStore', () => {
  it('push adds an entry to the front and stamps id/ts', () => {
    useOpStatusStore.getState().push({ kind: 'success', title: 'ok' });
    const items = useOpStatusStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].id).toBeTruthy();
    expect(items[0].ts).toBeGreaterThan(0);
  });

  it('remembers the correlation id from a failure so a later manual report can reuse it', () => {
    useOpStatusStore.getState().push({
      kind: 'error',
      title: 'Insufficient Materials',
      incident: { correlation_id: 'ERP-CORR-42', status: 'OPEN', id: 'INC-1', escalated: true },
    });
    expect(useOpStatusStore.getState().lastCorrelationId).toBe('ERP-CORR-42');
  });

  it('caps the feed at 4 entries, newest first', () => {
    for (let i = 0; i < 7; i++) {
      useOpStatusStore.getState().push({ kind: 'error', title: `e${i}` });
    }
    const items = useOpStatusStore.getState().items;
    expect(items).toHaveLength(4);
    expect(items[0].title).toBe('e6');
  });

  it('dismiss removes the right entry; clear empties the feed', () => {
    useOpStatusStore.getState().push({ kind: 'error', title: 'a' });
    useOpStatusStore.getState().push({ kind: 'error', title: 'b' });
    const idA = useOpStatusStore.getState().items.find((i) => i.title === 'a')!.id;
    useOpStatusStore.getState().dismiss(idA);
    expect(useOpStatusStore.getState().items.map((i) => i.title)).toEqual(['b']);
    useOpStatusStore.getState().clear();
    expect(useOpStatusStore.getState().items).toHaveLength(0);
  });
});
