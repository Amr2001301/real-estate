# Data Migration API — moving a company's data in from another system

> **للمالك:** ده الملف اللي تبعته للمبرمج في النظام التاني (زي «إنجاز»). فيه
> العنوان، والمفتاح بيتبعت إزاي، وشكل كل نوع بيانات. المفتاح نفسه بيطلع من
> صفحة الشركة عند السوبر أدمن («نقل بيانات من نظام تاني») ويظهر مرة واحدة بس.

This API lets another system (a CRM, a spreadsheet tool, a script) send one
company's data into this platform directly, without Excel files. It is the same
for every system: the sending side adapts to the format below.

---

## 1. Address and key

- **Address:** `https://<api-host>/v1/migration/<company>/` — the company's own
  address, shown with the key.
- **Key:** sent in the header `X-Migration-Key: mk_…` on every request. It works
  only at its company's address, until it expires (3–30 days) or the platform
  owner finishes the move.
- **Content type:** `application/json`.
- **Limit:** 120 requests a minute, up to **500 records** per request.

```bash
curl https://<api-host>/v1/migration/<company>/status -H "X-Migration-Key: mk_..."
```

`GET /status` returns the company, the system's name, when the key expires,
and how many records of each list arrived so far.

---

## 2. Sending a list

```
POST /v1/migration/<company>/{list}            → saves
POST /v1/migration/<company>/{list}?dryRun=true → checks everything, saves nothing
```

`{list}` is one of `projects`, `units`, `customers`, `leads`, `activities`.
Send them **in this order** — units name their project, leads their
customer/project/unit, activities their lead.

Body:

```json
{ "items": [ { "externalId": "123", "...": "..." } ] }
```

Response (always HTTP 200 once the key is accepted — each record has its own
outcome):

```json
{
  "dryRun": false,
  "received": 2,
  "created": 1,
  "updated": 0,
  "failed": 1,
  "results": [
    { "externalId": "123", "status": "created", "id": "…",
      "warnings": ["No price sent: set to 0"],
      "kept": { "extra": ["budget"], "unmapped": ["stage"] } },
    { "externalId": "124", "status": "error", "errors": ["phone: …"] }
  ]
}
```

- **`externalId`** is the record's id in *your* system. Sending the same
  `externalId` again **updates** the same record here, so a move can be
  repeated, fixed and resumed safely.
- One bad record never blocks the others. Fix it and send it again.
- **A dry run** checks each record against what has already been moved. Do the
  dry run of a list after the previous list was really sent.
- **Nothing is lost.** Any field that is not in the format below is kept as
  extra data (you can also group them under `"extra": { … }`). A value this
  platform does not recognise (a stage, a source, a unit type, a person) is
  kept too, and the platform owner maps it afterwards. Both are listed under
  `kept` in the result. Once the platform owner has mapped a value (say your
  stage «مهتم جداً» to `interested`), records sent after that use the mapping;
  the value is still listed under `kept`, since it is not one of the words
  this format knows.
- Moved-in data is history: no notifications go out, leads are not handed out
  to sales reps, no follow-up calls are scheduled.

Dates are ISO 8601 (`2025-03-01T10:00:00Z`); days are `YYYY-MM-DD`. Numbers
may be sent as numbers or numeric strings. Text values are matched without
regard to case, spaces, dashes, Arabic diacritics and tatweel, or Arabic
letter forms.

---

## 3. The lists

Required fields are marked **bold**.

### projects

| Field | Type | Notes |
|---|---|---|
| **externalId** | string ≤ 120 | |
| **name** | string ≤ 200 | |
| nameEn | string | English name, when different |
| code | string | 2–64 capital letters, digits, `-`. Made from `externalId` when left out. A project the company already has with this code is taken over. |
| city | string ≤ 100 | |
| description | string ≤ 5000 | |
| status | string | `draft`, `published`, `archived` (or Arabic). A moved-in project stays a **draft** until the company publishes it. |

