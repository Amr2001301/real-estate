/**
 * Flow E — Customer financial + signed documents (system QA strategy §E).
 *
 * Asserts the customer financial surface (`/me/contracts`, `/me/deposits`,
 * `/me/documents`) is correctly scoped + the signed-download path is the
 * only way a customer can ever get a URL for a private file. Each test
 * reads pre-seeded fixtures (one contract + one deposit per customer, one
 * CUSTOMER_VISIBLE document per contract); the suite is read-only so no
 * cleanup is needed.
 *
 * Audit reference: `src/modules/documents/me-documents.module.ts`,
 * `src/common/ownership/ownership.service.ts`,
 * `src/modules/contracts/contracts.controller.ts`,
 * `src/modules/deposits/deposits.controller.ts`.
 *
 * Mapping back to the §E test matrix:
 *   E1  — Customer reads /me/deposits, sees their own
 *   E2  — Customer reads /me/contracts, sees their own
 *   E3  — Customer reads /me/documents?ownerType=CONTRACT&ownerId=…
 *   E4  — Signed download returns {url, fileName, contentType, expiresIn}
 *   E5  — Signed-download response does NOT include a raw permanent URL
 *         (it contains only the AWS-signed URL with X-Amz-Signature)
 *   E6  — Customer1 cannot list customer2's documents — cross-account 404
 *   E7  — Customer1 cannot download customer2's document — cross-account 404
 *   E8  — Customer1's /me/deposits does NOT include customer2's deposits
 *   E9  — RBAC negatives: 401 no token; SALES 403; BROKER 403; CLIENT 403
 *         (deposits/contracts endpoints are CUSTOMER-only, not CLIENT)
 *
 * Phase 7D security tightening:
 *   `/v1/contracts/me/contracts` previously exposed the permanent `pdfUrl`
 *   field on every customer-facing row, and `/v1/me/deposits` exposed
 *   `receiptUrl`. Both are now redacted to `null` by the controllers
 *   before the response leaves the server. Tests E_SECURITY1 (contracts)
 *   and E_SECURITY2 (deposits) below ASSERT the new behavior and would
 *   fail loudly if either redaction were ever removed. Signed-download
 *   via `GET /me/documents/:id/download` remains the only way a customer
 *   can ever materialize a private file URL.
 */

