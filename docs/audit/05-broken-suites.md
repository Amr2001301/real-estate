# Broken Test Suites — Pre-existing Failures

> Generated 2026-09-13. Scope: two suites that are currently broken in `main`
> and were already broken before the fix-phase changes in this audit cycle.
> No fix-phase change created or widened any of these failures.

---

## Verification: failures are pre-existing

Both suites were run twice — once on the clean tree (git stash, HEAD = 3c7378c)
and once with all fix-phase changes applied.

**Clean tree (git stash):**

```
FAIL src/modules/reservations/__tests__/reservation-conversion-workflow.spec.ts
  ● Reservations · conversion workflow › converts an APPROVED reservation…
  ● Reservations · conversion workflow › materializes installment plan…
  ● Reservations · conversion workflow › skips FINAL_PAYMENT row…
  ● Reservations · conversion workflow › inherits broker attribution…
  ● Reservations · conversion workflow › converting with an uploaded pdfUrl…
  ● Reservations · conversion workflow › converting without a pdfUrl…
FAIL src/modules/notifications/__tests__/notifications-permissions.spec.ts
  ● @Permissions metadata › listTemplates → notifications:templates:manage…
  … (25 tests)
  ● Test suite failed to run
Tests:       31 failed, 9 passed, 40 total
```

**With fix-phase changes:**

```
FAIL src/modules/reservations/__tests__/reservation-conversion-workflow.spec.ts
  ● Reservations · conversion workflow › converts an APPROVED reservation…
  ● Reservations · conversion workflow › materializes installment plan…
  ● Reservations · conversion workflow › skips FINAL_PAYMENT row…
  ● Reservations · conversion workflow › inherits broker attribution…
  ● Reservations · conversion workflow › converting with an uploaded pdfUrl…
  ● Reservations · conversion workflow › converting without a pdfUrl…
FAIL src/modules/notifications/__tests__/notifications-permissions.spec.ts
  ● @Permissions metadata › listTemplates → notifications:templates:manage…
  … (25 tests)
  ● Test suite failed to run
Tests:       31 failed, 9 passed, 40 total
```

**Result:** Failure count identical (31). Failing test names identical. No test that
passed on the clean tree fails with fix-phase changes applied.

---

## Suite 1 — `notifications-permissions.spec.ts`

### Symptom

The entire suite fails to compile at `Test.createTestingModule().compile()` with:

```
Nest can't resolve dependencies of the AuthService
(PrismaService, JwtService, ?, SmsService, EmailService).
Please make sure that the argument ConfigService at index [2]
is available in the AuthModule context.
```

All 25 tests report the same DI error; `app` is never assigned so `afterAll`
also throws `TypeError: Cannot read properties of undefined (reading 'close')`.

### Root cause

Commit `06a6172` (2026-08-20 "fix gaps") added

```typescript
import { AuthModule } from '../auth/auth.module';
// …
@Module({ imports: [AuthModule] })
export class NotificationsModule {}
```

`AuthModule` registers `PassportModule.registerAsync({ inject: [ConfigService] })`.
`ConfigService` requires `ConfigModule` to be in scope, but the test module
does not import `ConfigModule`:

```typescript
// notifications-permissions.spec.ts (broken setup)
await Test.createTestingModule({
  imports: [MockPrismaModule, NotificationsModule],   // ← no ConfigModule
  …
}).compile();
```

The spec was last modified in commit `6d2b5b8` (2026-06-20 "firebase") — six
weeks before the `AuthModule` import was added to the production module. The
spec was never updated to add `ConfigModule.forRoot({ isGlobal: true,
ignoreEnvFile: true })` (the pattern used by all other working specs that
pull in modules with `ConfigService` dependencies).

### When it broke

`06a6172` — 2026-08-20. The suite has been broken for ≥3 weeks at HEAD.

### Git log

```
spec:    6d2b5b8 2026-06-20  firebase
subject: 06a6172 2026-08-20  fix gaps  ← broke the spec by adding AuthModule
```

### Production behaviour now unverified

All notifications permission enforcement is dark:

| What is unverified | Risk |
|---|---|
| `listTemplates` (GET /notification-templates) → requires `notifications:templates:manage` | SALES could bypass if gate regresses |
| `upsertTemplate` (POST /notification-templates) → requires `notifications:templates:manage` | Same |
| `send` (POST /notifications/send) → requires `notifications:send` | Unauthorized push possible |
| `broadcast` / `previewBroadcast` → ADMIN-only | Role enforcement unverified |
| ADMIN bypass on all three admin routes | Could silently require a code if adminBypass regresses |
| Self-service /me routes return 200 for CLIENT/CUSTOMER/BROKER with zero codes | Cross-role accidental lock-out undetected |
| SALES blocked at @Roles on admin routes despite having the permission code | Role gate regression invisible |
| `upsertTemplate` cross-tenant overwrite guard (STEP 4 fix) | The service-layer guard added in STEP 4 has **zero test coverage** — see Section 5 below |

---

## Suite 2 — `reservation-conversion-workflow.spec.ts`

### Symptom

