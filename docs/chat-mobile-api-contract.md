# Chat Assistant — Mobile API Contract (v1)

The chat assistant is a **free, deterministic rule-based** engine. There is **no
LLM, no paid AI provider, no API key, and no external AI call**. Mobile apps talk
to the same public endpoints the website uses; only `source` differs.

- Base URL: `{API_BASE_URL}/v1`
- All chat endpoints are **public + anonymous** (no auth token required).
- Content type: `application/json`. Responses are JSON.
- Language: Arabic-first (`locale` defaults to `ar`).

## Identity & state

- The client generates a stable **`anonymousId`** (UUID) once and stores it on the
  device. Send it on every request. It scopes ownership of a session — a request
  with a non-matching `anonymousId` returns **404** (no existence leak).
- The server returns a **`sessionId`** on session creation; persist it on device.
- Multi-turn state (slot-filling, active lead-capture flow) lives **server-side**
  in the session — the client does **not** send conversation state back. Just send
  the next user message to the same `sessionId` + `anonymousId`.

## Endpoints

### 1) Create session — `POST /chat/sessions`
Request:
```json
{ "anonymousId": "<uuid>", "source": "MOBILE", "locale": "ar" }
```
- `source`: `WEB` | `MOBILE` (default `WEB`). **Mobile clients send `"MOBILE"`.**
- `locale`: `ar` | `en` (optional, default `ar`).
- `metadata`: optional object (reserved).

Response `201`:
```json
{
  "sessionId": "f534d4d2-…",
  "greeting": "مرحبًا! أنا المساعد العقاري …",
  "quickReplies": ["أبحث عن شقة", "أبحث عن مشروع", "كيف أحجز زيارة؟", "تواصل مع مستشار"]
}
```
Render `greeting` as the first assistant bubble and `quickReplies` as chips.

### 2) Send message — `POST /chat/sessions/:id/messages`
Request:
```json
{ "anonymousId": "<uuid>", "content": "عايز فيلا في الرياض" }
```
- `content`: 1–2000 chars (enforced; empty or >2000 → **400**).

Response `201` (`AssistantOutput`):
```json
{
  "message": { "id": "<uuid>", "role": "ASSISTANT", "content": "وجدت 2 فيلا في الرياض:\nملاحظة: …" },
  "cards": [ /* see Cards */ ],
  "ctas": [ /* see CTAs */ ],
  "quickReplies": ["عرض المزيد", "غيّر الميزانية", "غيّر المدينة", "احجز زيارة"],
  "missingFields": ["city"]
}
```
- `message.id` is the real id — use it for feedback.
- `cards`, `ctas`, `quickReplies`, `missingFields` may be empty arrays.
- `missingFields` (e.g. `["city"]`, `["consent"]`, `["property"]`) signals the
  assistant is asking for that field — the next user message answers it.
- **No token/usage fields are returned.**

### 3) Restore session — `GET /chat/sessions/:id?anonymousId=<uuid>`
Response `200`:
```json
{
  "session": { "id": "…", "source": "MOBILE", "locale": "ar", "status": "ACTIVE", "createdAt": "…" },
  "messages": [ { "id": "…", "role": "USER", "content": "…", "createdAt": "…" }, … ]
}
```
- Restored `messages` carry **text only** (no cards/ctas/quickReplies — those are
  per-turn and not persisted). On restore failure (404), clear the stored
  `sessionId` and create a new session.

### 4) Feedback — `POST /chat/sessions/:id/feedback`
```json
{ "anonymousId": "<uuid>", "messageId": "<assistant message id>", "rating": "UP" }
```
- `rating`: `UP` | `DOWN`. `messageId` and `comment` optional. Response: `{ "ok": true }`.

## Cards shape (`cards[]`)
Discriminated by `type`. All values come from the public catalog — **never
fabricated**. Tap → open the detail screen at `href`.