### units

| Field | Type | Notes |
|---|---|---|
| **externalId** | string | |
| **projectExternalId** | string | the project's `externalId` (sent before) |
| **code** | string ≤ 40 | the unit number |
| phase | string | phase name — the project's first phase when left out (made if none) |
| building | string | building name — the phase's first building when left out |
| type | string | one of the company's unit types, by name or code; kept for mapping otherwise |
| area | number | m² (0 when left out) |
| price | number | (0 when left out) |
| floor, bedrooms, bathrooms | integer | |
| status | string | `available`. A unit **sold or booked** in your system is refused: here a unit is sold only by a contract and booked only by a reservation, which the company enters itself. |

A unit that has a reservation or contract here is no longer changed.

### customers

| Field | Type | Notes |
|---|---|---|
| **externalId** | string | |
| **fullName** | string ≤ 200 | |
| **phone** | string | international (`+20…`) or local; the company's account for that phone is updated if it exists |
| email | string | |
| nationalId | string | 5–20 letters/digits (national ID or passport) |
| address | string ≤ 300 | |
| birthDate | `YYYY-MM-DD` | |
| occupation, employer | string ≤ 120 | |

A phone that belongs to a staff member of the company is refused.

### leads

| Field | Type | Notes |
|---|---|---|
| **externalId** | string | |
| **fullName** | string | |
| **phone** | string | the lead's person: the customer with that phone, or a new one |
| email | string | |
| stage | string | `new`, `interested`, `visit`, `negotiation`, `won`, `lost` (or common words / Arabic). Not recognised → `new`, kept for mapping. |
| source | string | one of the company's lead sources by name. Not one of them → filed under «نقل بيانات» (Data migration), kept for mapping. |
| assignedTo | string | the sales person's e-mail or phone here. Unknown → unassigned, kept for mapping. |
| projectExternalId, unitExternalId | string | interest (sent before) |
| createdAt | date-time | when the lead came in (kept as is) |
| nextActionAt | date-time | the next follow-up |
| note | string ≤ 5000 | a first note (first sending only) |

### activities

Calls, meetings, WhatsApp messages, follow-ups and notes on a lead.

| Field | Type | Notes |
|---|---|---|
| **externalId** | string | |
| **leadExternalId** | string | the lead's `externalId` (sent before) |
| **text** | string ≤ 5000 | |
| kind | string | `call`, `meeting`, `whatsapp`, `follow_up`, `note` (or Arabic). Not recognised → note, kept for mapping. |
| callResult | string | calls only: `answered`, `no_answer`, `busy`, `unreachable`, `wrong_number` |
| at | date-time | when it happened |
| by | string | the staff member's e-mail or phone here (the lead's rep, else the company's admin, when unknown) |

---

## 4. Errors before any record is read

| HTTP | Meaning |
|---|---|
| 401 | key missing, wrong, expired or finished, or not this company's |
| 404 | no company at this address |
| 400 | unknown list, or `items` missing / empty / over 500 |
| 429 | over 120 requests a minute — wait and retry |

## 5. Example

```bash
API=https://<api-host>/v1/migration/<company>
KEY=mk_...

curl -X POST "$API/projects?dryRun=true" -H "X-Migration-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"items":[{"externalId":"p-1","name":"كمبوند النخيل","city":"القاهرة الجديدة"}]}'

curl -X POST "$API/projects" -H "X-Migration-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"items":[{"externalId":"p-1","name":"كمبوند النخيل","city":"القاهرة الجديدة"}]}'

curl -X POST "$API/leads" -H "X-Migration-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"items":[{"externalId":"L-77","fullName":"أحمد علي","phone":"01001234567","stage":"Interested",
       "source":"Facebook","projectExternalId":"p-1","createdAt":"2025-03-01T10:00:00Z","budget":"3,000,000"}]}'
```

(`budget` is not in the format: it is kept with the lead for the platform owner
to map.)
