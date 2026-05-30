import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P4 — Pure-data assertion that every non-visit lifecycle template is
 * declared in the seed array with ar + en subjects/bodies and a sensible
 * channel. Parallels the P3 visit-templates test; both keep template drift
 * (service code uses a templateCode that's not in the seed → silent push
 * miss, since `send` would throw "Template X not found") out of the codebase.
 */

const SEED_PATH = join(__dirname, '../../../../prisma/seed.ts');
const REQUIRED_CODES = [
  // Info requests (P13)
  'info_request_created',
  // Reservations
  'reservation_submitted_admin',
  'reservation_status_changed',
  'reservation_booking_paid',
  // Contracts
  'contract_created_customer',
  'contract_signed_customer',
  'contract_document_available',
  'broker_contract_signed',
  'broker_contract_created',
  // Deposits
  'deposit_verified',
  // Installments
  'installment_plan_created',
  // Broker leads
  'broker_lead_approved',
  'broker_lead_rejected',
  'broker_lead_marked_duplicate',
  // Broker commissions
  'broker_commission_earned',
  'broker_commission_approved',
  'broker_commission_rejected',
  'broker_commission_cancelled',
  'broker_commission_paid',
  // Broker payouts
  'broker_payout_created',
  'broker_payout_approved',
  'broker_payout_processing',
  'broker_payout_paid',
  'broker_payout_cancelled',
];

describe('Seed · non-visit P4 templates', () => {
  const seedSrc = readFileSync(SEED_PATH, 'utf8');

  const blocks: Record<string, string> = {};
  for (const code of REQUIRED_CODES) {
    const start = seedSrc.indexOf(`code: '${code}'`);
    if (start === -1) continue;
    const after = seedSrc.indexOf(`code: '`, start + code.length + 8);
    const arrayEnd = seedSrc.indexOf('].map((t)', start);
    const stop =
      after === -1
        ? arrayEnd
        : arrayEnd === -1
          ? after
          : Math.min(after, arrayEnd);
    blocks[code] = seedSrc.slice(start, stop > start ? stop : start + 600);
  }

  it.each(REQUIRED_CODES)('seeds %s with ar+en subject + body and channel', (code) => {
    const block = blocks[code];
    expect(block).toBeDefined();
    expect(block).toMatch(/ar_subject:\s*'/);
    expect(block).toMatch(/en_subject:\s*'/);
    expect(block).toMatch(/ar_body:\s*'/);
    expect(block).toMatch(/en_body:\s*'/);
    expect(block).toMatch(/channel:\s*NotificationChannel\.(PUSH|IN_APP|EMAIL)/);
  });

  it('lists all required P4 codes — no drift between service call sites and seed', () => {
    expect(Object.keys(blocks).sort()).toEqual([...REQUIRED_CODES].sort());
  });
});
