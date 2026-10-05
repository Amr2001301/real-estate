# Finding: Presigned PUT URLs carry no size limit

> Recorded 2026-10-05. Severity: Medium (cost/availability; no data exposure or
> tenant-isolation impact). Fixed in this session.

---

## What was wrong

`MediaService.presign()` and `DocumentsService.presign()` both validate
`dto.sizeBytes` against their respective caps (`MAX_MEDIA_UPLOAD_SIZE_BYTES`
= 50 MiB, `MAX_DOCUMENT_SIZE_BYTES` = 25 MiB), and `branding` assets against
stricter per-asset limits. However `sizeBytes` was never forwarded into the
`R2Service.createPresignedUpload()` call, so it never appeared in the
`PutObjectCommand` and was therefore **absent from the presigned URL signature**.

```
// before — sizeBytes silently discarded
r2.createPresignedUpload({
  contentType: dto.contentType,
  folder: dto.folder,
  extension: dto.extension,   // sizeBytes not here
});
```

A caller could declare `sizeBytes: 1`, receive a presigned URL, and PUT any
number of bytes to it. The storage backend had no way to enforce the declared
limit because `Content-Length` was not a signed header.

## Reachable endpoints

All five presign endpoints were affected:

| Endpoint | Accessible by | Cap before fix |
|---|---|---|
| `POST /v1/media/presign` | ADMIN | 50 MiB (advisory only) |
| `POST /v1/documents/presign` | ADMIN | 25 MiB (advisory only) |
| `POST /v1/deposits/me/payments/presign` | CUSTOMER | 25 MiB (advisory only) |
| `POST /v1/me/maintenance-requests/:id/documents/presign` | CUSTOMER / SUPERVISOR | 25 MiB (advisory only) |
| (staff app maintenance presign via supervisor path) | SUPERVISOR | 25 MiB (advisory only) |

The `ContentType` header **was** signed (correctly enforcing the MIME
allowlist). Only the size was unbound.

## Impact

Cost and object-storage availability only. A customer could upload a large
file (e.g. a 4 GB video) to the receipts or maintenance bucket using a URL
signed for 1 KB. No tenant data is exposed and no authorization boundary is
crossed; R2/MinIO object namespace is tenant-scoped by folder prefix, not
companyId, so a successful upload lands in the correct bucket but larger than
declared.

## Fix

`sizeBytes` is now threaded through to `PutObjectCommand.ContentLength`:

```typescript
// r2.service.ts — createPresignedUpload opts now accept sizeBytes
const command = new PutObjectCommand({
  Bucket: bucket,
  Key: key,
  ContentType: opts.contentType,
  ...(opts.sizeBytes !== undefined ? { ContentLength: opts.sizeBytes } : {}),
});
```

Both callers (`MediaService.presign`, `DocumentsService.presign`) forward
`dto.sizeBytes` into `createPresignedUpload`. When `ContentLength` is present
in a `PutObjectCommand`, `@aws-sdk/s3-request-presigner` adds `content-length`
to `X-Amz-SignedHeaders` in the generated URL. MinIO and R2 then enforce that
the actual `Content-Length` header in the PUT request matches the signed value;
a mismatch returns `403 SignatureDoesNotMatch`.

## Client impact

None. Both clients already send `Content-Length` equal to the declared
`sizeBytes`:

- **Web (XHR)**: presign request uses `sizeBytes: file.size`; `xhr.send(file)`
  causes the browser to set `Content-Length: file.size` automatically.
- **Mobile (Dart/Dio)**: presign request uses `sizeBytes: bytes.length`;
  `putToSignedUrl` sets `Headers.contentLengthHeader: bytes.length` on the
  same buffer — always the same value.

## Test

`test/e2e/e2e-maintenance.e2e-spec.ts` — `G-SIZE` describe block (runs in
`api-e2e-2` with MinIO):

- **G-SIZE-1**: Presign for `TINY_JPEG.length` bytes, PUT `TINY_JPEG` → 200.
  Confirms the happy path still works.
- **G-SIZE-2**: Presign for 1 byte, PUT `TINY_JPEG` (which is larger) → 403.
  Fails (returns 200) without the fix; passes after.

## Caveat — R2 production verification

The G-SIZE test exercises MinIO in CI. Cloudflare R2 is S3 Signature V4
compatible and should enforce signed headers identically, but it should be
verified with a smoke test after the first production deploy. If R2 does not
enforce signed ContentLength, the fallback control is `createPresignedPost`
with a `content-length-range` policy condition — a stronger server-side
enforcement but requires client changes (multipart form POST instead of
direct PUT).
