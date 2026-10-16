import { ownerIdAt } from '../owner-at';

const d = (s: string) => new Date(`2026-${s}T00:00:00Z`);

describe('ownerIdAt', () => {
  const transfers = [
    { fromCustomerId: 'a', toCustomerId: 'b', createdAt: d('03-01') },
    { fromCustomerId: 'b', toCustomerId: 'c', createdAt: d('06-01') },
  ];

  it('is null for a contract never transferred', () => {
    expect(ownerIdAt([], d('01-01'))).toBeNull();
  });

  it('gives the first owner before the first transfer', () => {
    expect(ownerIdAt(transfers, d('02-15'))).toBe('a');
  });

  it('gives the new owner from the moment of a transfer on', () => {
    expect(ownerIdAt(transfers, d('03-01'))).toBe('b');
    expect(ownerIdAt(transfers, d('05-31'))).toBe('b');
    expect(ownerIdAt(transfers, d('06-02'))).toBe('c');
  });
});