import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Flow E — Customer financial + signed documents (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let salesToken: string;
  let broker1Token: string;
  let clientToken: string;
  let customer1Token: string;
  let customer2Token: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [salesToken, broker1Token, clientToken, customer1Token, customer2Token] = await Promise.all([
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password),
      loginAs(testApp.app, fixtures.users.CLIENT_1.email, fixtures.users.CLIENT_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);
  });


  const http = () => request(testApp.app.getHttpServer());

  // ── E1 ───────────────────────────────────────────────────────────────────
  it('E1: customer1 GET /v1/me/deposits returns their seeded deposit', async () => {
    const res = await http()
      .get('/v1/me/deposits')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    const ids = collectIds(res.body);
    expect(ids).toContain(fixtures.flowE.customer1DepositId);
  });

  // ── E2 ───────────────────────────────────────────────────────────────────
  it('E2: customer1 GET /v1/contracts/me/contracts returns their seeded contract', async () => {
    const res = await http()
      .get('/v1/contracts/me/contracts')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    const ids = collectIds(res.body);
    expect(ids).toContain(fixtures.flowE.customer1ContractId);
  });

  // ── E3 ───────────────────────────────────────────────────────────────────
  it('E3: customer1 GET /v1/me/documents?ownerType=CONTRACT&ownerId=… returns their CUSTOMER_VISIBLE PDF', async () => {
    const res = await http()
      .get('/v1/me/documents')
      .query({ ownerType: 'CONTRACT', ownerId: fixtures.flowE.customer1ContractId })
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    const ids = collectIds(res.body);
    expect(ids).toContain(fixtures.flowE.customer1ContractDocId);
  });

  // ── E4 + E5 — signed-download path ───────────────────────────────────────
  // Both rely on R2Service.createPresignedDownload, which throws 503
  // ("Storage not configured") if R2_* env vars are unset. Locally those are
  // in `.env` and the response is 200; in CI without R2 creds it's 503.
  // The ownership chain runs BEFORE R2, so the cross-account 404 cases
  // (E6/E7) still work either way. The 200-branch asserts the signed-URL
  // contract; the 503-branch logs that R2 isn't configured and skips.
  it('E4: signed-download for customer1\'s contract PDF returns {url, expiresIn} OR 503 when R2 unset', async () => {
    const res = await http()
      .get(`/v1/me/documents/${fixtures.flowE.customer1ContractDocId}/download`)
      .set('Authorization', bearer(customer1Token));
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(typeof res.body?.url).toBe('string');
      expect(typeof res.body?.expiresIn).toBe('number');
      expect(res.body.expiresIn).toBeGreaterThan(0);
      expect(res.body.expiresIn).toBeLessThanOrEqual(300);
    }
  });

  it('E5: signed-download body never includes the permanent R2 key (or 503 if R2 unset)', async () => {
    const res = await http()
      .get(`/v1/me/documents/${fixtures.flowE.customer1ContractDocId}/download`)
      .set('Authorization', bearer(customer1Token));
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      const url: string = res.body.url;
      expect(url).toContain('X-Amz-Signature');
      expect(JSON.stringify(res.body)).not.toContain('contracts/e2e/customer1-contract.pdf');
    }
  });

  // ── E6 + E7 — cross-account negatives (ownership guard) ─────────────────
  describe('E6/E7: customer1 cannot reach customer2\'s document via either path', () => {
    it('E6: GET /v1/me/documents for customer2\'s contract → 404 (or empty)', async () => {
      // Per the audit, OwnershipService throws NotFoundException (404) before
      // any DB row is returned. The list endpoint asserts ownership of the
      // *parent* (the contract) before listing its documents.
      const res = await http()
        .get('/v1/me/documents')
        .query({ ownerType: 'CONTRACT', ownerId: fixtures.flowE.customer2ContractId })
        .set('Authorization', bearer(customer1Token));
      // Either 404 (preferred — no info leak) OR 200 with empty array would
      // satisfy "cannot see"; both signal correct isolation. We assert one
      // of those two and reject 403 or a leak.
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        const ids = collectIds(res.body);
        expect(ids).not.toContain(fixtures.flowE.customer2ContractDocId);
      }
    });

    it('E7: GET /v1/me/documents/:c2DocId/download → 404 (no existence leak)', async () => {
      const res = await http()
        .get(`/v1/me/documents/${fixtures.flowE.customer2ContractDocId}/download`)
        .set('Authorization', bearer(customer1Token));
      expect(res.status).toBe(404);
      // The audit notes the message is intentionally the same as
      // "document genuinely doesn't exist" — so we don't assert on the
      // body text (that would couple us to copy that's allowed to change).
    });
  });

  // ── E8 ───────────────────────────────────────────────────────────────────
  it('E8: customer1 /me/deposits never includes customer2\'s deposits', async () => {
    const res = await http()
      .get('/v1/me/deposits')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
    // Sanity check via the DB: every row in this response should map to a
    // contract owned by customer1.
    for (const row of list) {
      if (!row || typeof row !== 'object') continue;
      const contractId: unknown = row.contractId ?? row.contract?.id;
      if (typeof contractId !== 'string') continue;
      const owner = await testApp.rawPrisma.contract.findUnique({
        where: { id: contractId },
        select: { customerId: true },
      });
      expect(owner?.customerId).toBe(fixtures.userIds.customer1UserId);
    }
  });

  // ── E9 — RBAC negatives ──────────────────────────────────────────────────
  describe('E9: RBAC negatives on the customer financial surface', () => {
    it('GET /v1/me/deposits without token → 401', async () => {
      const res = await http().get('/v1/me/deposits');
      expect(res.status).toBe(401);
    });

    it('GET /v1/contracts/me/contracts without token → 401', async () => {
      const res = await http().get('/v1/contracts/me/contracts');
      expect(res.status).toBe(401);
    });

    it('GET /v1/me/deposits as SALES → 403 (customer-only)', async () => {
      const res = await http()
        .get('/v1/me/deposits')
        .set('Authorization', bearer(salesToken));
      expect(res.status).toBe(403);
    });

    it('GET /v1/contracts/me/contracts as BROKER → 403', async () => {
      const res = await http()
        .get('/v1/contracts/me/contracts')
        .set('Authorization', bearer(broker1Token));
      expect(res.status).toBe(403);
    });

    it('GET /v1/contracts/me/contracts as CLIENT → 403 (these endpoints are CUSTOMER-only)', async () => {
      // Documented gotcha (audit): /me/contracts + /me/deposits are
      // @Roles(CUSTOMER) NOT @Roles(CLIENT, CUSTOMER). A CLIENT user gets 403.
      const res = await http()
        .get('/v1/contracts/me/contracts')
        .set('Authorization', bearer(clientToken));
      expect(res.status).toBe(403);
    });

    it('GET /v1/me/documents as SALES → 403', async () => {
      const res = await http()
        .get('/v1/me/documents')
        .query({ ownerType: 'CONTRACT', ownerId: fixtures.flowE.customer1ContractId })
        .set('Authorization', bearer(salesToken));
      expect(res.status).toBe(403);
    });
  });

  // ── E_SECURITY1 — pdfUrl must NOT be exposed in /me/contracts ───────────
  it('E_SECURITY1: /v1/contracts/me/contracts never returns a non-null pdfUrl', async () => {
    // Phase 7D fix: the controller redacts `pdfUrl` to null for the customer
    // surface. The field may still appear in the JSON shape (API-contract
    // stability) but its value MUST be null on every row — no permanent R2
    // URL can ever reach a customer through this endpoint.
    const res = await http()
      .get('/v1/contracts/me/contracts')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const row of list) {
      expect(row.pdfUrl ?? null).toBeNull();
    }
    // Belt-and-braces: the raw seeded R2 key MUST NOT appear anywhere in
    // the response — catches any future field rename that leaks the same
    // value under a different key.
    expect(JSON.stringify(res.body)).not.toContain('contracts/e2e/customer1-contract.pdf');
  });

  // ── E_SECURITY2 — receiptUrl must NOT be exposed in /me/deposits ────────
  it('E_SECURITY2: /v1/me/deposits never returns a non-null receiptUrl', async () => {
    const res = await http()
      .get('/v1/me/deposits')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const row of list) {
      expect(row.receiptUrl ?? null).toBeNull();
    }
  });
});

/** Pull ids out of either a bare array or `{ data: [...] }` page wrapper. */
function collectIds(body: unknown): string[] {
  const list: unknown = Array.isArray(body)
    ? body
    : (body as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => (row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string'
      ? (row as { id: string }).id
      : undefined))
    .filter((id): id is string => typeof id === 'string');
}
