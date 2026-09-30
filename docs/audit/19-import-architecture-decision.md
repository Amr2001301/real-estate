# Import Architecture Decision — v1

> Status: Decision document. No implementation code in this session.
> Author: review session 2026-09-26
> Context: `docs/audit/18-data-export-benchmark.md` for timing numbers.
> Existing importer: `POST /leads/import` (`leads.service.ts:460`).

---

## Prerequisites: Schema defects that block safe import

Before any import code is written, three schema issues must be addressed.
They are not import implementation details — they are structural gaps that
make a correct importer impossible to write today.

### P-1 — `contractNumber` is globally unique, not per-tenant

```
// prisma/schema.prisma:1227
contractNumber String? @unique
```

A globally unique contract number means two tenants cannot both have
`C-0001`. An Engaz CRM migration file from any second tenant will
collide with the first tenant's contracts. **This constraint must become
`@@unique([companyId, contractNumber])`** before Contract import ships.
The same applies to `Broker.code` (line 2220) and `Broker.taxId` (line
2222), both globally unique.

### P-2 — `User.phone` is globally unique

```
// prisma/schema.prisma:277
phone String? @unique
```

Customers are stored as `User` rows with `role = CLIENT`. Phone is the
only natural key for customer identity. Because it is globally unique, a
phone number already registered under any tenant blocks its import for
every other tenant. For a multi-tenant migration scenario this is a
blocker. The fix — `@@unique([companyId, phone])` on the `User` model —
is a breaking migration requiring careful data cleanup (there must be no
existing cross-tenant phone duplicates before the constraint changes).

> **Decision for you**: Accept the migration risk and fix it, or
> treat phones as tenant-scoped by convention (keeping the global
> constraint) and document that duplicate-phone customers across tenants
> must be resolved manually before import.

### P-3 — Most entities have no per-tenant natural-key unique constraint

`Unit.@@unique([buildingId, code])` scopes code within a building —
close to correct but the scope is `buildingId`, not `(companyId, code)`.
Projects, Phases, and Buildings have no unique constraint at all per
tenant. Import identity for these entities must be defined by convention
(see Q2) rather than enforced by the DB.

---

## Q1 — Column mapping

**Options considered**

A. Strict fixed column names matching the export headers exactly (Arabic).  
B. Header-sniffing with a canonical alias table per entity, falling back
   to position.  
C. A full mapping UI where the user uploads any file and assigns columns
   interactively; saved mapping reusable per company.

**Recommendation: B for v1, defer C.**

The leads importer already uses option B: it checks header values against
a small alias list and falls back to positional defaults
(`leads.service.ts:515–521`). This approach handles both our own export
files (exact header match) and Engaz CRM files (cover the most common
Engaz column names in the alias table).

Option C is the correct long-term answer for arbitrary files but requires
a frontend component, a mapping persistence table, and a backend
mapping-resolution step. That is a 2–3 week addition on top of the
import itself. Ship without it; the alias table satisfies the stated
migration scenario.

**Structure of the alias table**

One file per entity, for example `import-aliases/unit.ts`:
```
const ALIASES: Record<string, keyof UnitImportRow> = {
  'كود الوحدة': 'code', 'unit code': 'code', 'رقم الوحدة': 'code',
  'المساحة (م²)': 'area', 'area': 'area', 'المساحة': 'area',
  ...
};
```

Matching is case-insensitive with leading/trailing whitespace stripped.
Unknown headers are ignored (the rest of the row is still processed).

**Sheet identification for multi-sheet files**

For a file we produced, sheet names are stable English identifiers
(`Projects`, `Leads`, etc.). For a customer's file, sheet names are
arbitrary. Recommendation: attempt an exact match first; if no match,
attempt case-insensitive match; if still no match, skip the sheet and
report it as unrecognised. Do NOT attempt to auto-detect entity type from
column names — too error-prone.

**Saved mapping (deferred)**

If option C is built later, the mapping record is:
```
CompanyImportMapping {
  id, companyId, entityType, originalSheetName,
  columnMappings Json, // [{ sourceHeader, targetField }]
  createdAt, lastUsedAt
}
```
Auto-suggest at mapping time: exact string match first, then normalized
match, then Levenshtein distance ≤ 2 for fuzzy.

---

## Q2 — Identity and idempotency

**When _Ref is present (round-trip from our export)**

The `_Ref` column on Leads, Deposits, PaymentInstruments, Refunds, and
Maintenance is the first 8 characters of the record's UUID. **This is
not a reliable lookup key.** Two different UUIDs can share a prefix —
collision probability for 8 hex chars across a tenant with 10,000 leads
is non-negligible (birthday paradox at 1% collision around 600 records).

