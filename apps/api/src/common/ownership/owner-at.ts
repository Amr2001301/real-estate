/**
 * Who owned a contract at a given moment, from its transfers (تنازل).
 *
 * A payment made before the first transfer belongs to the first transfer's
 * previous owner; one made at or after a transfer, to that transfer's new
 * owner — the same split OwnershipService.depositOwnershipWhere applies to
 * customers' receipts. Null when the contract was never transferred (the
 * current customer owned it throughout).
 */
export interface TransferStep {
  fromCustomerId: string | null;
  toCustomerId: string | null;
  createdAt: Date;
}

/** `transfers` must be one contract's transfers in createdAt order. */
export function ownerIdAt(transfers: readonly TransferStep[], at: Date): string | null {
  if (transfers.length === 0) return null;
  let owner = transfers[0]!.fromCustomerId;
  for (const t of transfers) {
    if (t.createdAt > at) break;
    owner = t.toCustomerId;
  }
  return owner;
}
