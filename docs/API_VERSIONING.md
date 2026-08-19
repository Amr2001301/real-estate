# API Versioning Strategy

## Current State

The Devora backend exposes a single versioned API surface:

- **Global prefix**: `/v1`  
- **Response header**: `X-API-Version: 1` (set by `ApiVersionInterceptor` on every response)
- **Swagger**: available at `/docs`

All endpoints are in the `/v1` namespace. No `/v2` or later namespaces exist yet.

## Deprecation Policy

Before removing or making a breaking change to any existing endpoint:

1. **6-month notice**: Add `Deprecated` notice to the endpoint's Swagger doc (`@ApiOperation({ deprecated: true })`).
2. **Response header**: Include `Deprecation: true` and `Sunset: <ISO date>` headers on deprecated endpoints.
3. **Changelog entry**: Record the planned removal date in `CHANGELOG.md`.
4. Mobile apps that ship to stores cannot be force-updated instantly — give at least one release cycle beyond the Sunset date before hard-removing the endpoint.

## How to Introduce `/v2`

When a breaking change is necessary:

1. Create a new controller class (or route file) for `/v2/<resource>`.
2. Register it alongside the existing `/v1` controller in the module's `controllers` array.
3. Keep the `/v1` endpoint alive for the deprecation window.
4. Do **not** change `setGlobalPrefix` — the v2 prefix is set per-controller via `@Controller('v2/resource')`.
5. Update `ApiVersionInterceptor` to set `X-API-Version: 2` only when the request path begins with `/v2/`.

Example:

```typescript
// v1 stays as-is
@Controller('v1/leads')
export class LeadsV1Controller { ... }

// New v2 with breaking shape changes
@Controller('v2/leads')
export class LeadsV2Controller { ... }
```

## Mobile Client Upgrade Strategy

Mobile clients (Flutter) consume `/v1` endpoints. When a `/v2` endpoint introduces a breaking change:

| Scenario | Strategy |
|---|---|
| Field added (non-breaking) | Existing clients ignore unknown fields — no action needed |
| Field renamed / removed | Deploy `/v2` first, then release app update that calls `/v2`, keep `/v1` alive for deprecation window |
| Status enum value added | Clients use `default` branches in switch — no action needed |
| Auth flow change | Force-update via store using `minimum_version` from `/v1/app-config` |

**Graceful degradation**: The mobile app checks the `X-API-Version` header. If it receives a version higher than it supports, it shows an "update available" banner (non-blocking) rather than crashing. A hard force-update is reserved for security-critical breaking changes only.

## Adding a New Permission Code

Permission codes are stored in the database and seeded. When adding a new permission:

1. Add the code to `seed.ts` in the appropriate permission group.
2. Assign it to relevant roles in the seed.
3. Run `pnpm prisma db seed` against staging before merging.
4. Document the new code in `apps/api/src/common/decorators/permissions.decorator.ts`.

## Response Header Reference

| Header | Value | Set by |
|---|---|---|
| `X-API-Version` | `1` | `ApiVersionInterceptor` (global) |
| `Content-Type` | `application/json` | NestJS |
| `X-Request-Id` | UUID | `RequestLoggerInterceptor` (if enabled) |
