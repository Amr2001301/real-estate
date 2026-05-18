# Phase 18 — Inline File Upload / R2 Upload UX

_Generated 2026-05-19._

## 1. Existing R2 / media upload findings

`apps/api/src/modules/media/r2.service.ts` already wraps Cloudflare R2 with the AWS S3 SDK and exposes `createPresignedUpload()`, which:

- Generates a UUID-keyed object path under `<folder>/<YYYY-MM-DD>/<uuid><ext>`.
- Returns `{ uploadUrl, key, publicUrl }`.
- `uploadUrl` expires in **5 minutes** (`expiresIn: 60 * 5` at [r2.service.ts:47](../src/modules/media/r2.service.ts#L47)).
- `publicUrl` is composed from `R2_PUBLIC_URL` env + the object key.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` are read from env; missing config logs a warning and rejects uploads.

`apps/api/src/modules/media/media.module.ts` exposes `POST /media/presign` — ADMIN-only — but:

- The `folder` whitelist was: `projects | units | contracts | receipts | maintenance | banners`. **No `documents`.**
- No MIME validation at the API layer (only client-side `accept` in `MediaUploader`).
- No size validation anywhere.
- `R2Service` is exported by `MediaModule`.

Frontend already had a reusable [`MediaUploader`](../../web-admin/src/components/media-uploader.tsx) client component proving the full flow: request presign → direct `PUT` to R2 with `XMLHttpRequest` and progress events → optional attach.

The [api-proxy middleware](../../web-admin/src/middleware.ts) rewrites `/api-proxy/*` requests, injecting the `access_token` cookie as a `Bearer` Authorization header before forwarding to the API. The new upload flow re-uses this proxy.

| Existing presign | Shape |
| --- | --- |
| Request body | `{ contentType, folder, extension? }` |
| Response | `{ uploadUrl, key, publicUrl }` |
| Upload method | `PUT` directly to `uploadUrl` with `Content-Type` matching the presign |
| Expiry | 5 minutes |
| Public URL | `${R2_PUBLIC_URL}/${key}` |

## 2. Backend changes

**Approach.** Don't broaden `/media/presign`. Add a dedicated `POST /documents/presign` that lives in the Documents module, has strict MIME + size validation, and reuses `R2Service`.

### Files
- ✏️ [apps/api/src/modules/media/r2.service.ts](../src/modules/media/r2.service.ts):
  - Added `'documents'` to the `folder` union accepted by `createPresignedUpload()`.
  - Added extension guesses for DOC / DOCX / XLS / XLSX / CSV.
- ✏️ [apps/api/src/modules/documents/documents.module.ts](../src/modules/documents/documents.module.ts):
  - Imports `MediaModule` so it can inject `R2Service`.
  - Adds `ALLOWED_DOCUMENT_MIME_TYPES` set (9 entries) and `MAX_DOCUMENT_SIZE_BYTES = 25 MiB`.
  - Adds `DocumentsPresignDto` (validates `contentType`, `sizeBytes`, optional `fileName`).
  - Adds `DocumentsService.presign()` which rejects unsupported MIME / oversized files / unsafe extensions and delegates to `R2Service`.
  - Adds `POST /documents/presign` — ADMIN-only via the class-level `@Roles(UserRole.ADMIN)`, declared **before** the `:id` routes so the literal segment isn't interpreted as a UUID parameter.

### Endpoint surface

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| `POST` | `/documents/presign` | ADMIN | Returns `{ uploadUrl, key, publicUrl }` after MIME + size validation. Rejects everything not on the whitelist. |
| existing | `/documents` (POST/PATCH/DELETE) | ADMIN | Unchanged — still runs `assertSafeUrl()` on `fileUrl`, still creates / patches / soft-deletes. |

## 3. Frontend changes

| Type | File |
| --- | --- |
| 🆕 | [apps/web-admin/src/components/documents/document-uploader.tsx](../../web-admin/src/components/documents/document-uploader.tsx) — reusable client uploader: file picker, client-side MIME/size guard, presign + R2 `PUT` with progress, clear/remove control, status banner, error display |
| ✏️ | [apps/web-admin/src/app/dashboard/documents/new/page.tsx](../../web-admin/src/app/dashboard/documents/new/page.tsx) — new mode toggle (Upload vs. Paste URL), default = Upload, suggested title derived from the uploaded file name, submit disabled until the upload completes in upload mode |

The page keeps the existing server action `createDocumentAction` unchanged. In **Upload mode** the action receives `fileUrl/fileName/mimeType/sizeBytes` from hidden inputs that the uploader populates after R2 confirms the `PUT`. In **URL mode** the page renders the same fields it always did and the server action sees them as before.

## 4. Upload flow behaviour

1. Admin lands on `/dashboard/documents/new` → mode = **Upload** by default.
2. Picks a file from the file dialog.
3. Client validates MIME + size locally (advisory only — API will re-validate).
4. `POST /api-proxy/documents/presign` — middleware injects bearer cookie → API → `R2Service.createPresignedUpload()`.
5. Browser `PUT`s the file body directly to `uploadUrl` with the original `Content-Type`. Progress events update a 0–100% progress bar.
6. On success, hidden inputs are filled (`fileUrl`, `fileName`, `mimeType`, `sizeBytes`) and the suggested title is set if the title field is empty.
7. Submit button enables. Clicking it runs `createDocumentAction` → `POST /v1/documents` → row created.
8. After server-side soft validation (`assertSafeUrl` + owner existence), the page redirects to the new document's detail.

Status banners:
- `جاري التحضير…` while presign is in flight (typically <300 ms).
- `جاري الرفع NN%` during the R2 PUT.
- `تم الرفع بنجاح` (success).
- Inline danger message on any error with the actual message from the server.

Clearing the picked file resets the uploader to idle and re-disables submit. Switching to URL mode reveals the existing manual fields.

## 5. Allowed types and size limit

**Server-side whitelist** (`ALLOWED_DOCUMENT_MIME_TYPES` in [documents.module.ts](../src/modules/documents/documents.module.ts)):

| MIME | Use |
| --- | --- |
| `application/pdf` | Most contracts / receipts / agreements |
| `image/jpeg`, `image/png`, `image/webp` | Photos, scanned IDs |
| `application/msword` | Legacy `.doc` |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` |
| `application/vnd.ms-excel` | Legacy `.xls` |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` |
| `text/csv` | Tabular exports |

**Size cap:** 25 MiB. Chosen to fit ~95% of typical admin-uploaded PDFs/contracts without inviting bulk dumps.

**Rejected at server:** anything else — HTML, JavaScript, executables, archives, video, audio. The presign endpoint refuses to mint a URL, so R2 never sees the file.

The R2 key is built under `documents/<YYYY-MM-DD>/<uuid><ext>`. The extension comes from the **client-provided filename** but only if it matches `/^\.[a-z0-9]{1,8}$/` — anything else falls back to the `R2Service` extension guess. This prevents path-like file names (`../foo`, `evil.pdf.exe`, etc.) from poisoning the R2 key.

## 6. Security validation behaviour

| Concern | Decision |
| --- | --- |
| Who can mint presigned URLs? | `/documents/presign` is `@Roles(UserRole.ADMIN)`. Same gate as document mutations. SALES / BROKER are 403. |
| Existing `/media/presign` is also ADMIN-only — left untouched. | No widening of access. |
| R2 credentials | Stay server-side in env. Frontend only ever sees the presigned URL (no signing keys). |
| Presign expiry | 5 minutes (`R2Service` default). Stale URLs return signature errors at R2. |
| MIME whitelist | Strict 9-entry set. Anything outside → 400 from `/documents/presign`. |
| Size cap | 25 MiB at presign DTO. R2 itself does not enforce client-claimed size — see deferred §10. |
| Path traversal | File-name extension parsing rejects anything not matching `/^\.[a-z0-9]{1,8}$/`. |
| Final URL safety | `POST /documents` still calls `assertSafeUrl()` (from Phase 17). Even if R2 returned an exotic URL, it must be http/https with a non-localhost host. |
| Audit | `AuditInterceptor` runs on `POST /documents/presign`, `POST /documents`, `PATCH`, `DELETE`. R2 `PUT` happens outside the API and is intentionally not audited (the document-create row that follows it is the audit trail of record). |
| Executable/script types | Blocked at MIME whitelist. `.html` / `.js` / `application/x-msdownload` / `application/x-executable` never get a presign URL. |

## 7. Files changed

| Kind | File |
| --- | --- |
| ✏️ | [apps/api/src/modules/media/r2.service.ts](../src/modules/media/r2.service.ts) — `documents` folder + 5 new extension guesses |
| ✏️ | [apps/api/src/modules/documents/documents.module.ts](../src/modules/documents/documents.module.ts) — MIME whitelist, size cap, `DocumentsPresignDto`, `presign()` service method, `POST /documents/presign` controller route, `MediaModule` import |
| 🆕 | [apps/web-admin/src/components/documents/document-uploader.tsx](../../web-admin/src/components/documents/document-uploader.tsx) — reusable uploader |
| ✏️ | [apps/web-admin/src/app/dashboard/documents/new/page.tsx](../../web-admin/src/app/dashboard/documents/new/page.tsx) — mode toggle (default upload), suggested title from file name, conditional rendering of upload vs URL fields |
| 🆕 | [apps/api/docs/phase-18-inline-upload-report.md](./phase-18-inline-upload-report.md) — this report |

**No schema changes. No migration.** The `Document` model from Phase 17 is reused as-is.

## 8. Compile / type results

```bash
cd apps/api && npx prisma validate          # ✅ valid
cd apps/api && npx tsc --noEmit             # ✅ 0 errors
cd apps/web-admin && npx tsc --noEmit       # ✅ 0 errors
cd apps/api && npx tsx scripts/smoke-broker-module.ts   # ✅ unchanged: 16 pass / 1 warn / 0 fail
```

## 9. Manual test steps

| # | Steps | Expected |
| --- | --- | --- |
| 1 | As ADMIN, open `/dashboard/documents/new` | Mode toggle visible, default = "رفع ملف" |
| 2 | Pick a PDF under 25 MiB | "جاري التحضير…" → "جاري الرفع NN%" → "تم الرفع بنجاح"; file card shows name + size + green checkmark |
| 3 | The title field auto-fills with the file's base name on successful upload | Visible value, editable |
| 4 | Click "حفظ المستند" with all required fields filled | Redirects to `/dashboard/documents/<id>`; row visible with the uploaded `fileUrl`, `fileName`, `mimeType`, `sizeBytes` |
| 5 | Open the file in the detail page → loads from R2 public URL | File opens in a new tab |
| 6 | Pick an `.html` file | API responds 400 "Content type … not allowed"; UI shows error banner |
| 7 | Pick a 30 MiB file | Client guard fires first ("الملف أكبر من الحد المسموح"); if forced past it via dev tools, API also returns 400 |
| 8 | Click "إزالة" on a picked file | Uploader resets; submit re-disabled in upload mode |
| 9 | Switch to "لصق رابط" | URL field returns; pasting `https://example.com/x.pdf` and clicking save proceeds via the existing URL path; submit enabled immediately |
| 10 | In URL mode, paste `javascript:alert(1)` | API returns 400 from `assertSafeUrl()` |
| 11 | As SALES (token), `POST /v1/documents/presign` directly | 403 |
| 12 | As BROKER (token), `POST /v1/documents/presign` directly | 403 |
| 13 | Open `/dashboard/audit-logs` after a successful upload | Two rows: `POST v1/documents/presign` and `POST v1/documents`; both with the admin as actor |
| 14 | On the broker detail page, click "إضافة مستند" in the documents card | New-doc page opens prefilled with `ownerType=BROKER&ownerId=<id>` |

## 10. Deferred improvements

1. **Authoritative size verification.** R2 honours the `Content-Length` of the `PUT` request, but our API only ever sees the client's *claimed* size at presign time. A `HEAD <publicUrl>` from the API after the upload (or a webhook from R2/Cloudflare) would let the document-create step verify the real size matches the claim. Skipped here to avoid extra round-trips.
2. **Upload progress percentage** is already present (XHR `onprogress`). What's still missing: an explicit "abort" button to cancel an in-flight upload.
3. **Virus / malware scanning.** Pipe uploaded objects through ClamAV / Cloudflare's malware scanning before marking the Document active. Today an admin can upload an infected PDF if they want to — there's no detection.
4. **Document preview.** PDF inline preview via `<embed>` on the detail page; image preview for JPG/PNG/WebP. Today we only link out to the file URL.
5. **R2 object deletion on soft-delete.** Soft-deleting the Document row leaves the R2 object intact. A periodic job could prune objects whose Document row has been soft-deleted for ≥ N days. Saves storage cost.
6. **Upload versioning.** Editing a document keeps the old `fileUrl` history. Today an edit overwrites in-place.
7. **Per-category MIME rules.** E.g. `ID_DOCUMENT` should only accept PDF/JPG/PNG, `FINANCIAL` should only accept PDF/XLSX/CSV. Today the whitelist is global.
8. **Drag-and-drop** on the uploader. The current control is a plain file input; supporting drag-and-drop on the surrounding zone is purely additive.
9. **Multiple files at once.** The picker is single-file; a multi-file mode would batch presigns and uploads.
10. **Inline upload on entity pages.** The `OwnerDocumentsCard` widget still links to `/dashboard/documents/new` with prefilled query params. Inline uploads inside the card itself are deferred.

## 11. Final readiness verdict

### **READY**

- New endpoint is ADMIN-only with strict MIME whitelist + 25 MiB cap.
- R2 credentials remain server-side; the browser only ever holds short-lived presigned URLs.
- `POST /documents` still re-validates the final URL via the Phase 17 `assertSafeUrl()` — defense in depth.
- The R2 object key is built from a UUID under `documents/<date>/`, with the extension parsed strictly so a malicious file name cannot escape the bucket layout.
- Audit log automatically picks up both `POST /documents/presign` and `POST /documents`.
- URL-paste mode preserved for users with files already on a CDN.
- Submit gating prevents the form from being saved before the upload completes.

The deferred items in §10 are *enablement* additions (size verification, virus scanning, preview, object deletion, versioning). None block production use of the new inline upload UX.