All 6 success-path tests return `expected 201 "Created", got 500 "Internal Server Error"`.

The Nest error log shows:

```
[ExceptionsHandler] Cannot read properties of undefined (reading 'updateMany')
TypeError: Cannot read properties of undefined (reading 'updateMany')
```

The 9 validation/rejection tests (status not APPROVED, booking unpaid, etc.)
still pass because they 400 before reaching the transaction body.

### Root cause

Commit `d489400` (2026-08-18 "edit") added the following block inside the
`$transaction` callback of the conversion handler in `reservations.module.ts`:

```typescript
// reservations.module.ts lines 1679–1691
const promoted = await tx.user.updateMany({
  where: { id: customerId, role: UserRole.CLIENT },
  data: { role: UserRole.CUSTOMER },
});
// Invalidate active refresh tokens so the portal immediately reflects the
// new CUSTOMER role
if (promoted.count > 0) {
  await tx.refreshToken.updateMany({     // ← NEW in d489400
    where: { userId: customerId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
```

The spec's `$transaction` mock builds its `tx` proxy from a hard-coded object:

```typescript
// reservation-conversion-workflow.spec.ts
m.$transaction.mockImplementation(async (ops) => {
  if (typeof ops === 'function') {
    const tx = {
      reservation: m.reservation,
      reservationActivity: m.reservationActivity,
      leadActivity: m.leadActivity,
      unit: m.unit,
      unitStatusHistory: m.unitStatusHistory,
      user: m.user,
      contract: m.contract,
      installmentPlan: m.installmentPlan,
      installment: m.installment,
      deposit: m.deposit,
      lead: m.lead,
      // ← refreshToken is absent
    };
    return (ops as (tx) => Promise<unknown>)(tx);
  }
});
```

`m.user.updateMany` is mocked to return `{ count: 1 }`, so the
`if (promoted.count > 0)` branch always fires, and `tx.refreshToken.updateMany`
throws immediately.

The spec was last modified in commit `c644ca8` (2026-08-12 "ready for
production") — four days before `d489400` added the `refreshToken` call.

### When it broke

`d489400` — 2026-08-18. The suite has been broken for ≥3 weeks at HEAD.

### Git log

```
spec:    c644ca8 2026-08-12  ready for production
subject: d489400 2026-08-18  edit  ← added tx.refreshToken.updateMany, broke spec
```

### Production behaviour now unverified — reservation→contract conversion

The 6 broken tests covered the entire success path of `POST /reservations/:id/convert`.
The following financial logic is currently untested:

| # | What is unverified | Financial consequence |
|---|---|---|
| 1 | `contract.create` called exactly once, `signedAt = null` | The convert-to-signed bypass closure (security fix from prior phase) has no coverage — a regression would silently re-open the bypass |
| 2 | Broker attribution inherited: `brokerId` and `brokerAgentId` written onto the contract | Wrong attribution means commission calculations run against the wrong broker |
| 3 | `installmentPlan.create` called with correct `totalMonths` and `frequency = MONTHLY` | Plan materialization is silent if the call is skipped or misconfigured |
| 4 | `installment.create` called for DOWN_PAYMENT row when `snapshotDownPaymentAmount > 0` | Down payment row could silently vanish |
| 5 | `installment.createMany` called once with N monthly INSTALLMENT rows | Missing rows means clients are under-billed |
| 6 | FINAL_PAYMENT row NOT created when `snapshotFinalPaymentAmount = 0` | A zero final payment row would over-bill the customer |
| 7 | `unit.update` sets status to SOLD; `unitStatusHistory.create` fires | Unit stuck in RESERVED; inventory count wrong; double-sale possible |
| 8 | `reservation.update` sets status to CONVERTED with a CONVERTED activity row | Reservation stays APPROVED; agents can re-convert |
| 9 | `lead.update` advances stage to WON for bumpable stages (NEGOTIATION) | CRM pipeline metrics wrong; lead re-assigned |
| 10 | `user.updateMany` promotes CLIENT to CUSTOMER | Portal role stuck at CLIENT; customer cannot see contracts |
| 11 | Response body contains `{ contractId }` | Web/app clients silently receive empty or wrong contract reference |
| 12 | PDF document linked as CUSTOMER_VISIBLE CONTRACT document after conversion | Contract document invisible to customer in the portal |
| 13 | `contract_created_customer` notification sent after conversion | Customer receives no confirmation notification |

In summary: **the entire reservation-to-contract financial pipeline — contract
creation, installment materialization, unit state machine, CLIENT→CUSTOMER
promotion, and post-conversion notifications — has zero running unit-test
coverage** at HEAD.

---

## Fix required for both suites

These are straightforward mock gaps, not production bugs. Neither requires a
source change:

**Suite 1 (`notifications-permissions`):** Add
`ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })` to the
`Test.createTestingModule` imports array.

**Suite 2 (`reservation-conversion-workflow`):** Add a `refreshToken` entry to
the `tx` object inside `$transaction.mockImplementation`:

```typescript
const tx = {
  // … existing keys …
  refreshToken: {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
};
```

Both fixes are one-line changes in the spec files only.
