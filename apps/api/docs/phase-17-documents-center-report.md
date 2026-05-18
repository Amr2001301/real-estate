# Phase 17 — Documents Center

_Generated 2026-05-18._

## 1. Existing file / media system findings

Before this phase, files lived in two parallel systems:

**A. Media galleries (Prisma models).** Used for image/video/floorplan galleries on real estate listings.
- `ProjectMedia(projectId, url, type: MediaType, order)` — [schema.prisma:201](../prisma/schema.prisma#L201)
- `UnitMedia(unitId, url, type: MediaType, order)` — [schema.prisma:273](../prisma/schema.prisma#L273)
- Enum `MediaType { IMAGE, VIDEO, FLOORPLAN, DOCUMENT }`.

**B. Single-slot URL fields.** Used for "this entity has one canonical file":
| Field | Model | Purpose |
| --- | --- | --- |
| `Contract.pdfUrl` | Contract | Signed contract PDF |
| `Deposit.receiptUrl` | Deposit | Payment receipt |
| `Broker.contractPdfUrl` | Broker | Broker agreement |
| `Broker.logoUrl` | Broker | Broker firm logo |
| `BrokerPayout.receiptUrl` | BrokerPayout | Bank transfer receipt |
| `BrokerPayout.invoiceUrl` | BrokerPayout | Broker invoice |
| `Banner.imageUrl` | Banner | CMS banner image |
| `CmsPage.coverUrl` | CmsPage | CMS page cover |

**C. Upload pipeline.** [apps/api/src/modules/media/media.module.ts](../src/modules/media/media.module.ts) wires up Cloudflare R2 (S3-compatible) via `R2Service`. There's a `POST /media/presign` endpoint that issues a presigned upload URL plus `POST /media/projects` / `POST /media/units` for binding the resulting URL to a project/unit gallery. ADMIN-only.

**Gap surfaced.** None of the above stores arbitrary, multi-document attachments per entity (e.g. "broker ID copy + tax certificate + due-diligence packet for broker X"). It also doesn't track who uploaded a doc, when, why, or what category it falls under.

## 2. Migration decision

**Yes — added a strictly additive migration.** [20260518194013_add_documents_center](../prisma/migrations/20260518194013_add_documents_center/migration.sql).

### Why a migration was justified
- The existing single-slot URL fields and media galleries cannot represent multi-document attachments per entity, nor can they categorise documents (LEGAL / FINANCIAL / ID_DOCUMENT / etc.).
- Upload infrastructure already exists (R2). The missing piece was metadata storage.
- The change is **purely additive**: new enums, new table, new index, one FK to `User.id`. No existing row is modified, no existing column is altered.

### Schema diff (full SQL in the migration file)

```sql
CREATE TYPE "DocumentOwnerType" AS ENUM (
  'PROJECT', 'UNIT', 'LEAD', 'RESERVATION', 'CONTRACT', 'DEPOSIT',
  'BROKER', 'BROKER_COMMISSION', 'BROKER_PAYOUT', 'USER', 'OTHER'
);

CREATE TYPE "DocumentCategory" AS ENUM (
  'IMAGE', 'CONTRACT', 'RECEIPT', 'INVOICE',
  'BROKER_AGREEMENT', 'COMMISSION_STATEMENT', 'PAYOUT_RECEIPT',
  'ID_DOCUMENT', 'LEGAL', 'FINANCIAL', 'OTHER'
);

CREATE TYPE "DocumentVisibility" AS ENUM (
  'ADMIN_ONLY', 'BROKER_VISIBLE', 'CUSTOMER_VISIBLE'
);

CREATE TABLE "Document" (
  "id"           UUID PRIMARY KEY,
  "ownerType"    "DocumentOwnerType"  NOT NULL,
  "ownerId"      UUID                 NOT NULL,
  "category"     "DocumentCategory"   NOT NULL DEFAULT 'OTHER',
  "title"        TEXT                 NOT NULL,
  "description"  TEXT,
  "fileUrl"      TEXT                 NOT NULL,
  "fileName"     TEXT,
  "mimeType"     TEXT,
  "sizeBytes"    INTEGER,
  "visibility"   "DocumentVisibility" NOT NULL DEFAULT 'ADMIN_ONLY',
  "uploadedById" UUID,
  "deletedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)         NOT NULL,
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX "Document_ownerType_ownerId_idx" ON "Document"("ownerType","ownerId");
CREATE INDEX "Document_category_idx"         ON "Document"("category");
CREATE INDEX "Document_uploadedById_idx"     ON "Document"("uploadedById");
CREATE INDEX "Document_createdAt_idx"        ON "Document"("createdAt");
CREATE INDEX "Document_deletedAt_idx"        ON "Document"("deletedAt");
```

Decisions baked into the model:
- **`ownerId` is a plain UUID (no Prisma relation).** Polymorphic ownership doesn't map cleanly to Prisma's `@relation`. Application-layer code validates the owner exists when feasible.
- **`deletedAt` for soft delete.** Documents are never hard-deleted from the UI; rows persist for audit visibility.
- **Default visibility is `ADMIN_ONLY`.** Broker/customer-visible flags are accepted in the model but not consumed by any portal endpoint yet — that's deferred to a future phase (see §10).
- **`uploadedById` FK with `ON DELETE SET NULL`.** Removing the uploader user keeps the document but blanks the attribution rather than cascading.

## 3. Files changed

| File | Change |
| --- | --- |
| ✏️ [apps/api/prisma/schema.prisma](../prisma/schema.prisma) | New `Document` model + 3 enums + back-relation on `User` |
| 🆕 [apps/api/prisma/migrations/20260518194013_add_documents_center/migration.sql](../prisma/migrations/20260518194013_add_documents_center/migration.sql) | Additive migration |
| 🆕 [apps/api/src/modules/documents/documents.module.ts](../src/modules/documents/documents.module.ts) | New module — list / get / create / update / soft-delete + URL safety |
| ✏️ [apps/api/src/app.module.ts](../src/app.module.ts) | Register `DocumentsModule` |
| ✏️ [apps/web-admin/src/lib/types.ts](../../web-admin/src/lib/types.ts) | `DocumentOwnerType`, `DocumentCategory`, `DocumentVisibility`, `DocumentItem` |
| ✏️ [apps/web-admin/src/lib/nav.ts](../../web-admin/src/lib/nav.ts) | Added "المستندات" entry under الإدارة |
| 🆕 [apps/web-admin/src/components/documents/labels.ts](../../web-admin/src/components/documents/labels.ts) | Shared Arabic labels + ownerHref builder + size formatter |
| 🆕 [apps/web-admin/src/components/documents/owner-documents-card.tsx](../../web-admin/src/components/documents/owner-documents-card.tsx) | Reusable entity-page widget with legacy-doc slots |
| 🆕 [apps/web-admin/src/app/dashboard/documents/page.tsx](../../web-admin/src/app/dashboard/documents/page.tsx) | List + filter bar |
| 🆕 [apps/web-admin/src/app/dashboard/documents/new/page.tsx](../../web-admin/src/app/dashboard/documents/new/page.tsx) | Create form (prefilled via query params) |
| 🆕 [apps/web-admin/src/app/dashboard/documents/[id]/page.tsx](../../web-admin/src/app/dashboard/documents/[id]/page.tsx) | Detail + soft-delete (with confirm dialog) |
| 🆕 [apps/web-admin/src/app/dashboard/documents/actions.ts](../../web-admin/src/app/dashboard/documents/actions.ts) | Server actions: create + soft-delete |
| ✏️ [apps/web-admin/src/app/dashboard/brokers/[id]/page.tsx](../../web-admin/src/app/dashboard/brokers/[id]/page.tsx) | `OwnerDocumentsCard` widget added; legacy `contractPdfUrl` surfaced |
| 🆕 [apps/api/docs/phase-17-documents-center-report.md](./phase-17-documents-center-report.md) | This report |

## 4. Backend endpoints created

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET | /documents | ADMIN | Paginated list. Filters: `ownerType`, `ownerId`, `category`, `uploadedById`, `q` (title/description/fileName), `from`, `to`. Defaults to non-deleted only. |
| GET | /documents/:id | ADMIN | Single document (404 if missing or soft-deleted) |
| POST | /documents | ADMIN | Create. Validates `fileUrl` is `http`/`https`, rejects localhost/`javascript:`/`file:`. Validates owner exists for the known owner types. Sets `uploadedById` from the JWT. |
| PATCH | /documents/:id | ADMIN | Update editable fields. Re-runs URL safety check if `fileUrl` is changed. |
| DELETE | /documents/:id | ADMIN | **Soft** delete — sets `deletedAt`. Row remains in DB for audit. |

No dedicated `GET /projects/:id/documents` style endpoints were added — the generic list with `ownerType` + `ownerId` filters covers the same use case and keeps the surface area smaller.

## 5. Frontend pages created

| Path | Purpose |
| --- | --- |
| `/dashboard/documents` | Filter bar (search, ownerType, category, date range, ownerId), paginated table, links to detail/open/add |
| `/dashboard/documents/new` | Create form. Reads `?ownerType=`/`?ownerId=`/`?category=` from URL so entity pages can prefill |
| `/dashboard/documents/[id]` | Metadata cards (basic info + uploader + raw URL) + open button + soft-delete with [`ConfirmingForm`](../../web-admin/src/components/confirming-form.tsx) |
| Added nav entry "المستندات" (Files icon) under "الإدارة" | |

## 6. Entity-page integrations

To keep this phase contained, the widget is wired into **one** entity detail page now and ready to drop into the others:

- ✅ [/dashboard/brokers/[id]](../../web-admin/src/app/dashboard/brokers/[id]/page.tsx) shows the new `OwnerDocumentsCard` with:
  - up to 5 recent documents tied to the broker
  - the legacy `Broker.contractPdfUrl` surfaced as a "legacy linked document" if present
  - "إضافة مستند" button prefilled with `ownerType=BROKER&ownerId=<this broker>`
  - "عرض كل المستندات" link to `/dashboard/documents?ownerType=BROKER&ownerId=<id>`

The widget is reusable. Dropping it into [/dashboard/contracts/[id]](../../web-admin/src/app/dashboard/contracts/[id]) or [/dashboard/broker-payouts/[id]](../../web-admin/src/app/dashboard/broker-payouts/[id]/page.tsx) would be one import + one JSX block each:

```tsx
<OwnerDocumentsCard
  ownerType="CONTRACT"
  ownerId={contract.id}
  legacy={contract.pdfUrl ? [{ label: 'العقد (PDF)', href: contract.pdfUrl, hint: 'حقل قديم — contract.pdfUrl' }] : undefined}
/>
```

Deferred to the next pass (out of scope this phase but trivially extensible): project, unit, contract, broker payout detail pages.

## 7. Upload strategy chosen

**URL-only, with R2 presign reuse.** This phase does NOT add a new binary upload pipeline. Instead:

1. Admin uses the existing `POST /media/presign` endpoint to get a presigned R2 upload URL.
2. Browser PUTs the file directly to R2.
3. Admin pastes the resulting public URL into the new `/dashboard/documents/new` form.

The form lives behind `URL` input validation client-side and a strict server-side `assertSafeUrl()` check:
- Must be absolute http(s).
- Length ≤ 2048.
- Hostname is not `localhost`, `127.0.0.1`, `0.0.0.0`.
- `javascript:`, `file:`, `data:`, etc. are rejected at the URL constructor stage.

A future phase can extend `/dashboard/documents/new` with an inline "upload to R2" step that calls `/media/presign` itself, so the admin never pastes URLs. The current shape is the simplest path that doesn't require new infrastructure.

## 8. Security decisions

| Concern | Decision |
| --- | --- |
| Role gate | Entire `/documents` controller class is `@Roles(UserRole.ADMIN)`. No SALES / BROKER access. |
| Visibility flags | Stored but **not yet enforced for portal/customer access** — documented in §10 deferred. Default is `ADMIN_ONLY`. |
| URL injection | `assertSafeUrl()` rejects non-http(s) schemes, localhost hosts, and over-length input on both create and update |
| Owner forgery | When `ownerType` is one of the known Prisma types, the service queries that model to confirm `ownerId` exists. `OTHER` skips the check (intentional escape hatch). |
| Hard delete | Not exposed — `DELETE /documents/:id` is a soft delete (`deletedAt`). Audit trail preserved. |
| Audit logging | The global `AuditInterceptor` already runs on every mutating method, so POST/PATCH/DELETE on `/documents/*` writes a row with `action=POST|PATCH|DELETE`, `entityType=v1/documents`, `entityId=<document id>`, response `after` (with the Phase 15 sensitive masking). No additional wiring needed. |
| Confirmation UX | Soft-delete in the UI uses [`ConfirmingForm`](../../web-admin/src/components/confirming-form.tsx) (Phase 14) so an accidental click can't drop a document |
| Sensitive data | Document metadata is metadata — no secret values. R2 URLs may include short-lived signed-URL query strings; those are not masked because they expire on their own and reading the URL is the point of the row. If your bucket is fully public, treat the URL the same as the file itself. |

## 9. Compile / type results

```bash
cd apps/api && npx prisma validate          # ✅ valid
cd apps/api && npx prisma migrate deploy    # ✅ migration applied locally
cd apps/api && npx prisma generate          # ✅ client regenerated
cd apps/api && npx tsc --noEmit             # ✅ 0 errors
cd apps/web-admin && npx tsc --noEmit       # ✅ 0 errors
cd apps/api && npx tsx scripts/smoke-broker-module.ts   # ✅ unchanged: 16 pass / 1 warn / 0 fail
```

## 10. Manual test steps

| # | Steps | Expected |
| --- | --- | --- |
| 1 | As ADMIN, open `/dashboard/documents` | Empty-state card on a fresh DB |
| 2 | Click "إضافة مستند" → fill ownerType=`BROKER`, ownerId=`<a real broker UUID>`, title, fileUrl=`https://example.com/x.pdf`, category=`BROKER_AGREEMENT` → Save | Redirects to detail page; row visible in `/dashboard/documents` |
| 3 | Try fileUrl=`javascript:alert(1)` | API returns 400 `fileUrl scheme "javascript:" is not allowed` |
| 4 | Try fileUrl=`http://localhost:9000/x.pdf` | API returns 400 `fileUrl must not point at localhost` |
| 5 | Try ownerType=`BROKER` with a non-existent ownerId | API returns 400 `Broker not found for ownerId` |
| 6 | Open `/dashboard/brokers/<that broker>` | "المستندات" card appears with the new doc + the broker's legacy `contractPdfUrl` (if set) |
| 7 | Click "إضافة مستند" from the broker page | New-doc page prefilled with `ownerType=BROKER&ownerId=<that id>` |
| 8 | Open `/dashboard/documents` → filter by `ownerType=BROKER` + `category=BROKER_AGREEMENT` | Only matching rows |
| 9 | Open the document detail → click "حذف المستند" → cancel the confirm | Row stays |
| 10 | Same flow but confirm | Row disappears from `/dashboard/documents`; `GET /v1/documents/<id>` returns 404; row remains in DB with `deletedAt` set |
| 11 | Open `/dashboard/audit-logs` | Three rows for the document just created: POST, plus the soft-delete PATCH-via-DELETE; actor is the admin |
| 12 | As SALES, hit `GET /v1/documents` | 403 |
| 13 | As BROKER, hit `GET /v1/documents` | 403 |
| 14 | As ADMIN, hit `GET /v1/documents?ownerType=PROJECT&ownerId=<bad UUID format>` | 400 — DTO `IsUUID` rejects |

## 11. Deferred improvements

1. **Inline upload step.** Bake an "upload to R2" button into `/dashboard/documents/new` that calls `/media/presign` itself, PUTs the file from the browser, then populates `fileUrl`/`fileName`/`mimeType`/`sizeBytes` automatically. Avoids manual URL pasting.
2. **Broker portal documents.** Implement `GET /portal/documents` scoped to `scope.brokerId` + `visibility != ADMIN_ONLY` and a `/portal/documents` page. Today `BROKER_VISIBLE` is a stored flag with no consumer.
3. **Customer-visible documents.** Same as above for the customer/client surface (which doesn't exist in dashboard scope, but the flag is reserved for when it does).
4. **More entity-page integrations.** The widget is ready — drop into project / unit / contract / broker-payout detail pages.
5. **Document versioning.** New `DocumentVersion` table so editing a doc archives the prior `fileUrl`. Useful for compliance/legal docs.
6. **Document approvals.** A `status: PENDING/APPROVED/REJECTED` field plus an approver workflow for sensitive categories (LEGAL, FINANCIAL).
7. **PDF generation.** Auto-generate commission statements, payout receipts as Documents tied to the relevant entity at status-transition time.
8. **Backfill existing URL fields.** A dry-run-by-default script that walks `Contract.pdfUrl`, `Deposit.receiptUrl`, `Broker.contractPdfUrl`, etc., and creates corresponding `Document` rows. Today the entity-page widget already shows them inline as "legacy linked documents" without copying — the backfill is only needed if/when those URL fields are deprecated.
9. **MIME validation.** Today we accept whatever the admin types. Could validate against a whitelist (PDF, JPEG, PNG, DOCX, …) per category.
10. **Bulk operations.** Multi-select + bulk delete or bulk recategorize from the list page.

## 12. Final readiness verdict

### **READY**

- New `Document` table is purely additive — no risk to existing data.
- All admin endpoints are ADMIN-only with strict URL validation and owner-existence checks for known entity types.
- Soft delete only; rows persist for audit visibility.
- Audit interceptor automatically picks up document mutations.
- Reusable entity-page widget already wired into broker detail; copy-paste-ready for other entities.
- No portal/broker leak vector — `BROKER_VISIBLE` flag exists but no portal endpoint reads documents yet (and any future portal endpoint must scope by brokerId).

The deferred items in §11 are *enablement* additions (upload UX, portal/customer surfacing, versioning, approvals, PDF generation). None of them block production use of the new admin Documents Center.