Consequence: _Ref cannot be used as the upsert key. For a round-trip
import, the correct identity key is still the entity's natural key (for
entities that have one) or phone (for leads).

For entities without a reliable natural key (Deposits, PaymentInstruments,
Refunds, Maintenance), the round-trip import should treat every row as an
INSERT unless the natural-key collision is detected. If you want true
round-trip upsert for these entities later, the export must emit the full
UUID — a v2 concern.

> **Open decision for you**: Should the v1 importer honour _Ref at all,
> or treat it as a human-readable annotation only? If you want _Ref-based
> upsert for Leads specifically (where phone may have changed), the export
> needs to emit the full UUID in a hidden column. Recommend: ignore _Ref
> for v1 logic; it remains useful as an error-report reference.

**When _Ref is absent (customer's own file)**

Identity is by natural key per entity:

| Entity | Identity key | DB constraint exists? |
|---|---|---|
| Project | (companyId, name) | No — name is not unique per tenant |
| Phase | (companyId, projectName, order) | No |
| Building | (companyId, phaseName, projectName, name) | No |
| Unit | (buildingId, code) | Yes — `@@unique([buildingId, code])` |
| Customer | (companyId, phone) | See P-2 — global constraint today |
| Lead | phone within companyId | No DB constraint; business rule only |
| Contract | (companyId, contractNumber) | See P-1 — global constraint today |
| InstallmentPlan | (contractNumber) | No; implicit 1:1 with contract |
| Installment | (contractNumber, ordinal or dueDate) | No |
| Broker | (companyId, code) | See P-1 — global constraint today |

For Project/Phase/Building (no unique constraint), the importer must
build its own lookup map from the already-imported rows in the same file
plus any rows already in the DB. Two rows with the same name in the same
parent are treated as the same record; the second is an upsert of the
first. This is deterministic but fragile — if the customer has legitimately
named two buildings the same thing, the import will silently merge them.

**Idempotency requirement**

Yes — a second import of the same file must produce the same state as the
first. The mechanism: attempt `upsert` (using the natural key as the
`where` clause) rather than blind `create`. For entities where upsert is
not possible (no DB unique constraint), use `findFirst` + conditional
`create`/`update`. For leads specifically (no unique phone constraint),
the business rule is: if a lead with the same phone already exists in
this company, skip the row and report it as a duplicate.

---

## Q3 — Dependency ordering and partial data

**Dependency tree**

```
Projects
  └── Phases
        └── Buildings
              └── Units ──────────┐
                                   ├── Contracts ──┐
Customers (Users) ─────────────────┘               ├── InstallmentPlans
   └── Leads                                        |     └── Installments
                                                    └── Deposits
Brokers
   └── BrokerCommissions (→ Contracts + Units + Projects)
```

**What happens when a customer imports only Customers and Contracts,
with no Projects sheet?**

**Recommendation: reject with an actionable error.**

Do NOT auto-create parent records. Auto-creating an empty Project or
Phase to satisfy a foreign key produces phantom data that looks real in
the CRM. The customer will spend time cleaning it up.

Instead, the preview phase resolves all foreign-key references before
any write occurs. Any row whose parent cannot be resolved produces a
blocking error:

```
Contracts sheet, row 14: unit code "A-003" in building "Tower B" —
Building "Tower B" was not found in the Buildings sheet or the database.
Import the Buildings sheet first, or add the building to this file.
```

**Exception: parents present in the same file**

If the uploaded file contains both the Contracts sheet and the
Units/Buildings/Phases/Projects sheets, the importer processes them
in dependency order:

1. Projects
2. Phases
3. Buildings
4. Units
5. Customers
6. Leads (depends on Customers via `clientId`)
7. Contracts (depends on Units and Customers)
8. InstallmentPlans (depends on Contracts)
9. Installments (depends on InstallmentPlans)

Sheets not present in the file are skipped silently. Each sheet's
processed rows are committed before the next sheet begins (per-sheet
transaction, see Q4), so a later sheet can look up rows created by
an earlier sheet within the same import.

---

## Q4 — Transaction boundary

**Options considered**

A. One transaction for the entire file (all-or-nothing).  
B. One transaction per sheet.  
C. One transaction per batch of N rows within each sheet.  
D. No transaction — row-by-row best-effort (current leads importer).

**Recommendation: B — per-sheet transactions.**

**Why not A (whole file)?**

A 13,700-row import through Prisma middleware and FK-resolution logic
will take roughly 10–30 seconds (write operations are 3–5× slower than
the export reads that took 932 ms at the same size). PostgreSQL
transaction duration is not inherently dangerous for row-level locks, but
a 30-second transaction is likely to exceed the HTTP request timeout
before it commits. Even if not, a single validation error on the
Maintenance sheet at row 8,000 would roll back 8,000 already-correct
rows from Projects through Installments.

**Why not D (no transaction)?**

The existing leads importer uses row-by-row with no rollback. For leads
this is acceptable because each lead is independent. But for a hierarchy
import (Phase needs its Project to have committed), row-by-row creates
ordering dependencies that cannot be satisfied without transactions.

**Why B (per-sheet)?**

- Each sheet is a logical unit. If Phases fails mid-way, the user fixes
  their Phases sheet and re-uploads. Projects are already committed and
  won't be duplicated on re-upload (upsert idempotency handles this).
- Lock duration is bounded by sheet size, not file size.
- The failure report is sheet-granular, which is actionable.
- Sheets earlier in the dependency order are committed before later
  sheets begin — FK resolution works correctly.

**Concern: partial hierarchy on failure**

If Projects commits and Phases fails, we have project rows with no
phases. This is a valid intermediate state in the DB (projects with no
phases exist during normal operation). The re-import of Phases is
idempotent — it will upsert/skip the same projects and insert the phases
that failed. No manual cleanup needed.

**Batch size within the per-sheet transaction**

For very large sheets (>2,000 rows — see Q8), the per-sheet transaction
is wrapped in a background job (see Q8). Within the job, the transaction
is still one per sheet. For synchronous import (≤2,000 rows per sheet),
a single Prisma `$transaction` wrapping all upserts for that sheet is
correct.

---

## Q5 — Validation and preview

**What the preview returns**

Returning all 13,000 rows in a preview response is not viable. The
preview is a dry-run that **returns a summary, not the full row list**:

```typescript
interface ImportPreviewResult {
  sheets: Array<{
    sheetName:      string;
    entityType:     string | null;   // null = unrecognised sheet
    totalRows:      number;
    validRows:      number;
    blockingErrors: Array<{ row: number; field: string; message: string }>;
    warnings:       Array<{ row: number; field: string; message: string }>;
    // Max 50 sample errors to keep response size bounded
  }>;
  canProceed: boolean;  // true only if zero blocking errors across all sheets
}
```

The preview resolves all FK references (against the DB and against other
sheets in the same file) but writes nothing.

**Blocking errors (stop the import)**

- Required field missing (fullName, phone, contractNumber, etc.)
- Referenced parent not found in file or DB
- Duplicate within the batch that would violate a unique constraint (two
  contract rows with the same contractNumber in the same file)
- Type error that cannot be coerced (e.g., non-numeric value in a
  numeric-only field after repair attempt)

**Warnings (non-blocking, logged in the report)**

- Phone number was repaired (leading zero added — see Q7)
- Row is a duplicate of an existing record and will be skipped
- Optional field was empty (no null-cell issue — the export already
  writes empty cells for null values)

**Error report download**

For files with errors, the user should be able to download an annotated
version of their file with an added `_ImportError` column at the end of
each sheet, populated with the error message for that row. This is the
same file they uploaded, not our export format. This is a v1.5 feature —
implement the in-UI error list first.

---

## Q6 — Tenant isolation

**What the Prisma middleware already covers**

From `prisma.service.ts:142–185`:
- `create` → `applyCreatePolicy` injects `companyId`
- `createMany` → `applyCreateManyPolicy` injects `companyId` into every
  record in the batch; rejects the batch if any record has a conflicting
  `companyId`
- `upsert` → read policy scopes the `where`; create branch gets
  `companyId` injected
- `findMany`, `findFirst`, etc. → `applyReadPolicy` injects `companyId`
  into the `where` clause

These apply as long as `requireTenantContext()` succeeds — i.e., as long
as an ALS context with `companyId` is active.

**Where the import service must be careful**

1. **HTTP handler path (synchronous import)** — The request goes through
   `TenantContextInterceptor`, which sets up ALS before the controller
   method runs. The Prisma middleware is active throughout. No extra
   `runTenantContext` call needed.

2. **Background job path (async import — Q8)** — The job worker is
   invoked outside of an HTTP request. ALS is **not** active. Every
   Prisma operation in the job must be wrapped in
   `runTenantContext({ companyId }, async () => { ... })`. This is the
   same pattern as the existing cron jobs (see `reference_scheduler_cron.md`
   in memory). Missing this is a security defect, not just a bug.

3. **`createMany` with `skipDuplicates: true`** — The middleware injects
   `companyId` into each record, but the "skip" decision is made by
   PostgreSQL's unique constraint enforcement. For this to be safe, the
   unique constraint must be per-tenant (e.g., `@@unique([companyId, code])`).
   Using `skipDuplicates` against a globally-scoped unique constraint (see P-1,
   P-2) can incorrectly skip a row because a different tenant's record
   occupies the slot. **Do not use `skipDuplicates: true` until the
   schema defects in Prerequisites are fixed.**

4. **Raw SQL for bulk upsert** — If you later consider `INSERT ... ON
   CONFLICT DO UPDATE` for performance, that raw SQL bypasses all
   Prisma middleware. Every raw query must include an explicit
   `WHERE "companyId" = $1` clause. Recommend: avoid raw SQL in the
   import layer entirely for v1.

5. **FK resolution lookups** — `findFirst({ where: { code: 'A-001' } })`
   without `companyId` in the `where` clause would return the first row
   globally. The Prisma middleware's `applyReadPolicy` injects `companyId`
   automatically — but only if the ALS context is active (see point 2).
   In the job path, verify that every FK resolution query fires inside
   the `runTenantContext` wrapper.

---

## Q7 — Type coercion on the way in

**The problem**

The export writes phones, _Ref, and national IDs with `numFmt = '@'`
(text). ExcelJS serializes these as `<c t="str">` in the XML. A customer
who opens the file in Excel and saves it without modification preserves
the text type. A customer who opens an Engaz CRM export (which uses
numeric cells for phone numbers) has already lost leading zeros before
our system sees the file.

**Specific cases**

| Column | Export format | Risk in customer file | Example |
|---|---|---|---|
| Phone | text `'01099888777'` | Number `1099888777` (leading zero gone) | `1099888777` |
| National ID | text `'29901011234567'` | Number `2.99e13` (precision lost) | `29901011234567000` |
| _Ref | text `'3e7f9c12'` | Could be auto-parsed as `3e+7f9c12`? | No — Excel does not parse hex strings as numbers |
| Contract number | text `'C-0001'` | Not numeric — safe | — |

**Recommendation: warn and repair for phones; reject for national IDs
that lost precision.**

**Phone repair rule**

```
function repairPhone(raw: unknown): { value: string; repaired: boolean } {
  const s = String(raw).trim().replace(/\s+/g, '');
  // Already valid Egyptian mobile (11 digits, starts with 01X)
  if (/^01[0-9]{9}$/.test(s)) return { value: s, repaired: false };
  // Dropped leading zero: 10 digits starting with 1
  if (/^1[0-9]{9}$/.test(s)) return { value: '0' + s, repaired: true };
  // Returned as scientific notation (e.g. "1.06280e+10"): reject
  if (/e\+/i.test(s)) return { value: s, repaired: false }; // blocking error
  return { value: s, repaired: false };
}
```

The repair is flagged as a warning in the preview report:
`"Phone '1062800394' repaired to '01062800394'."` The import proceeds.

The rule is Egypt-specific. For a future international tenant, `repairPhone`
must become configurable per company locale.

**National ID**

A 14-digit national ID stored as a number may lose its last digits to
floating-point precision (Excel stores numbers as double, which has 15
significant digits — a 14-digit ID is at the limit). If the imported
value is ≠ 14 digits after coercion, that is a **blocking error**:
`"National ID '29901011234567000' appears to have lost precision. Please
reformat column as Text in Excel before uploading."` Do not attempt to
repair — the correct value is unknowable.

**_Ref**

Excel does not auto-parse hex strings as numbers (unlike purely numeric
strings). `'3e7f9c12'` would not be auto-converted. No coercion needed.
However, a cell that ExcelJS reads back as a numeric value for _Ref
indicates the customer reformatted the column. Treat as unrecoverable
(warn and ignore the _Ref, use natural key for identity instead).

---

## Q8 — Size and timing

**Reference numbers from `docs/audit/18-data-export-benchmark.md`**

| Size | Rows exported | Export wall time | File size |
|------|--------------|-----------------|-----------|
| small | 663 | 122 ms | 47 KB |
| medium | 5,903 | 415 ms | 245 KB |
| large | 13,703 | 932 ms | 540 KB |

Export uses 34 SQL queries at all sizes (no N+1). Import is fundamentally
different: each row requires validation lookups (1–3 queries) plus a
write (1 upsert). Conservatively, import is 5–10× slower than export per
row.

**Estimated import throughput**

- At 5–10 queries per row, 1 ms per query: ~5–10 ms per row.
- 2,000 rows × 10 ms = 20 seconds.
- This exceeds a comfortable HTTP timeout (30 s) for the upper bound.

**Synchronous threshold: 2,000 rows per sheet.**

This matches the "medium" benchmark scale per entity (350 contracts,
350 leads, 3,500 installments spread across 350 contracts → ~10 per
contract). For a first migration that typically has hundreds of contracts,
synchronous is fine.

**Above 2,000 rows per sheet: async job.**

Return a job ID immediately. The client polls `GET /data-import/jobs/:id`
for status. The job runs in a background worker that calls
`runTenantContext({ companyId })` (see Q6, point 2) before any Prisma
operation.

**For v1: synchronous only.**

The stated migration scenario is Engaz CRM, which is a small-to-medium
brokerage. Their row counts will be in the hundreds, not tens of thousands.
Implement the synchronous path first. Add the async path in v2 when a
customer actually hits the limit.

**Memory**

ExcelJS loads the entire XLSX into memory. At 540 KB file → ~3–5 MB
in-memory representation. Import adds validation state on top: estimated
8–12 MB peak for the large case. This is safe for a Node.js process with
512 MB.

If memory becomes a concern for v2 (streaming parser), `xlsx-stream-reader`
is an option, but it loses random access to other sheets (needed for FK
resolution). For v1, full in-memory is correct.

---

## Q9 — Scope for v1

**Recommended v1 entities (9 of 15)**

| Priority | Entity | Justification |
|---|---|---|
| 1 | Projects | Root of the hierarchy; prerequisite for everything else |
| 2 | Phases | Prerequisite for Buildings |
| 3 | Buildings | Prerequisite for Units |
| 4 | Units | Prerequisite for Contracts; core asset catalogue |
| 5 | Customers | Prerequisite for Leads and Contracts |
| 6 | Leads | Already importable via existing endpoint; unify into new importer |
| 7 | Contracts | Core business data; the main migration driver |
| 8 | InstallmentPlans | Paired with Contracts; no additional FK complexity |
| 9 | Installments | Completes the financial picture per contract |

**Deferred (6 entities)**

| Entity | Reason for deferral |
|---|---|
| Deposits | Requires ContractCancellation awareness; financial reconciliation, not migration-critical |
| PaymentInstruments | Most complex sheet (14 columns, bounce/clearing logic, linked deposits); low migration priority |
| Refunds | Depends on ContractCancellation which is not a standalone importable entity |
| Brokers | Separate acquisition channel; can be entered manually or imported separately |
| BrokerCommissions | Depends on Brokers + Contracts; financial history, not operational migration data |
| Maintenance | Operational data, not CRM migration data; low value for day-one cutover |

**The cut line rationale**

Projects → Units → Customers → Contracts → Installments is the complete
sales pipeline. A brokerage migrating from Engaz needs its asset catalogue
(Units hierarchy), its client list (Customers + Leads), and its sales
history (Contracts + Installments). Everything else is financial reporting
or operational data that can wait.

The existing leads importer (`POST /leads/import`) should be left in
place but marked deprecated. The new unified importer handles leads as
one sheet among many; the old endpoint continues to work for clients
using it via API.

---

## Summary table

| Question | Recommendation | Open decision? |
|---|---|---|
| Column mapping | Header-sniffing + alias table; UI mapping deferred | No |
| Identity | Natural keys only; ignore _Ref for v1 upsert logic | Yes — full UUID in export for v2? |
| Dependency ordering | Process in dependency order; reject unresolved FK refs | No |
| Transaction boundary | Per-sheet transactions | No |
| Validation/preview | Summary + up to 50 sample errors; no full-row list | No |
| Tenant isolation | HTTP: automatic; background job: `runTenantContext` required | No |
| Type coercion | Repair phones with warning; reject lost-precision IDs | No |
| Size/timing | Synchronous ≤ 2,000 rows/sheet; async deferred to v2 | No |
| v1 scope | 9 entities (Projects → Installments chain); 6 deferred | No |

**Blocking prerequisite before any import code ships:**
Fix P-1 (`contractNumber @unique` → per-tenant), P-2 (`User.phone`
uniqueness strategy decision), and P-3 (document the no-constraint
entities). Without these, a correct importer cannot be written.
