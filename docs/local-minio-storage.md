# Local object storage — MinIO

> **Local development only.** Production continues to use Cloudflare R2
> via the same S3 client — no production code paths change. The default
> MinIO credentials below (`minioadmin` / `minioadmin`) are MinIO's
> well-known defaults, intended **only** for an isolated local install.

The media service ([apps/api/src/modules/media/r2.service.ts](../apps/api/src/modules/media/r2.service.ts))
talks the AWS S3 protocol. When `S3_ENDPOINT` is set it points at any
S3-compatible server (MinIO, LocalStack, …) with path-style addressing.
When `S3_ENDPOINT` is unset and `R2_ACCOUNT_ID` is set, the same code
falls back to the `https://${accountId}.r2.cloudflarestorage.com`
endpoint — that path is **unchanged** and is what production uses.

## TL;DR — first run

```bash
# 1. Install MinIO + the mc client (Homebrew). Skip if you already have them.
brew install minio minio-mc

# 2. Run MinIO on :9000 (S3) + :9001 (console). The data dir is local;
#    delete it any time to reset.
mkdir -p ~/minio-data
MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin \
  minio server ~/minio-data --address :9000 --console-address :9001 \
  > /tmp/minio.log 2>&1 &

# 3. Create the bucket + grant anonymous downloads so <img src> works.
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb --ignore-existing local/real-estate-media
mc anonymous set download local/real-estate-media

# 4. Point the API at MinIO (already done in apps/api/.env when this guide
#    was set up; the relevant block is reproduced below).
# 5. Restart the API and you're done.
pnpm --filter @rep/api dev
```

## Env vars

Set these in [apps/api/.env](../apps/api/.env) (gitignored). The
committed [apps/api/.env.example](../apps/api/.env.example) documents
them too.

```env
# Generic S3 endpoint — turns the R2 client into a MinIO client.
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true

# Reused R2_* keys for credentials and bucket. Account ID stays empty
# so S3_ENDPOINT is preferred over the R2 endpoint construction.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=minioadmin
R2_SECRET_ACCESS_KEY=minioadmin
R2_BUCKET=real-estate-media

# Public URL the dashboard/website embed for <img src>. Path-style URL
# pointing at the same MinIO endpoint with the bucket name in the path.
R2_PUBLIC_URL=http://localhost:9000/real-estate-media
```

Why reuse the `R2_*` names for keys/bucket/public URL? — to keep the
code simple. The S3 client treats credentials and bucket names the same
regardless of the provider; only the endpoint differs.

## Why path-style is mandatory

Cloudflare R2 (and AWS S3) default to **virtual-hosted** addressing —
`https://<bucket>.account.r2.cloudflarestorage.com/<key>`. MinIO and most
local emulators don't do DNS-style hostnames for buckets, so the request
must be **path-style** — `http://localhost:9000/<bucket>/<key>`.

The S3 client passes `forcePathStyle: true` when `S3_ENDPOINT` is set
(or you can set `S3_FORCE_PATH_STYLE=true` explicitly). Production R2
leaves `S3_ENDPOINT` unset, never sees that flag, and continues to use
virtual-hosted URLs.

## Anonymous downloads — why

A signed PUT URL lets the dashboard upload. After upload, the
**browser** must be able to display the image via plain `<img src="...">`
without re-signing. The simplest way locally is the `anonymous set
download` policy applied to the whole bucket: anyone with a key can
GET, nobody can list or write. That's only safe in a local dev box —
production R2 keeps the bucket private and uses signed download URLs for
private assets ([R2Service.createPresignedDownload](../apps/api/src/modules/media/r2.service.ts)).

## Browser ⇄ API endpoint consistency

The browser uploads to whatever host is in the signed URL. If the API
ran inside Docker and signed `http://minio:9000/...`, the browser
would fail (it can't reach `minio`). The local setup avoids this by
running the API **on the host** (`pnpm --filter @rep/api dev`) and
having both the API and the browser hit the same `localhost:9000`
MinIO endpoint. The signature stays valid because the host the API
signed for is exactly the host the browser uses.

## Docker compose (alternative)

[docker-compose.yml](../docker-compose.yml) defines a `minio` service
and a `createbuckets` init container under the existing `infra`
profile. If you do use Docker, the equivalent of steps 1–3 above is:

```bash
docker compose --profile infra up -d minio createbuckets
```

`createbuckets` runs `mc mb` + `mc anonymous set download` idempotently
on every up — safe to re-run.

> The Bash steps in TL;DR and the Docker path are **parallel options** —
> use one or the other, not both. The committed env files target the
> host-native path (`http://localhost:9000`); when running everything in
> Docker, swap `S3_ENDPOINT` for `http://minio:9000` inside the API
> container's env and keep `R2_PUBLIC_URL` on `http://localhost:9000/...`
> (the browser still needs to reach the host-published port).

## Production behavior — unchanged

`R2Service` constructor logic ([r2.service.ts](../apps/api/src/modules/media/r2.service.ts)):

1. `S3_ENDPOINT` + access key + secret → MinIO/S3-compatible client (path-style).
2. else `R2_ACCOUNT_ID` + access key + secret → Cloudflare R2 client (virtual-hosted).
3. else no client → presign calls throw `503 Service Unavailable`.

Production deployments set the R2 keys and leave `S3_ENDPOINT` unset →
path (2) is taken, identical to before this change. The production
checks in [env.validation.ts](../apps/api/src/config/env.validation.ts)
still require all five `R2_*` vars in `NODE_ENV=production`.

## Verify it works

```bash
# 1. Hit presign as admin — must return 201, not 503.
access=$(curl -s -X POST http://localhost:4000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@local.test","password":"Admin12345!"}' \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

curl -s -X POST http://localhost:4000/v1/media/presign \
  -H "Authorization: Bearer $access" \
  -H 'Content-Type: application/json' \
  -d '{"contentType":"image/png","folder":"projects"}'

# 2. The response includes uploadUrl, key, publicUrl.
#    PUT a file to uploadUrl, then anonymous GET publicUrl — both 200.
```

## Reset

```bash
# Wipe all uploaded objects (keeps the bucket).
mc rm --recursive --force local/real-estate-media

# Or nuke the data dir entirely (also kills the bucket; recreate after).
kill %1   # stop minio (if started via the `&` background job)
rm -rf ~/minio-data
```

## Known limitations

- No HTTPS — fine locally; production R2 always serves HTTPS.
- Anonymous bucket read — intentional for local; never apply this
  policy to a production bucket.
- No lifecycle rules / CORS preflight tuning — adequate for dashboard
  uploads (same-origin signed PUT to `localhost:9000`).
- MinIO's console at http://localhost:9001 ships a default UI; do not
  expose port 9001 outside the local machine.