```ts
type Card =
  | { type: 'unit'; id; title; subtitle?; price?: string; area?: number;
      bedrooms?: number; bathrooms?: number; city?: string; imageUrl?: string|null; href: string }
  | { type: 'project'; id; title; subtitle?; city?: string; imageUrl?: string|null; href: string }
```
- `price` is a pre-formatted string (e.g. `"5,800,000 ج.م"`) or omitted.
- `href` is `"/units/:id"` or `"/projects/:id"` — map to the mobile route/deeplink.
- Max 5 cards per turn.

## CTAs shape (`ctas[]`)
```ts
type Cta = {
  kind: 'link' | 'whatsapp' | 'visit' | 'info';
  label: string;
  href?: string;                       // for kind 'link'
  action?: 'whatsapp' | 'request_visit' | 'request_info';
  payload?: { message?: string };      // for kind 'whatsapp'
}
```
- **`whatsapp`**: the backend supplies only a prefilled `payload.message`. The
  **client owns the phone number** (from its own config/env) and builds the
  `wa.me` / WhatsApp deep link: `https://wa.me/<digits>?text=<urlencoded message>`.
  If no number is configured, hide the CTA. **The phone is never returned by the API.**
- **`link`**: internal app route (`href` starts with `/`) or external URL — open
  accordingly.

## Quick replies (`quickReplies[]`)
Array of Arabic strings. Render as chips; tapping one sends its **text** as the
next message (same `POST …/messages`).

## Conversion flows (lead capture)
Driven entirely by sending messages; state is server-side. The assistant asks one
field at a time (reflected in `missingFields`) and **creates nothing until explicit
consent**.

- **Info request:** triggered by intent (e.g. "عايز معلومات") → collects `name`
  → `phone` → consent. Consent prompt asks
  "هل توافق على استخدام بياناتك للتواصل معك…"; accept with "نعم"/"موافق"/"تمام".
  On consent → creates an info request; replies "تم استلام طلبك بنجاح ✅".
- **Visit request:** triggered by "احجز زيارة" → if recent results exist, asks the
  user to pick by number (`missingFields:["property"]`, quick replies `"1".."N"`)
  → `preferredDate` (accepts "اليوم"/"بكرة"/"بعد بكرة" or `YYYY-MM-DD`) → `name`
  → `phone` → consent → creates a visit request. If no property context, the
  assistant asks the user to search first.
- **Phone:** Egyptian local `01XXXXXXXXX` is normalized to `+20…`; validated as
  E.164 (`^\+?[1-9]\d{7,14}$`). Invalid input re-asks.
- **Cancel:** send "إلغاء" to abort the flow.
- **On backend failure:** a safe Arabic error is returned (no fake success); the
  flow stays at consent so the user can retry by confirming again.

## Error handling
- `400` invalid body (empty/oversized `content`, malformed payload).
- `404` session not found **or** `anonymousId` mismatch — recreate the session.
- `429` rate limit exceeded (see below) — back off and retry.
- Client should show a friendly Arabic message and a retry affordance; never block
  the rest of the app if chat is unavailable.

## Rate limits (throttling, per IP, 60s window)
| Endpoint | Limit |
|---|---|
| `POST /chat/sessions` | 20 / min |
| `POST /chat/sessions/:id/messages` | 30 / min |
| `GET /chat/sessions/:id` | 60 / min |
| `POST /chat/sessions/:id/feedback` | 20 / min |

## Limitations
- Rule-based (deterministic), **not** an LLM: it understands a fixed vocabulary of
  Arabic intents, property types, and **cities present in the catalog dictionary**.
  Unknown phrasing falls back to a guided menu.
- Search filters map to the public catalog: city is an **exact match**; unit
  `type` is an exact match against the catalog's `type` values (see Known Issues in
  the QA report — the rule dictionary's type/city vocabulary must stay aligned with
  the catalog taxonomy and region).
- Availability/prices come only from current public listings; the assistant always
  appends "أكّد التوفر والسعر مع فريق المبيعات".
- No access to private/account data (contracts, deposits, maintenance, profile),
  no online payment, no legal/financial advice.
- Restored history is text-only (cards/CTAs are per-turn).
