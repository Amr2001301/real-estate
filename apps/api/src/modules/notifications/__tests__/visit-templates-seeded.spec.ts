import { NotificationChannel } from '@prisma/client';

/**
 * P3 — Pure-data assertion that every visit-lifecycle template is declared in
 * the seed array with ar + en subjects/bodies and a sensible channel. Avoids
 * spinning up the Prisma client; instead loads the seed module and parses
 * the literal template list out of source.
 *
 * If a code is added to the runtime but not the seed (or vice versa), this
 * test catches it at PR time.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SEED_PATH = join(__dirname, '../../../../prisma/seed.ts');
const REQUIRED_CODES = [
  'visit_request_created',
  'visit_scheduled',
  'visit_sales_assigned',
  'visit_customer_confirmed',
  'visit_customer_reschedule_requested',
  'visit_rescheduled',
  'visit_completed',
  'visit_cancelled',
  'visit_no_show',
  'visit_day_reminder',
  'visit_feedback_requested',
  'visit_feedback_received',
];

describe('Seed · visit lifecycle templates (P3)', () => {
  const seedSrc = readFileSync(SEED_PATH, 'utf8');

  // Each template block in seed.ts is delimited by the start of one `code:`
  // declaration and the start of the next (or the end-of-array `]`). Split
  // on the `code:` anchor and keep each segment that contains a required
  // visit code — that's the entire block including the body string with its
  // `{{placeholder}}` braces.
  const blocks: Record<string, string> = {};
  for (const code of REQUIRED_CODES) {
    const start = seedSrc.indexOf(`code: '${code}'`);
    if (start === -1) continue;
    // Find the next "code: '" or array-closing "]" — whichever comes first.
    const after = seedSrc.indexOf(`code: '`, start + code.length + 8);
    const arrayEnd = seedSrc.indexOf('].map((t)', start);
    const stop = after === -1
      ? arrayEnd
      : (arrayEnd === -1 ? after : Math.min(after, arrayEnd));
    blocks[code] = seedSrc.slice(start, stop > start ? stop : start + 600);
  }

  it.each(REQUIRED_CODES)('seeds %s with ar+en subject + body and a channel', (code) => {
    const block = blocks[code];
    expect(block).toBeDefined();
    expect(block).toMatch(/ar_subject:\s*'/);
    expect(block).toMatch(/en_subject:\s*'/);
    expect(block).toMatch(/ar_body:\s*'/);
    expect(block).toMatch(/en_body:\s*'/);
    expect(block).toMatch(/channel:\s*NotificationChannel\.(PUSH|IN_APP|EMAIL)/);
  });

  it('lists all visit codes (no drift between runtime call sites and seed)', () => {
    expect(Object.keys(blocks).sort()).toEqual([...REQUIRED_CODES].sort());
  });

  it('keeps channels appropriate (push for actionable / IN_APP for status)', () => {
    // Codes that the service wires as PUSH and that we want delivered
    // out-of-band when FCM is configured.
    const pushCodes = [
      'visit_scheduled',
      'visit_sales_assigned',
      'visit_rescheduled',
      'visit_cancelled',
      'visit_day_reminder',
    ];
    for (const code of pushCodes) {
      expect(blocks[code]).toMatch(
        new RegExp(`channel:\\s*NotificationChannel\\.${NotificationChannel.PUSH}`),
      );
    }
  });
});
