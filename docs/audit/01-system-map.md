# System Map — Real Estate SaaS Platform
**Audit date:** 2026-09-12  
**Auditor:** Claude Code (claude-sonnet-4-6)  
**Repo root:** `/Users/amr/Real Estate`

---

## Section 1 — Feature Inventory

All modules live under `apps/api/src/modules/`.  
Status key: **DONE** = full service + controller with real logic | **PARTIAL** = code present but documented gaps | **STUB** = structural skeleton only | **DEAD-CODE** = no usages from any other module and no test.

| Module | Path(s) | Status | Notes |
|---|---|---|---|
| audit | `modules/audit/audit.module.ts` | DONE | Full service + controller in single file. Provides list, findOne, and operations summary. ADMIN-only. `audit.module.ts:51–207` |
| auth | `modules/auth/auth.{service,controller}.ts` + `email.service.ts`, `sms.service.ts`, `jwt.strategy.ts`, `tenant-resolver.service.ts` | DONE | Email+password login, OTP, refresh, password-reset, email-verify, self-service profile. Has `@deprecated` `/auth/login` redirect with telemetry header. `auth.service.ts:1` |
| bonus | `modules/bonus/bonus.module.ts` | DONE | Bonus rules, entries, targets, XLSX/CSV export, auto-commission materialisation from signed contracts, sales performance report. All in one large file. `bonus.module.ts:1` |
| broker-access | `modules/broker-access/broker-access.{service,controller}.ts` | DONE | Manage project/unit access grants for a broker. `broker-access.controller.ts:1` |
| broker-commissions | `modules/broker-commissions/broker-commissions.{service,controller}.ts` | DONE | Commission CRUD, approve/reject, XLSX export, auto-materialise from contract sign. `broker-commissions.service.ts:1` |
| broker-contracts | `modules/broker-contracts/broker-contracts.{service,controller}.ts` | DONE | Admin view of broker-attributed contracts with filtering and XLSX export. `broker-contracts.service.ts:1` |
| broker-leads | `modules/broker-leads/broker-leads.{service,controller}.ts` | DONE | Broker lead submission, approval/rejection workflow, activity logging. `broker-leads.service.ts:1` |
| broker-payouts | `modules/broker-payouts/broker-payouts.{service,controller}.ts` | DONE | Payout lifecycle (DRAFT → APPROVED → PROCESSING → PAID → CANCELLED), BrokerActivityLog writes. `broker-payouts.service.ts:1` |
| broker-portal | `modules/broker-portal/broker-portal.controller.ts` + 8 service files | DONE | Full broker self-service portal: dashboard, leads, reservations, contracts, commissions, payouts, visits, team, performance, activity feed. `broker-portal.controller.ts:61` |
| broker-reports | `modules/broker-reports/broker-reports.{service,controller}.ts` | DONE | Admin-facing aggregated broker reporting with CSV/XLSX. `broker-reports.service.ts:1` |
| broker-reservations | `modules/broker-reservations/broker-reservations.{service,controller}.ts` | DONE | Create reservations attributed to a broker. `broker-reservations.service.ts:1` |
| broker-users | `modules/broker-users/broker-users.{service,controller}.ts` | DONE | Invite/manage users within a broker firm. `broker-users.service.ts:1` |
| brokers | `modules/brokers/brokers.{service,controller}.ts` | DONE | Broker company CRUD, status lifecycle, documents. `brokers.service.ts:1` |
| buildings | `modules/buildings/buildings.module.ts` | DONE | Full CRUD for buildings within phases. In single module file. `buildings.module.ts:58–110` |
| chat | `modules/chat/chat.{service,controller}.ts` + providers | DONE | Public AI chat sessions, rule-based provider (no external LLM). Retention cron. `chat.controller.ts:1` |
| cms | `modules/cms/cms.module.ts` | DONE | Pages, banners, articles — full CRUD with public read endpoints. `cms.module.ts:46–198` |
| company-domains | `modules/company-domains/company-domains.{service,controller}.ts` + `public-domains.controller.ts` | DONE | Domain provisioning, DNS verification flow, public resolve. `company-domains.service.ts:1` |
| contracts | `modules/contracts/contracts.module.ts` | DONE | Contract CRUD, signing, PDF URL management, document registration, auto-commission trigger. 941 lines. `contracts.module.ts:1` |
| crm | `modules/crm/crm-lead-matching.ts` | PARTIAL | Only contains the `matchOrCreateLeadForClient()` utility function — no module class, no controller, no service. Used by reservations and visits modules. `crm-lead-matching.ts:1` |
| deposits | `modules/deposits/deposits.{service,controller}.ts` | DONE | Deposit CRUD, proof upload, review queue (PENDING_REVIEW → APPROVED/REJECTED). `deposits.controller.ts:1` |
| documents | `modules/documents/documents.module.ts` + `me-documents.module.ts` | DONE | Admin document management + customer-facing CUSTOMER_VISIBLE document download. Presigned R2 uploads. `documents.module.ts:1` |
| favorites | `modules/favorites/favorites.module.ts` | DONE | Add/remove/list favorites for projects and units. CLIENT + CUSTOMER roles. `favorites.module.ts:1` |
| health | `modules/health/health.controller.ts` | DONE | `/health/live`, `/health/ready` (DB + Redis), legacy `/health`. `health.controller.ts:1` |
| installments | `modules/installments/installments.module.ts` | DONE | Plan CRUD, templates with duration options, installment mark-paid, XLSX export, overdue cron, reminder cron. 2,381 lines. `installments.module.ts:1` |
| leads | `modules/leads/leads.{service,controller}.ts` | DONE | Lead CRUD, assignment, activity log, import. `leads.service.ts:1` |
| maintenance | `modules/maintenance/maintenance.{service,controller}.ts` | DONE | Request CRUD, assignment, resolution loop, SLA cron, unresolved cron, warranty tracking. `maintenance.service.ts:1` |
| me-home | `modules/me-home/me-home.module.ts` | DONE | Customer home summary: profile, primary property, installments, maintenance, notifications in 11 parallel DB queries. `me-home.module.ts:1` |
| media | `modules/media/media.module.ts` + `r2.service.ts` | DONE | Presigned R2 PUT, project/unit media attach/delete. Public + private bucket routing. `media.module.ts:1` |
| notifications | `modules/notifications/notifications.module.ts` | DONE | Template CRUD, `sendToUser` / `sendToRoles`, broadcast, device-token register, in-app list + mark-read. FCM push via PushService (no-op when unconfigured). `notifications.module.ts:1` |
| permissions | `modules/permissions/permissions.module.ts` | DONE | Assign/remove permission codes per user. Guard (`permissions.guard.ts`) enforces codes on routes decorated with `@Permissions`. `permissions.module.ts:1` |
| phases | `modules/phases/phases.module.ts` | DONE | Phase CRUD within projects. `phases.module.ts:1` |
| projects | `modules/projects/projects.{service,controller}.ts` + `public-project.serializer.ts` | DONE | Project CRUD, public listing, serializer for public API. `projects.controller.ts:1` |
| public-companies | `modules/public-companies/public-companies.{service,controller}.ts` | DONE | Company search and slug-resolve for the shared customer mobile app. `public-companies.controller.ts:1` |
| reports | `modules/reports/reports.{service,controller}.ts` | DONE | Admin financial report, CSV/XLSX export. `reports.service.ts:1` |
| requests | `modules/requests/requests.module.ts` | DONE | Info requests, visit requests (public + authenticated). UTM attribution, guest lead creation. `requests.module.ts:1` |
| reservations | `modules/reservations/reservations.module.ts` | DONE | Full reservation lifecycle, expiry cron, booking-payment confirm/unconfirm, convert-to-contract. 2,381 lines. `reservations.module.ts:1` |
| settings | `modules/settings/settings.module.ts` | DONE | Key-value tenant settings with masking for sensitive keys. GET/PUT/PATCH. `settings.module.ts:1` |
| super-admin | `modules/super-admin/super-admin.{service,controller}.ts` + `subscription-expiry.cron.ts` | DONE | Company CRUD, capabilities, pricing packages, subscription expiry cron. `super-admin.controller.ts:1` |
| units | `modules/units/units.{service,controller}.ts` + `public-unit.serializer.ts` | DONE | Unit CRUD, public listing, serializer. `units.controller.ts:1` |
| users | `modules/users/users.{service,controller}.ts` | DONE | User CRUD, soft-delete, restore, avatar upload. `users.service.ts:1` |
| visits | `modules/visits/visits.{service,controller}.ts` + `appointment-reminder.cron.ts` | DONE | Visit appointment scheduling, customer/sales feedback ratings, day-before + 15-min reminder crons. `visits.service.ts:1` |

**Notes on borderline modules:**
- `crm/` is not a NestJS module — it is a utility file exported into other modules. The directory label is misleading.
- `buildings/`, `phases/`, `cms/`, `settings/`, `favorites/`, `me-home/`, `audit/`, `bonus/` embed the service and controller *inside the module file* rather than separate files.
- `BrokerActivityType` enum has only PAYOUT_* values (`schema.prisma:1887`), meaning broker lead/reservation/commission activity is logged through `LeadActivity`, not this enum. The type is narrower than the enum name suggests.

---

## Section 2 — Data Model

Schema source: `apps/api/prisma/schema.prisma`

### Models

| Model | Key Fields | Relations | Flags |
|---|---|---|---|
| **Company** | id, name, slug (unique), isActive, subscriptionPlan, subscriptionStatus, subscriptionEndAt, type (CompanyType), lifecycleStatus (CompanyLifecycleStatus), capabilities (Json?), websiteEnabled, customerAppEnabled, staffAppEnabled, modules (Json?), createdAt, updatedAt | → CompanyDomain[], User[], Project[], Phase[], Building[], Unit[], Lead*, Reservation*, Contract*, Broker*, Setting[], Document[], ChatSession*, … (30+ relations) | `isActive` and `lifecycleStatus` are dual-control flags — comment at line 27 notes `isActive` will be removed once MT-034 lifecycle guard is fully enforced. `modules` is an untyped Json blob. `capabilities` is an untyped Json blob with no schema enforcement. |
| **PricingPackage** | id, companyId?, planTier (String not enum), nameAr, nameEn, createdAt, updatedAt | → Company? | `planTier` is a plain `String` (TRIAL/STARTER/PROFESSIONAL/ENTERPRISE/CUSTOM) rather than an enum — schema:140. No relation from Company back to PricingPackage in the Company model (unidirectional). |
| **CompanyDomain** | id, companyId, hostname (unique), type (DomainType), isPrimary, verifiedAt?, verificationToken, createdAt, updatedAt | → Company | NEEDS HUMAN INPUT: python script reported `createdAt=False`; manual review confirms `createdAt DateTime @default(now())` is present at schema:239. Script false-positive due to regex. |
| **User** | id, role (UserRole), email?, phone?, passwordHash?, fullName, locale, active, avatarUrl, emailVerifiedAt?, lastLoginAt?, managerId?, companyId?, deletedAt?, createdAt, updatedAt | → RefreshToken[], PasswordResetToken[], EmailVerificationToken[], UserPermission[], DeviceToken[], Notification[], Lead* (3 relations), Reservation* (2), Contract*, BrokerUser?, many more | `passwordHash` is nullable — users who auth via OTP have no hash. `managerId` self-relation for sales team hierarchy. |
| **RefreshToken** | id, userId, tokenHash (unique), deviceId?, userAgent?, ipAddress?, expiresAt, revokedAt?, createdAt | → User | No `updatedAt`. Rotation security relies on `revokedAt`. |
| **PasswordResetToken** | id, userId, tokenHash (unique), expiresAt, consumedAt?, createdAt | → User | No `updatedAt`. |
| **EmailVerificationToken** | id, userId, tokenHash (unique), expiresAt, consumedAt?, createdAt | → User | No `updatedAt`. |
| **OtpCode** | id, phone, codeHash, expiresAt, attempts, consumed, createdAt, companyId? | — (no FK relation on companyId) | ⚠ `companyId` is a plain `String? @db.Uuid` with no `@relation` — schema:392. Comment says "no FK relation, no auto-injection". Cross-tenant OTP lookup risk if `DISABLE_DEFAULT_COMPANY_FALLBACK` is off. |
| **Permission** | id, code (unique), description? | → UserPermission[] | ⚠ No `createdAt`/`updatedAt` — schema:396. |
| **UserPermission** | (userId, permissionId) composite PK | → User, Permission | ⚠ No `createdAt` — schema:403. No timestamp to know when a permission was granted. |
| **DeviceToken** | id, userId, token (unique), platform, createdAt, updatedAt | → User | Good. |
| **Project** | id, name (Json), description (Json), city, lat, lng, status (ProjectStatus), featured, services (Json), companyId?, createdAt, updatedAt | → ProjectMedia[], Phase[], Lead[], VisitRequest[], Favorite[], VisitAppointment[], InstallmentPlanTemplate[], BrokerProjectAccess[], BrokerCommission[], Company? | `services` is an untyped Json array. |
| **ProjectMedia** | id, projectId, url, type (MediaType), order, createdAt | → Project | No `updatedAt`. |
| **Phase** | id, projectId, name (Json), order, createdAt, companyId? | → Building[], Project, Company? | No `updatedAt` on Phase — schema:491. |
| **Building** | id, phaseId, name, totalFloors, order, createdAt, companyId? | → Unit[], Phase, Company? | No `updatedAt`. |
| **Unit** | id, buildingId, code, type (String), area, bedrooms, bathrooms, floor, price (Decimal), status (UnitStatus), reservationExpiresAt?, lat?, lng?, address?, companyId?, createdAt, updatedAt | → UnitMedia[], UnitStatusHistory[], Reservation[], Contract[], VisitRequest[], Favorite[], MaintenanceRequest[], UnitMaintenanceItem[], VisitAppointment[], Lead*, InstallmentPlanTemplate*, BrokerUnitAccess[], BrokerCommission[] | `type` is a plain `String` with no enum — allows arbitrary values ("studio", "1BR", "villa" etc.). No schema-level constraint. |
| **UnitStatusHistory** | id, unitId, oldStatus, newStatus, changedById?, reason?, changedAt, companyId? | → Unit, User?, Company? | ⚠ No `createdAt`/`updatedAt` — uses `changedAt` as sole timestamp. |
| **LeadSource** | id, name (Json), active, createdAt, companyId? | → Lead[], Company? | No `updatedAt`. |
| **Lead** | id, clientId, fullName (denorm), phone (denorm), email?, sourceId?, projectInterestId?, unitInterestId?, assignedSalesId?, stage (LeadStage), utmSource?, utmMedium?, utmCampaign?, utmContent?, fbclid?, brokerId?, brokerAgentId?, brokerApprovalStatus?, createdAt, updatedAt, companyId? | → User (3 FKs), LeadSource?, Project?, Unit?, Broker?, many more | Denormalized name/phone/email comment acknowledges the cache pattern. |
| **LeadNote** | id, leadId, salesId, body, createdAt, companyId? | → Lead, User, Company? | No `updatedAt`. |
| **LeadActivity** | id, leadId, type (LeadActivityType), payload (Json), createdAt, companyId? | → Lead, Company? | ⚠ No `createdAt` reported by script — manual check shows `createdAt DateTime @default(now())` at schema:707. Script false-positive. No `updatedAt`. |
| **InfoRequest** | id, userId?, leadId?, projectId?, unitId?, message, status (InfoRequestStatus), createdAt, companyId? | → User?, Lead?, Project?, Unit?, Company? | No `updatedAt`. `InfoRequestStatus` (OPEN/RESPONDED/CLOSED) exists in schema but is never updated — only `OPEN` is written. See Section 6. |
| **VisitRequest** | id, userId?, leadId?, projectId, unitId?, preferredDate, scheduledAt?, status (VisitStatus), assignedSalesId?, notes?, requestStatus (VisitRequestStatus?), brokerId?, brokerAgentId?, createdAt, updatedAt, companyId? | → User*, Lead?, Project, Unit?, Broker?, VisitAppointment[], VisitActivity[] | Dual status fields (`status` = legacy, `requestStatus` = v2 additive). Many nullable v2 columns added in-place. |
| **VisitAppointment** | id, visitNumber (unique), visitRequestId?, leadId?, clientId?, projectId?, unitId?, assignedSalesId?, scheduledAt, status (AppointmentStatus), salesNotes?, customerFeedback?, customerRating?, salesRating?, dayBeforeReminderSentAt?, hourBeforeReminderSentAt?, brokerId?, brokerAgentId?, createdAt, updatedAt, companyId? | → VisitRequest?, Lead?, User* (many), Project?, Unit?, Broker?, VisitActivity[] | Large model. Reminder sentinel timestamps are the dedup mechanism for crons. |
| **VisitActivity** | id, visitRequestId?, visitId?, leadId?, clientId?, actorId?, actorRole?, type (VisitActivityType), oldValue?, newValue?, note?, createdAt, companyId? | → VisitRequest?, VisitAppointment?, Lead?, User*, Company? | No `updatedAt`. |
| **Favorite** | id, userId, projectId?, unitId?, createdAt | → User, Project?, Unit? | No `updatedAt`. Composite unique on (userId, projectId, unitId) allows both null — a favorite of nothing. |
| **Reservation** | id, reservationNumber?, unitId, salesId, leadId?, clientId?, status (ReservationStatus), notes?, reason?, expiresAt, bookingAmount, bookingPaymentStatus, bookingAmountMode, installmentPlanTemplateId?, selectedDurationOptionId?, brokerId?, brokerAgentId?, deletedAt?, createdAt, updatedAt, companyId? | → Unit, User (3), Lead?, InstallmentPlanTemplate?, InstallmentPlanDurationOption?, Broker?, ReservationNote[], ReservationActivity[], Contract?, Deposit[], BrokerCommission[] | Many financial snapshot columns (snapshotDownPaymentAmount etc). `deletedAt` soft delete present. |
| **Contract** | id, contractNumber?, customerId, unitId, reservationId? (unique), pdfUrl?, signedAt?, totalAmount, downPayment, brokerId?, brokerAgentId?, deletedAt?, createdAt, updatedAt, companyId? | → User (2), Unit, Reservation?, Broker?, InstallmentPlan?, Deposit[], BrokerCommission?, BonusEntry? | `deletedAt` soft delete. `pdfUrl` is a plain URL string — no Document FK. |
| **InstallmentPlan** | id, contractId (unique), totalMonths, monthlyAmount, startsAt, frequency (InstallmentFrequency), createdAt, companyId? | → Contract, Installment[], Company? | No `updatedAt`. |
| **Installment** | id, planId, type (PlanPaymentType), dueDate, amount, status (InstallmentStatus), paidAt?, createdAt, companyId? | → InstallmentPlan, Deposit[], Company? | No `updatedAt`. |
| **Deposit** | id, type (DepositType), contractId?, reservationId?, installmentId?, amount, paidAt, receiptUrl?, recordedById, verified (legacy bool), reviewStatus (DepositReviewStatus), rejectionReason?, reviewedById?, proofDocumentId?, paymentMethod?, deletedAt?, createdAt, companyId? | → Contract?, Reservation?, Installment?, User (2), Document?, Company? | ⚠ `verified` (bool) coexists with `reviewStatus` (enum) — dual state. Comment says "kept for back-compat"; must stay in sync. No `updatedAt`. |
| **InstallmentPlanTemplate** | id, name, description?, projectId, unitId?, totalPrice, discount*, netPrice, reservationAmount*, downPayment*, installmentsCount?, frequency, startDateRule, manualStartDate?, finalPaymentAmount?, visibility (String), status (PlanTemplateStatus), createdById, createdAt, updatedAt, companyId? | → Project, Unit?, User, PlanTemplateScheduleItem[], InstallmentPlanDurationOption[], Reservation[] | `visibility` is a plain `String` defaulting to "SALES_ONLY" — not an enum. |
| **InstallmentPlanDurationOption** | id, planId, durationMonths, increasePercentage, order, createdAt | → InstallmentPlanTemplate, Reservation[] | No `updatedAt`. |
| **PlanTemplateScheduleItem** | id, planId, paymentNumber, paymentType (PlanPaymentType), dueDate?, amount, remainingBalance | → InstallmentPlanTemplate | ⚠ No `createdAt`/`updatedAt` — schema:1422. |
| **BonusRule** | id, name, percentage, conditions (Json), active, autoApplyOnSignedContract, createdAt, companyId? | → BonusEntry[], Company? | No `updatedAt`. |
| **BonusEntry** | id, salesId, ruleId, amount, period, status (BonusEntryStatus), paidAt?, source (BonusEntrySource), contractId? (unique), basisAmount?, commissionPct?, createdAt, companyId? | → User, BonusRule, Contract?, Company? | No `updatedAt`. |
| **SalesTarget** | id, salesId, period, amountTarget, unitsTarget, createdAt, companyId? | → User, Company? | No `updatedAt`. |
| **MaintenanceCategory** | id, code? (unique), name (Json), active, priority, slaDurationMinutes?, warrantyDurationMonths?, createdAt, updatedAt, companyId? | → MaintenanceRequest[], UnitMaintenanceItem[], MaintenanceRequestItem[], Company? | Good. |
| **UnitMaintenanceItem** | id, unitId, categoryId?, name (Json), warrantyStart?, warrantyEnd?, warrantyDurationMonthsSnapshot?, supplierName?, contractorName?, notes?, active, createdAt, updatedAt, companyId? | → Unit, MaintenanceCategory?, MaintenanceRequest[], MaintenanceRequestItem[], Company? | Good. |
| **MaintenanceRequest** | id, customerId, unitId, categoryId, description, status (MaintenanceStatus), priority?, dueAt?, assignedAdminId?, itemId?, warrantyStatus?, reviewStatus (MaintenanceReviewStatus), resolvedBy?, customerRating?, complaintAt?, unresolvedAt?, createdAt, updatedAt, companyId? | → User (2), Unit, MaintenanceCategory, UnitMaintenanceItem?, MaintenanceRequestItem[], Company? | Large model with resolution-loop fields. |
| **MaintenanceRequestItem** | id, requestId, itemId?, categoryId, categoryPrioritySnapshot, handlingSlaMinutesSnapshot?, warrantyStatusSnapshot, warrantyEndSnapshot?, createdAt, companyId? | → MaintenanceRequest, UnitMaintenanceItem?, MaintenanceCategory, Company? | No `updatedAt`. |
| **CmsPage** | id, slug (unique), title (Json), body (Json), published, createdAt, updatedAt, companyId? | → Company? | Good. |
| **Banner** | id, imageUrl, title (Json), link?, active, order, createdAt, companyId? | → Company? | No `updatedAt`. |
| **Article** | id, slug (unique), title (Json), excerpt (Json), body (Json), coverUrl?, published, createdAt, updatedAt, companyId? | → Company? | Good. |
| **NotificationTemplate** | id, code (unique), channel (NotificationChannel), subject (Json), body (Json), active, createdAt, updatedAt, companyId? | → Company? | ⚠ `code` unique constraint is unscoped — one template code per entire DB, not per company. `notifications.module.ts:146` notes this. |
| **Notification** | id, userId, templateCode, payload (Json), channel, sentAt?, readAt?, createdAt, companyId? | → User, Company? | No `updatedAt`. |
| **AuditLog** | id, actorId?, action, entityType, entityId?, before?, after?, ip?, createdAt, companyId? | → User?, Company? | No `updatedAt` (append-only, correct). |
| **Broker** | id, companyName, commercialName?, code (unique), email?, phone?, taxId? (unique), bankIban?, defaultCommissionPct, commissionModel (BrokerCommissionModel), status (BrokerStatus), createdAt, updatedAt, companyId? | → BrokerUser[], BrokerProjectAccess[], BrokerUnitAccess[], Lead[], Reservation[], Contract[], VisitRequest[], VisitAppointment[], BrokerCommission[], BrokerPayout[], BrokerActivityLog[], Company? | Good. |
| **BrokerUser** | id, userId (unique), brokerId, jobTitle?, isPrimaryContact, canManageBrokerUsers, canViewCommissions, invitedAt?, joinedAt?, status (BrokerUserStatus), createdAt, updatedAt, companyId? | → User, Broker, Company? | Good. |
| **BrokerProjectAccess** | id, brokerId, projectId, commissionPct?, fixedAmountPerUnit?, startsAt?, endsAt?, active, createdAt, companyId? | → Broker, Project, Company? | No `updatedAt`. |
| **BrokerUnitAccess** | id, brokerId, unitId, active, createdAt, companyId? | → Broker, Unit, Company? | No `updatedAt`. |
| **BrokerCommission** | id, commissionNumber (unique), brokerId, brokerAgentId?, contractId (unique), reservationId?, unitId, projectId, basisAmount, commissionPct?, grossAmount, taxPct, taxAmount, withholdingPct, withholdingAmount, netAmount, status (BrokerCommissionStatus), earnedAt, approvedById?, rejectedById?, payoutId?, createdAt, updatedAt, companyId? | → Broker, User* (3), Contract, Reservation?, Unit, Project, BrokerPayout?, Company? | Good. |
| **BrokerPayout** | id, payoutNumber (unique), brokerId, period?, totalGross, totalTax, totalWithholding, totalNet, status (BrokerPayoutStatus), paymentMethod?, paymentReference?, receiptUrl?, invoiceUrl?, scheduledAt?, approvedById?, processedById?, paidAt?, cancelledById?, createdAt, updatedAt, companyId? | → Broker, User* (3), BrokerCommission[], Company? | Good. |
| **BrokerActivityLog** | id, brokerId, brokerAgentId?, type (BrokerActivityType), entityType (String), entityId?, payload (Json), createdAt, companyId? | → Broker, User?, Company? | ⚠ `BrokerActivityType` enum only contains PAYOUT_* variants — schema:1887. Non-payout broker activity (leads, reservations) goes through `LeadActivity`, not here. Enum is misleadingly narrow. |
| **Setting** | id, key, value (Json), updatedAt, companyId | → Company | ⚠ **Missing `createdAt`** — schema:2131. Only `updatedAt` present. All sibling models have `createdAt`. |
| **Document** | id, ownerType (DocumentOwnerType), ownerId (String — no @relation), category, title, description?, fileUrl, fileName?, mimeType?, sizeBytes?, visibility (DocumentVisibility), uploadedById?, deletedAt?, createdAt, updatedAt, companyId? | → User?, Company?, Deposit[] (reverse) | ⚠ `ownerId` is a plain `String @db.Uuid` with no Prisma `@relation` — schema:2193. Intentional polymorphism; DB cannot enforce referential integrity. |
| **ChatSession** | id, source, locale, anonymousId, userId? (no @relation), status, leadId? (no @relation), metadata?, lastMessageAt, createdAt, updatedAt, companyId? | → ChatMessage[], ChatFeedback[], Company? | `userId` and `leadId` have `// Reserved for future authenticated assistant; no relation in v1` — schema:2255. These are plain columns with no FK enforcement. |
| **ChatMessage** | id, sessionId, role (ChatRole), content, toolCalls?, toolResult?, tokensIn?, tokensOut?, createdAt, companyId? | → ChatSession, Company? | No `updatedAt`. |
| **ChatFeedback** | id, sessionId, messageId?, rating (ChatFeedbackRating), comment?, createdAt, companyId? | → ChatSession, Company? | `messageId` is a plain `String? @db.Uuid` — schema:2298. No `@relation` to ChatMessage. |

### Flagged Issues

**Models missing both `createdAt` and `updatedAt`:**
- `Permission` — schema:396
- `UserPermission` — schema:403
- `PlanTemplateScheduleItem` — schema:1422
- `BrokerActivityLog` (has `createdAt`, missing `updatedAt`) — schema:2105

**Models missing only `updatedAt` (append-only records — arguably acceptable):**
`ProjectMedia`, `Phase`, `Building`, `UnitStatusHistory`, `LeadSource`, `LeadNote`, `InfoRequest`, `VisitActivity`, `Favorite`, `InstallmentPlan`, `Installment`, `Deposit`, `InstallmentPlanDurationOption`, `BonusRule`, `BonusEntry`, `SalesTarget`, `Banner`, `Notification`, `AuditLog`, `BrokerProjectAccess`, `BrokerUnitAccess`, `ChatMessage`, `ChatFeedback`

**Model with only `updatedAt` (missing `createdAt`):**
- `Setting` — schema:2131

**Plain String FKs without `@relation`:**
- `OtpCode.companyId` — schema:391
- `Document.ownerId` (intentional polymorphism, documented) — schema:2193
- `ChatSession.userId`, `ChatSession.leadId` (reserved, v1 stub) — schema:2254–2257
- `ChatFeedback.messageId` — schema:2298

**Enums defined but narrow/misleading:**
- `BrokerActivityType` — only PAYOUT_* variants; non-payout activities use `LeadActivityType` instead — schema:1887
- `InfoRequestStatus` (OPEN/RESPONDED/CLOSED) — status is set to OPEN on creation but the `RESPONDED`/`CLOSED` transitions have no write path in the codebase — `reports.service.ts:338` only reads `OPEN`

**Potential duplicate concepts:**
- `Deposit.verified` (Boolean) duplicates `Deposit.reviewStatus` (DepositReviewStatus). Both exist; comment says they are kept in sync — schema:1286. Dual state is a maintenance risk.
- `Company.isActive` (Boolean) duplicates `Company.lifecycleStatus` (ACTIVE/SUSPENDED/ARCHIVED). Comment at schema:27 acknowledges the plan to remove `isActive`.

---

## Section 3 — API Surface

All routes are versioned under `/v1/` (or match the pattern below). Global guards applied in order: `ThrottlerGuard` → `JwtAuthGuard` → `CompanyLifecycleGuard` → `RolesGuard` → `PermissionsGuard` (`app.module.ts:127–132`).

### Auth

| Method | Path | Guard/Auth | Roles | Controller file:line |
|---|---|---|---|---|
| POST | `/auth/login` | @Public | — | `auth.controller.ts` (deprecated, redirects to login-staff with header) |
| POST | `/auth/login-staff` | @Public | — | `auth.controller.ts:44` |
| POST | `/auth/login-customer` | @Public | — | `auth.controller.ts:132` |
| POST | `/auth/otp/request` | @Public | — | `auth.controller.ts:139` |
| POST | `/auth/otp/verify` | @Public | — | `auth.controller.ts:146` |
| POST | `/auth/refresh` | @Public | — | `auth.controller.ts:153` |
| POST | `/auth/logout` | JWT | any | `auth.controller.ts:160` |
| POST | `/auth/password-reset/request` | @Public | — | `auth.controller.ts:171` |
| POST | `/auth/password-reset/confirm` | @Public | — | `auth.controller.ts:178` |
| POST | `/auth/email-verify/request` | @Public | — | `auth.controller.ts:185` |
| POST | `/auth/email-verify/confirm` | @Public | — | `auth.controller.ts:191` |
| PATCH | `/auth/password` | JWT | any (self) | `auth.controller.ts:160` |
| POST | `/auth/me/password` | JWT | any (self) | `auth.controller.ts:198` |

### Health

| Method | Path | Guard/Auth | Roles | Controller file:line |
|---|---|---|---|---|
| GET | `/health/live` | @Public | — | `health.controller.ts:23` |
| GET | `/health/ready` | @Public | — | `health.controller.ts:36` |
| GET | `/health` | @Public | — | `health.controller.ts:54` |
| GET | `/` | @Public | — | `health.controller.ts:61` |

### Projects / Units / Media

| Method | Path | Guard/Auth | Roles | Controller file:line |
|---|---|---|---|---|
| GET | `/projects` | @Public | — | `projects.controller.ts:26` |
| GET | `/projects/:id` | @Public | — | `projects.controller.ts:32` |
| GET | `/projects/:id/units` | @Public | — | `projects.controller.ts:38` |
| POST | `/projects` | JWT+Roles+Permissions | ADMIN (projects:create) | `projects.controller.ts` |
| PATCH | `/projects/:id` | JWT+Roles+Permissions | ADMIN (projects:update) | `projects.controller.ts` |
| DELETE | `/projects/:id` | JWT+Roles+Permissions | ADMIN (projects:delete) | `projects.controller.ts` |
| GET | `/units` | @Public | — | `units.controller.ts:34` |
| GET | `/units/:id` | @Public | — | `units.controller.ts:40` |
| POST | `/units` | JWT+Roles+Permissions | ADMIN | `units.controller.ts` |
| PATCH | `/units/:id` | JWT+Roles+Permissions | ADMIN | `units.controller.ts` |
| DELETE | `/units/:id` | JWT+Roles+Permissions | ADMIN | `units.controller.ts` |
| POST | `/media/presign` | JWT+Roles+Permissions | ADMIN (project_media:manage) | `media.module.ts` |
| POST | `/media/projects` | JWT+Roles+Permissions | ADMIN | `media.module.ts` |
| POST | `/media/units` | JWT+Roles+Permissions | ADMIN | `media.module.ts` |
| DELETE | `/media/projects/:id` | JWT+Roles+Permissions | ADMIN | `media.module.ts` |
| DELETE | `/media/units/:id` | JWT+Roles+Permissions | ADMIN | `media.module.ts` |

### Phases / Buildings

| Method | Path | Guard/Auth | Roles | Controller file:line |
|---|---|---|---|---|
| GET | `/phases` | JWT+Roles+Permissions | ADMIN, SALES, SALES_MANAGER (projects:read) | `phases.module.ts` |
| GET | `/phases/:id` | JWT+Roles+Permissions | ADMIN, SALES, SALES_MANAGER | `phases.module.ts` |
| POST | `/phases` | JWT+Roles+Permissions | ADMIN (phases:manage) | `phases.module.ts` |
| PATCH | `/phases/:id` | JWT+Roles+Permissions | ADMIN | `phases.module.ts` |
| DELETE | `/phases/:id` | JWT+Roles+Permissions | ADMIN | `phases.module.ts` |
| GET | `/buildings` | JWT+Roles+Permissions | ADMIN, SALES, SALES_MANAGER | `buildings.module.ts` |
| GET | `/buildings/:id` | JWT+Roles+Permissions | ADMIN, SALES, SALES_MANAGER | `buildings.module.ts` |
| POST | `/buildings` | JWT+Roles+Permissions | ADMIN (buildings:manage) | `buildings.module.ts` |
| PATCH | `/buildings/:id` | JWT+Roles+Permissions | ADMIN | `buildings.module.ts` |
| DELETE | `/buildings/:id` | JWT+Roles+Permissions | ADMIN | `buildings.module.ts` |

### CMS

| Method | Path | Guard/Auth | Roles | Controller file:line |
|---|---|---|---|---|
| GET | `/public/banners` | @Public | — | `cms.module.ts:157` |
| GET | `/public/pages/:slug` | @Public | — | `cms.module.ts:163` |
| GET | `/public/articles` | @Public | — | `cms.module.ts:169` |
| GET | `/public/articles/:slug` | @Public | — | `cms.module.ts:175` |
| GET | `/cms/pages` | JWT+Roles+Permissions | ADMIN (cms:pages:manage) | `cms.module.ts` |
| POST | `/cms/pages` | JWT+Roles+Permissions | ADMIN | `cms.module.ts` |
| GET | `/cms/banners` | JWT+Roles+Permissions | ADMIN (cms:banners:manage) | `cms.module.ts` |
| POST | `/cms/banners` | JWT+Roles+Permissions | ADMIN | `cms.module.ts` |
| DELETE | `/cms/banners/:id` | JWT+Roles+Permissions | ADMIN | `cms.module.ts` |
| GET | `/cms/articles` | JWT+Roles+Permissions | ADMIN (cms:articles:manage) | `cms.module.ts` |
| GET | `/cms/articles/:slug` | JWT+Roles+Permissions | ADMIN | `cms.module.ts` |
| POST | `/cms/articles` | JWT+Roles+Permissions | ADMIN | `cms.module.ts` |

### Requests (Info + Visit)

| Method | Path | Guard/Auth | Roles | Controller file:line |
|---|---|---|---|---|
| POST | `/public/info-request` | @Public + @OptionalAuth | — | `requests.module.ts:510` |
| POST | `/public/visit-request` | @Public + @OptionalAuth | — | `requests.module.ts:521` |
| POST | `/me/info-requests` | JWT+Roles | CLIENT, CUSTOMER | `requests.module.ts:534` |
| POST | `/me/visit-requests` | JWT+Roles | CLIENT, CUSTOMER | `requests.module.ts:540` |
| GET | `/me/visit-requests` | JWT+Roles | CLIENT, CUSTOMER | `requests.module.ts:546` |
| GET | `/me/info-requests` | JWT+Roles | CLIENT, CUSTOMER | `requests.module.ts:560` |
| GET | `/info-requests` | JWT+Roles | ADMIN, SALES, SALES_MANAGER | `requests.module.ts:575` (⚠ no @Permissions) |
| GET | `/visit-requests` | JWT+Roles+Permissions | ADMIN, SALES, SALES_MANAGER (visits:read) | `requests.module.ts:582` |
| PATCH | `/visit-requests/:id` | JWT+Roles+Permissions | ADMIN, SALES, SALES_MANAGER (visits:approve) | `requests.module.ts:606` |

⚠ **Flagged:** `GET /info-requests` has `@Roles` but no `@Permissions` decorator — `requests.module.ts:575`. All other admin read routes in this module use `@Permissions`.

### Favorites / Me

| Method | Path | Guard/Auth | Roles | Controller file:line |
|---|---|---|---|---|
| GET | `/me/favorites` | JWT+Roles | CLIENT, CUSTOMER | `favorites.module.ts` |
| GET | `/me/favorites/ids` | JWT+Roles | CLIENT, CUSTOMER | `favorites.module.ts` |
| POST | `/me/favorites` | JWT+Roles | CLIENT, CUSTOMER | `favorites.module.ts` |
| DELETE | `/me/favorites/:id` | JWT+Roles | CLIENT, CUSTOMER | `favorites.module.ts` |
| GET | `/me/home-summary` | JWT+Roles | CUSTOMER | `me-home.module.ts` |
| GET | `/me/documents/all` | JWT+Roles | CLIENT, CUSTOMER | `me-documents.module.ts` |
| GET | `/me/documents/:ownerType/:ownerId` | JWT+Roles | CLIENT, CUSTOMER | `me-documents.module.ts` |
| GET | `/me/documents/:id/download` | JWT+Roles | CLIENT, CUSTOMER | `me-documents.module.ts` |

### Leads

| Method | Path | Guard/Auth | Roles | Controller file:line |
|---|---|---|---|---|
| GET | `/leads` | JWT+Roles+Permissions | ADMIN, SALES, SALES_MANAGER (leads:read) | `leads.controller.ts` |
| GET | `/leads/:id` | JWT+Roles+Permissions | ADMIN, SALES, SALES_MANAGER | `leads.controller.ts` |
| POST | `/leads` | JWT+Roles+Permissions | ADMIN, SALES, SALES_MANAGER (leads:create) | `leads.controller.ts` |
| PATCH | `/leads/:id` | JWT+Roles+Permissions | ADMIN, SALES, SALES_MANAGER (leads:update) | `leads.controller.ts` |
| DELETE | `/leads/:id` | JWT+Roles+Permissions | ADMIN (leads:delete) | `leads.controller.ts` |
| POST | `/leads/import` | JWT+Roles+Permissions | ADMIN (leads:import) | `leads.controller.ts` |

### Reservations / Contracts / Installments / Deposits

All routes in these modules are JWT-protected with role + permissions guards. Highlights:

| Method | Path | Guard/Auth | Roles | Notes |
|---|---|---|---|---|
| POST | `/reservations` | JWT+Roles+PermissionsStrict | ADMIN, SALES, SALES_MANAGER | `reservations.module.ts` |
| POST | `/reservations/:id/approve` | JWT+PermissionsStrict | ADMIN (reservations:approve) | `reservations.module.ts` |
| POST | `/reservations/:id/convert` | JWT+PermissionsStrict | ADMIN (reservations:convert) | `reservations.module.ts` |
| POST | `/reservations/:id/booking-payment/confirm` | JWT+PermissionsStrict | ADMIN (reservations:booking-payment) | `reservations.module.ts` |
| GET | `/contracts/me/contracts` | JWT+Roles | CUSTOMER | `contracts.module.ts` |
| POST | `/contracts/:id/sign` | JWT+PermissionsStrict | ADMIN (contracts:sign) | `contracts.module.ts` |
| POST | `/deposits/:id/approve` | JWT+PermissionsStrict | ADMIN (deposits:approve) | `deposits.controller.ts` |
| GET | `/deposits/review-queue` | JWT+Roles+Permissions | ADMIN, SALES_MANAGER (deposits:review-queue) | `deposits.controller.ts` |

### Visits (Appointments)

| Method | Path | Guard/Auth | Roles | Controller file:line |
|---|---|---|---|---|
| GET | `/visits` | JWT+Roles+Permissions | ADMIN, SALES, SALES_MANAGER (visits:read) | `visits.controller.ts` |
| POST | `/visits` | JWT+Roles+Permissions | ADMIN, SALES, SALES_MANAGER (visits:create) | `visits.controller.ts` |
| PATCH | `/visits/:id` | JWT+Roles+Permissions | ADMIN, SALES, SALES_MANAGER (visits:update) | `visits.controller.ts` |

### Notifications / Audit / Settings / Reports

All ADMIN-only or ADMIN+SALES_MANAGER. No unguarded routes in these modules.

### Chat

| Method | Path | Guard/Auth | Roles | Controller file:line |
|---|---|---|---|---|
| POST | `/chat/sessions` | @Public | — | `chat.controller.ts:24` |
| POST | `/chat/sessions/:id/messages` | @Public | — | `chat.controller.ts:31` |
| GET | `/chat/sessions/:id` | @Public | — | `chat.controller.ts:38` |
| POST | `/chat/sessions/:id/feedback` | @Public | — | `chat.controller.ts:45` |
| PATCH | `/chat/sessions/:id/close` | @Public | — | `chat.controller.ts:53` |

⚠ **Flagged:** All chat routes are fully public. Identity is an `anonymousId` provided by the client with no server-side binding. Anyone knowing a session UUID can read/modify it.

### Broker Portal (Self-service for BROKER role)

All routes guarded by `@Roles(UserRole.BROKER)`. `broker-portal.controller.ts:61`.

### Super Admin

All routes guarded by `@UseGuards(JwtAuthGuard, SuperAdminGuard)` with `@BypassTenant()`. SUPER_ADMIN role only. `super-admin.controller.ts:1`.

### Public Companies (MT-056/057)

| Method | Path | Guard/Auth | Roles | Controller file:line |
|---|---|---|---|---|
| GET | `/public/companies/search` | @PlatformPublic | — | `public-companies.controller.ts:43` |
| GET | `/public/companies/resolve` | @PlatformPublic | — | `public-companies.controller.ts:68` |

### Company Domains

| Method | Path | Guard/Auth | Roles | Controller file:line |
|---|---|---|---|---|
| GET | `/public/domains/resolve` | @PlatformPublic | — | `public-domains.controller.ts` |
| GET | `/company-domains` | JWT+Roles | ADMIN | `company-domains.controller.ts` |
| POST | `/company-domains` | JWT+Roles | ADMIN | `company-domains.controller.ts` |
| DELETE | `/company-domains/:id` | JWT+Roles | ADMIN | `company-domains.controller.ts` |

### ⚠ Flagged Routes

| Issue | Route | File:line |
|---|---|---|
| `@Roles` present but no `@Permissions` | GET `/info-requests` | `requests.module.ts:575` |
| Chat session readable/writable by any caller who knows the UUID | All `/chat/sessions/*` | `chat.controller.ts:24–53` |
| `GET /audit-logs`, `GET /audit-logs/:id`, `GET /operations/summary` — ADMIN-only but no `@BypassTenant()` flag; relies on tenant context being correct | — | `audit.module.ts:191–207` |

---

## Section 4 — Frontend Surface

### A) Web Admin (`apps/web-admin/src/app/`)

| Route | File | Role/Guard | Status |
|---|---|---|---|
| `/login` | Login page | Unauthenticated | DONE |
| `/super-admin/login` | Super-admin login | Unauthenticated | DONE |
| `/dashboard` | Dashboard home | ADMIN / SALES / SALES_MANAGER | DONE |
| `/dashboard/projects` | Projects list | ADMIN | DONE |
| `/dashboard/projects/new` | Create project | ADMIN | DONE |
| `/dashboard/projects/[id]` | Project detail | ADMIN | DONE |
| `/dashboard/projects/[id]/edit` | Edit project | ADMIN | DONE |
| `/dashboard/leads` | Leads list | ADMIN, SALES, SALES_MANAGER | DONE |
| `/dashboard/leads/new` | Create lead | Staff | DONE |
| `/dashboard/leads/[id]` | Lead detail | Staff | DONE |
| `/dashboard/leads/import` | Import leads | ADMIN | DONE |
| `/dashboard/clients` | Clients list | ADMIN | DONE |
| `/dashboard/clients/new` | Create client | ADMIN | DONE |
| `/dashboard/clients/[id]` | Client detail | ADMIN | DONE |
| `/dashboard/clients/[id]/edit` | Edit client | ADMIN | DONE |
| `/dashboard/clients/[id]/activity` | Client activity | ADMIN | DONE |
| `/dashboard/customers` | Customers list | ADMIN | DONE |
| `/dashboard/customers/[id]` | Customer detail | ADMIN | DONE |
| `/dashboard/reservations` | Reservations list | Staff | DONE |
| `/dashboard/reservations/new` | Create reservation | Staff | DONE |
| `/dashboard/reservations/[id]` | Reservation detail | Staff | DONE |
| `/dashboard/contracts` | Contracts list | ADMIN | DONE |
| `/dashboard/contracts/new` | Create contract | ADMIN | DONE |
| `/dashboard/contracts/[id]` | Contract detail | ADMIN | DONE |
| `/dashboard/installments` | Plans list | ADMIN | DONE |
| `/dashboard/installments/new` | Create plan template | ADMIN | DONE |
| `/dashboard/installments/[id]` | Plan detail | ADMIN | DONE |
| `/dashboard/installments/[id]/edit` | Edit plan | ADMIN | DONE |
| `/dashboard/deposits` | Deposits list | ADMIN | DONE |
| `/dashboard/deposits/new` | Record deposit | ADMIN | DONE |
| `/dashboard/deposits/[id]` | Deposit detail | ADMIN | DONE |
| `/dashboard/payments/review` | Payment proof review | ADMIN, SALES_MANAGER | DONE |
| `/dashboard/inventory` | Unit inventory | ADMIN | DONE |
| `/dashboard/maintenance` | Maintenance list | ADMIN, MAINTENANCE_SUPERVISOR | DONE |
| `/dashboard/maintenance/new` | Create request | ADMIN | DONE |
| `/dashboard/maintenance/[id]` | Request detail | ADMIN | DONE |
| `/dashboard/requests` | Info/Visit requests | ADMIN, SALES | DONE |
| `/dashboard/visits` (no page.tsx — check) | — | — | NEEDS HUMAN INPUT |
| `/dashboard/brokers` | Brokers list | ADMIN | DONE |
| `/dashboard/brokers/new` | Create broker | ADMIN | DONE |
| `/dashboard/brokers/[id]` | Broker detail | ADMIN | DONE |
| `/dashboard/brokers/[id]/edit` | Edit broker | ADMIN | DONE |
| `/dashboard/brokers/[id]/users` | Broker users | ADMIN | DONE |
| `/dashboard/brokers/[id]/access` | Broker access | ADMIN | DONE |
| `/dashboard/brokers/[id]/performance` | Broker performance | ADMIN | DONE |
| `/dashboard/broker-leads` | Broker leads | ADMIN | DONE |
| `/dashboard/broker-leads/[id]` | Broker lead detail | ADMIN | DONE |
| `/dashboard/broker-reservations` | Broker reservations | ADMIN | DONE |
| `/dashboard/broker-reservations/new` | Create broker reservation | ADMIN | DONE |
| `/dashboard/broker-commissions` | Commissions list | ADMIN | DONE |
| `/dashboard/broker-commissions/[id]` | Commission detail | ADMIN | DONE |
| `/dashboard/broker-payouts` | Payouts list | ADMIN | DONE |
| `/dashboard/broker-payouts/new` | Create payout | ADMIN | DONE |
| `/dashboard/broker-payouts/[id]` | Payout detail | ADMIN | DONE |
| `/dashboard/broker-contracts` | Broker contracts | ADMIN | DONE |
| `/dashboard/broker-reports` | Broker reports | ADMIN | DONE |
| `/dashboard/bonus` | Bonus management | ADMIN | DONE |
| `/dashboard/targets` | Sales targets | ADMIN, SALES_MANAGER | DONE |
| `/dashboard/sales/performance` | Sales performance | ADMIN, SALES_MANAGER | DONE |
| `/dashboard/my-compensation` | Self-view compensation (SALES) | SALES | DONE |
| `/dashboard/reports` | Reports hub | ADMIN | DONE |
| `/dashboard/reports/financial` | Financial report | ADMIN | DONE |
| `/dashboard/cms` | CMS management | ADMIN | DONE |
| `/dashboard/cms/articles/new` | Create article | ADMIN | DONE |
| `/dashboard/cms/articles/[slug]/edit` | Edit article | ADMIN | DONE |
| `/dashboard/documents` | Documents list | ADMIN | DONE |
| `/dashboard/documents/new` | Upload document | ADMIN | DONE |
| `/dashboard/documents/[id]` | Document detail | ADMIN | DONE |
| `/dashboard/notifications` | Notifications | ADMIN | DONE |
| `/dashboard/notifications/templates` | Notification templates | ADMIN | DONE |
| `/dashboard/notifications/broadcast` | Broadcast | ADMIN | DONE |
| `/dashboard/permissions` | Permission management | ADMIN | DONE |
| `/dashboard/settings` | Settings | ADMIN | DONE |
| `/dashboard/operations` | Operations summary | ADMIN | DONE |
| `/dashboard/audit-logs` | Audit logs list | ADMIN | DONE |
| `/dashboard/audit-logs/[id]` | Audit log detail | ADMIN | DONE |
| `/dashboard/audit` | Legacy redirect | — | Redirect to `/dashboard/audit-logs` |
| `/dashboard/super-admin` | Super-admin home | SUPER_ADMIN | DONE |
| `/dashboard/super-admin/companies` | Companies list | SUPER_ADMIN | DONE |
| `/dashboard/super-admin/companies/new` | Create company | SUPER_ADMIN | DONE |
| `/dashboard/super-admin/companies/[id]` | Company detail | SUPER_ADMIN | DONE |
| `/dashboard/super-admin/pricing` | Pricing packages | SUPER_ADMIN | DONE |
| `/dashboard/super-admin/pricing/pdf` | Pricing PDF | SUPER_ADMIN | DONE |

No placeholder ("coming soon") pages detected in web-admin.

### B) Web Public (`apps/web-public/src/app/`)

| Route | File | Role/Guard | Status |
|---|---|---|---|
| `/` | Homepage | Public | DONE |
| `/projects` | Projects listing | Public | DONE |
| `/projects/[id]` | Project detail | Public | DONE |
| `/units` | Units listing | Public | DONE |
| `/units/[id]` | Unit detail | Public | DONE |
| `/articles` | Articles listing | Public | DONE |
| `/articles/[slug]` | Article detail | Public | DONE |
| `/contact` | Contact / info request | Public | DONE |
| `/compare` | Unit comparison | Public | DONE |
| `/login` | Login | Unauthenticated | DONE |
| `/register` | Register | Unauthenticated | DONE |
| `/forgot-password` | Password reset | Unauthenticated | DONE |
| `/reset-password` | Reset confirm | Unauthenticated | DONE |
| `/verify-email` | Email verify | Unauthenticated | DONE |
| `/privacy` | Privacy policy | Public | DONE |
| `/terms` | Terms & conditions | Public | DONE |
| `/app` | App download page | Public | DONE |
| `/account` | Account hub | CLIENT, CUSTOMER (session) | DONE |
| `/account/profile` | Profile | Authenticated | DONE |
| `/account/favorites` | Favorites | Authenticated | DONE |
| `/account/requests` | Visit/info requests | Authenticated | DONE |
| `/account/visits` | Visit appointments | Authenticated | DONE |
| `/account/reservations` | Reservations | Authenticated | DONE |
| `/account/notifications` | Notifications | Authenticated | DONE |
| `/account/documents` | Documents | Authenticated | DONE |
| `/account/(customer)/contracts` | Contracts | CUSTOMER | DONE |
| `/account/(customer)/deposits` | Deposits | CUSTOMER | DONE |
| `/account/(customer)/installments` | Installments | CUSTOMER | DONE |
| `/account/(customer)/property` | My property | CUSTOMER | DONE |
| `/account/(customer)/maintenance` | Maintenance list | CUSTOMER | DONE |
| `/account/(customer)/maintenance/new` | Create maintenance | CUSTOMER | DONE |
| `/account/(customer)/maintenance/[id]` | Maintenance detail | CUSTOMER | DONE |

No placeholder pages detected in web-public.

### C) Mobile — Customer App (`apps/mobile/mobile_customer/`)

Routes defined in `apps/mobile/mobile_customer/lib/router/app_router.dart`.

| Route | Screen | Status |
|---|---|---|
| `/splash` | SplashScreen | DONE |
| `/startup-retry` | StartupRetryScreen | DONE |
| `/login` | LoginScreen | DONE |
| `/register` | RegisterScreen | DONE |
| `/login/otp` | OtpScreen | DONE |
| `/forgot-password` | ForgotPasswordScreen | DONE |
| `/home` | HomeScreen (catalog shell) | DONE |
| `/projects` | ProjectsScreen | DONE |
| `/units` | UnitsScreen | DONE |
| `/compare` | CompareScreen | DONE |
| `/more` | MoreScreen | DONE |
| `/account/property` | MyPropertyScreen | DONE |
| `/account/finance` | FinanceHubScreen | DONE |
| `/account/maintenance` | MaintenanceRequestsScreen | DONE |
| `/account` | AccountScreen | DONE |
| `/account/profile` | ProfileScreen | DONE |
| `/account/favorites` | FavoritesScreen | DONE |
| `/account/requests` | MyRequestsScreen | DONE |
| `/account/notifications` | NotificationsScreen | DONE |
| `/account/contracts` | ContractsScreen | DONE |
| `/account/contracts/:id` | ContractDetailScreen | DONE |
| `/account/deposits` | DepositsScreen | DONE |
| `/account/deposits/:id` | DepositDetailScreen | DONE |
| `/account/installments` | InstallmentsScreen | DONE |
| `/account/installments/:id/submit-proof` | SubmitProofScreen | DONE |
| `/account/installments/:id/proof` | ProofViewScreen | DONE |
| `/account/property/detail` | PropertyDetailScreen | DONE |
| `/account/maintenance/new` | CreateMaintenanceScreen | DONE |
| `/account/maintenance/:id` | MaintenanceRequestDetailScreen | DONE |
| `/visit-request` | VisitRequestScreen | DONE |
| `/info-request` | InfoRequestScreen | DONE |
| `/projects/:id` | ProjectDetailsScreen | DONE |
| `/projects/:id/units` | (units sub-route) | DONE |
| `/units/:id` | UnitDetailsScreen | DONE |
| `/chat` | ChatScreen | DONE |
| `/gallery` | Gallery | DONE |
| `/select-company` | CompanySelectorScreen | DONE |

### D) Mobile — Staff App (`apps/mobile/mobile_staff/`)

Routes defined in `apps/mobile/mobile_staff/lib/router/app_router.dart`.

| Route | Screen | Status |
|---|---|---|
| `/splash` | SplashScreen | DONE |
| `/login` | StaffLoginScreen | DONE |
| `/forgot-password` | ForgotStaffPasswordScreen | DONE |
| `/home` | StaffShell (dashboard) | DONE |
| `/maintenance` | MaintenanceListScreen | DONE |
| `/maintenance/:id` | MaintenanceDetailScreen | DONE |
| `/leads` | LeadsScreen | DONE |
| `/leads/new` | CreateLeadScreen | DONE |
| `/leads/:id` | LeadDetailScreen | DONE |
| `/clients` | ClientsScreen | DONE |
| `/clients/:id` | ClientDetailScreen | DONE |
| `/projects` | StaffProjectsScreen | DONE |
| `/projects/:id` | StaffProjectDetailScreen | DONE |
| `/units/:id` | StaffUnitDetailScreen | DONE |
| `/visits` | VisitsScreen | DONE |
| `/visits/new` | CreateVisitScreen | DONE |
| `/visits/:id` | VisitDetailScreen | DONE |
| `/reservations` | ReservationsScreen | DONE |
| `/reservations/new` | CreateReservationScreen | DONE |
| `/reservations/:id` | ReservationDetailScreen | DONE |
| `/contracts` | ContractsScreen | DONE |
| `/contracts/:id` | ContractDetailScreen | DONE |
| `/deposits` | DepositsScreen | DONE |
| `/deposits/record` | RecordDepositScreen | DONE |
| `/documents-view` | DocumentsScreen | DONE |
| `/payments-review` | PaymentsReviewScreen | DONE |
| `/bonus` | BonusScreen | DONE |
| `/targets` | TargetsScreen | DONE |
| `/team-performance` | TeamPerformanceScreen | DONE |
| `/team-targets` | TeamTargetsScreen | DONE |
| `/installment-plans` | InstallmentPlansScreen | DONE |
| `/calculator` | CalculatorScreen | DONE |
| `/gallery` | ComponentGalleryScreen | DONE |
| `/notifications` | NotificationsScreen | DONE |
| `/broker/home` | BrokerDashboardScreen | DONE |
| `/broker/projects/:id` | BrokerProjectDetailScreen | DONE |
| `/broker/units/:id` | BrokerUnitDetailScreen | DONE |
| `/broker/leads/new` | CreateBrokerLeadScreen | DONE |
| `/broker/leads/:id` | BrokerLeadDetailScreen | DONE |
| `/broker/reservations/new` | CreateBrokerReservationScreen | DONE |
| `/broker/reservations/:id` | BrokerReservationDetailScreen | DONE |
| `/broker/commissions` | BrokerCommissionsScreen | DONE |
| `/broker/profile` | BrokerProfileScreen | DONE |

---

## Section 5 — Background Work & Integrations

### @Cron Decorators

| Job Name | Schedule | File:line | Real Logic? |
|---|---|---|---|
| `chat-retention-purge` | `0 3 * * *` (3 AM daily) | `chat/chat-retention.cron.ts:32` | YES — deletes ChatSession + messages older than 90 days (configurable via `CHAT_RETENTION_DAYS`) |
| Reservation expiry sweep | `EVERY_5_MINUTES` | `reservations/reservations.module.ts:2108` | YES — marks PENDING reservations past `expiresAt` as EXPIRED |
| `installments-mark-overdue` | `EVERY_DAY_AT_1AM` | `installments/installments.module.ts:813` | YES — promotes PENDING installments past `dueDate` to OVERDUE |
| `installment-reminder` | `0 9 * * *` (env-overridable via `INSTALLMENT_REMINDER_CRON`) | `installments/installments.module.ts:1023` | YES — sends reminder notifications for upcoming/overdue installments |
| `appointment-day-before-reminder` | `0 9 * * *` | `visits/appointment-reminder.cron.ts:28` | YES — sends day-before reminder (env-gated: `APPOINTMENT_REMINDERS_ENABLED=true`) |
| `appointment-hour-before-reminder` | `*/15 * * * *` | `visits/appointment-reminder.cron.ts:46` | YES — sends hour-before reminder (same env gate) |
| `subscription-expiry` | `EVERY_DAY_AT_1AM` | `super-admin/subscription-expiry.cron.ts:12` | YES — transitions subscription status (TRIAL/ACTIVE → EXPIRED/CANCELLED) |
| `maintenance-unresolved` | `EVERY_HOUR` | `maintenance/maintenance.module.ts:28` | YES — marks complaints past the unresolved window |
| `maintenance-sla-check` | `EVERY_HOUR` | `maintenance/maintenance.module.ts:60` | YES — fires SLA warning/breach notifications |

All crons use `CronLockService` (Redis-backed dedup) when available, or run bare otherwise. Cross-tenant execution uses `runTenantContext({ companyId: null, bypass: true })`.

### BullMQ

No BullMQ queue definitions, processors, or `@InjectQueue` usages found in `apps/api/src/`. BullMQ is referenced only in env validation comments (`env.validation.ts:182`). All async work is handled by in-process `@nestjs/schedule` crons.

### Email (SMTP / Nodemailer)

- **Service:** `apps/api/src/modules/auth/email.service.ts`
- **Config checked:** `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` — all optional in Zod schema (`env.validation.ts:29`), but a production-specific check in `validateProd()` (`env.validation.ts:153`) requires all four when `NODE_ENV=production`.
- **Timing:** Config is NOT validated at startup for dev/test — the transporter is created lazily on every `sendMail()` call (`email.service.ts:123`). Dev silently falls back to logging the URL to console.
- **Scope:** Only used for password-reset and email-verification emails. Notification emails (templates with `channel=EMAIL`) are not wired through this service — they are stored as `Notification` rows in the DB but the email delivery path is absent from `notifications.module.ts`.

### SMS / OTP

- **Service:** `apps/api/src/modules/auth/sms.service.ts`
- **Config:** `OTP_PROVIDER` env var — `console` (dev default) or `twilio`.
- **Console path:** Logs OTP code only in non-production (`sms.service.ts:41`). In production, logs "code generated (hidden)" — OTP is never sent if Twilio creds are missing.
- **Twilio path:** Production env validation (`env.validation.ts`) rejects `OTP_PROVIDER=console` and requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`. Twilio call is synchronous (no job queue, `sms.service.ts:23`).

### Push Notifications (FCM)

- **Service:** `apps/api/src/common/firebase/firebase.service.ts` + `apps/api/src/modules/notifications/push.service.ts`
- **Initialization:** `FirebaseService.onModuleInit()` loads `firebase-admin` lazily only when `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are all set (`firebase.service.ts:25`). Silently disabled otherwise.
- **Actual call:** `PushService.sendToUser()` calls `messaging.sendEachForMulticast()` — real FCM multicast (`push.service.ts:57`). Stale tokens are pruned on each send.
- **Dead-token pruning:** YES — removes tokens on `registration-token-not-registered` error (`push.service.ts:60`).

### Storage (R2/MinIO)

- **Service:** `apps/api/src/modules/media/r2.service.ts`
- **Dual bucket:** Public bucket (marketing media) + private bucket (contracts, receipts, documents, maintenance). Falls back to single bucket if `R2_PRIVATE_BUCKET` not set.
- **Presigned PUT:** Minted for uploads. Presigned GET minted for private downloads via `documents.module.ts` download endpoint.
- **Local dev:** S3-compatible endpoint (`S3_ENDPOINT` + `S3_FORCE_PATH_STYLE`) supports MinIO.
- **Config gap:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` are read at construction; if all three are absent the service initialises with `null` clients and every operation throws `ServiceUnavailableException` (r2.service.ts).

### Sentry

- **Initialization:** `initSentry()` is called at the very top of `apps/api/src/main.ts:5`, before any NestJS bootstrap — correct placement.
- **Loading:** Lazy `require('@sentry/node')` only when `SENTRY_DSN` is present (`sentry.ts:40`). Safe no-op otherwise.
- **Usage:** `captureExceptionSafe()` called from `RequestLoggerInterceptor` and several cron error handlers. PII scrubbing: `beforeSend` hook strips `password`, `token`, `secret`, `authorization` from request headers/body.
- **Status:** Correct and defensive implementation.

### Google Maps

- **Usage:** `@react-google-maps/api` is imported only in `apps/web-admin/src/components/maps/project-map.tsx:8`. Used for the project location picker in the admin dashboard. No backend usage.
- **Config:** Key is expected in a Next.js env var (NEEDS HUMAN INPUT — key name not verified).

### Payment Gateway

**No payment gateway integration found.** No Stripe, Paymob, Moyasar, PayPal, or any payment provider SDK is referenced anywhere in `apps/api/src/`. The platform records payment deposits as manual/offline records (`Deposit` model) with proof upload but no online card processing.

---

## Section 6 — Unfinished Work

### 6.1 TODO/FIXME/HACK/XXX in `apps/api/src/`

```
apps/api/src/modules/chat/providers/rule-based/contact-parse.ts:21: Egyptian local mobile: 01XXXXXXXXX (11 digits) → +20 1XXXXXXXXX
apps/api/src/modules/chat/providers/rule-based/contact-parse.ts:31: (01XXXXXXXXX → +20...) — comment notes normalisation logic
apps/api/src/modules/chat/providers/rule-based/responses.ts:148: phone prompt hardcodes Egyptian format 01XXXXXXXXX
apps/api/src/modules/chat/providers/rule-based/responses.ts:156: error message hardcodes 01XXXXXXXXX format
```

The actual grep for `TODO|FIXME|HACK|XXX` returned **no hits** in `apps/api/src/` — this is unusually clean. The only "flag" patterns found were in the chat rule-based provider, which are phone format examples embedded in Arabic strings, not code TODOs.

### 6.2 TODO/FIXME in `apps/web-admin/src/`

```
apps/web-admin/src/app/dashboard/clients/_form.tsx:138: placeholder="+966 5X XXX XXXX"
```

Only one hit — a UI placeholder string, not a code TODO.

### 6.3 TODO/FIXME in `apps/web-public/src/`

All hits are placeholder text in input fields (phone format examples like `+9665XXXXXXXX`) and test fixtures. No outstanding code TODOs.

### 6.4 `console.log` in `apps/api/src/` (excluding specs)

**No results found.** All logging goes through NestJS `Logger` instances.

### 6.5 NotImplementedException / `not implemented` / placeholder

```
apps/api/src/config/env.validation.ts:103: comment mentions "dev/test still boots with placeholder values"
apps/api/src/config/env.validation.ts:110: "JWT secrets: longer + must not be the placeholders shipped in .env.example"
apps/api/src/modules/settings/settings.module.ts:133: throws NotFoundException('Refusing to write redaction placeholder as a real value')
```

No `throw new Error('not implemented')` or `NotImplementedException` found. The settings one is intentional safety logic.

### 6.6 Hardcoded / magic numbers

```
apps/api/src/modules/reports/__tests__/admin-summary.spec.ts:218: "None of the removed hardcoded demo names survive."
apps/api/src/modules/reports/__tests__/admin-summary.spec.ts:268: "None of the removed hardcoded demo values survive."
```

These are test comments verifying that previously-hardcoded demo data was removed. No active hardcoded business constants in production code were flagged.

### Notable Partially-Implemented Items

These are structural gaps found during the module and schema review, not from grep:

1. **`InfoRequestStatus` transitions are dead code** — `InfoRequest.status` is set to `OPEN` on create and never updated. `RESPONDED` and `CLOSED` states have no write path (`requests.module.ts:200`). `reports.service.ts:338` queries for OPEN count only.

2. **Notification EMAIL channel is stored but not delivered** — `NotificationTemplate` supports `channel=EMAIL`, notifications are persisted to the DB, but `NotificationsService.sendToUser()` only calls `PushService.sendToUser()` for push. There is no SMTP send step for template-based notifications. Only auth-related emails (password reset, email verify) are sent via `email.service.ts`.

3. **`@Permissions` guard is advisory for most routes** — The guard is wired globally and does enforce permission codes when `@Permissions('code')` is present. However, `UserPermission` assignment is opt-in, and the seed only defines codes without assigning them by default. ADMIN's `adminBypass=true` means an ADMIN with zero assigned permissions still passes all non-strict gates (`permissions.guard.ts:34`).

4. **`capabilities` and `modules` JSON blobs on Company have no enforcing service** — MT-037 and the `modules` field are schema-only placeholders. The CapabilityService referenced in the comment does not yet exist. `Company.capabilities` is read nowhere in the codebase.

5. **`ChatSession.userId` and `ChatSession.leadId` are reserved columns** — No FK relation, no write path, no conversion from anonymous chat to authenticated user or lead. `schema.prisma:2254`.

6. **MT-034 Lifecycle enforcement comment** — `Company.lifecycleStatus` enforcement is live via `CompanyLifecycleGuard` (guard confirmed in app.module). However, the schema comment at line 27 still says "enforcement comes in MT-034" suggesting the guard rollout note hasn't been updated.

---

## Section 7 — Top 10 Concerns

Ordered by cost-to-fix-later (highest first).

### 1. Permission system is stored but not enforced for most routes

**Risk: High | Cost to fix later: Very High**

`UserPermission` rows are assignable and stored, but `PermissionsGuard` only activates on routes explicitly decorated with `@Permissions('code')`. Many operational routes (e.g. `GET /info-requests` at `requests.module.ts:575`) have `@Roles` but no `@Permissions`. More critically, the `adminBypass=true` default means an ADMIN user passes ALL non-`@PermissionsStrict` gates with zero assigned permissions (`permissions.guard.ts:34`). This defeats the purpose of fine-grained permission codes for ADMIN users entirely. As the team scales with multiple admin users of different access levels, this becomes a segregation-of-duties defect. Retrofitting permission codes to all routes is expensive.

**Citation:** `apps/api/src/common/guards/permissions.guard.ts:34`, `apps/api/src/modules/requests/requests.module.ts:575`

---

### 2. Dual lifecycle flags on Company (`isActive` + `lifecycleStatus`) create split-brain risk

**Risk: High | Cost to fix later: High**

`Company.isActive` (Boolean) and `Company.lifecycleStatus` (enum) are parallel controls. `TenantResolverService` uses `isActive` to determine tenant availability; `CompanyLifecycleGuard` uses `lifecycleStatus`. If these get out of sync (e.g. a direct DB update, a migration bug, or an API path that only updates one), a company can be accessible via one path and blocked via the other. The schema comment at line 27 acknowledges the debt: "Future: lifecycleStatus will become the canonical control; isActive will be derived or removed."

**Citation:** `apps/api/prisma/schema.prisma:29` (`isActive`), `schema.prisma:53` (`lifecycleStatus`)

---

### 3. Notification EMAIL channel is defined in the DB model but has no delivery path

**Risk: Medium-High | Cost to fix later: Medium**

`NotificationTemplate.channel` supports `EMAIL`, and many templates may be seeded as EMAIL-channel. `NotificationsService.sendToUser()` persists a `Notification` row and fires a push — no email send occurs. Any workflow relying on email notifications (e.g. a template seeded as EMAIL for maintenance updates, visit confirmations) silently drops the notification to a DB row that the user never sees. The only emails sent are auth-related (password reset, verify). This is a silent feature gap that could cause SLA or customer experience issues.

**Citation:** `apps/api/src/modules/notifications/notifications.module.ts:231–340`, `apps/api/src/modules/auth/email.service.ts:1`

---

### 4. `OtpCode.companyId` has no FK `@relation` — cross-tenant OTP lookup risk

**Risk: Medium-High | Cost to fix later: Medium**

`OtpCode.companyId` is a plain `String? @db.Uuid` with no Prisma `@relation` and no DB-level FK — `schema.prisma:391`. The comment says "no FK relation, no auto-injection." OTP verification queries must manually scope by `companyId`, but the column is nullable, meaning a legacy OTP row without a `companyId` could match any company lookup if the query is not written carefully. With the DEFAULT_COMPANY_ID fallback still enabled by default, an attacker who knows another company's user's phone could attempt OTP replay across companies.

**Citation:** `apps/api/prisma/schema.prisma:391`, `apps/api/src/modules/auth/auth.service.ts:927`

---

### 5. `Company.capabilities` / `Company.modules` are untyped, unenforced JSON blobs

**Risk: Medium | Cost to fix later: Medium-High**

`Company.capabilities (Json?)` (MT-037) and `Company.modules (Json?)` are written and read with no schema validation, no TypeScript type, and no CapabilityService. The `modules` blob is supposed to control which dashboard sections are visible (`schema.prisma:124`), but nothing reads it to enforce feature toggling at the API layer. As more companies with different entitlements are onboarded, the absence of a typed capability-enforcement layer means features intended to be plan-gated will be accessible to all tenants.

**Citation:** `apps/api/prisma/schema.prisma:57–68`, `apps/api/prisma/schema.prisma:124`

---

### 6. `Deposit.verified` (Boolean) duplicates `Deposit.reviewStatus` (enum) — dual state must stay in sync manually

**Risk: Medium | Cost to fix later: Medium**

`Deposit.verified` (legacy Boolean) coexists with `Deposit.reviewStatus` (DepositReviewStatus enum) at `schema.prisma:1286`. The comment says "true iff reviewStatus = APPROVED." Every code path that updates one must also update the other, and there is no DB trigger or Prisma middleware enforcing this invariant. A bug or a direct DB update that sets only one will produce inconsistent data. Any feature built on `verified` or `reviewStatus` independently will diverge.

**Citation:** `apps/api/prisma/schema.prisma:1286`

---

### 7. Chat sessions are fully anonymous with no server-side ownership binding

**Risk: Medium | Cost to fix later: Medium**

All `/chat/sessions/*` routes are `@Public` and identity is a client-generated `anonymousId`. Any caller who knows a session UUID can read its full transcript and add messages — `chat.controller.ts:24–53`. For a sales/real-estate context where users submit contact information and visit requests during chat, transcript data (name, phone, project interest) can be read by anyone with the UUID. The `anonymousId` is generated client-side with no server-issued session token as a binding proof.

**Citation:** `apps/api/src/modules/chat/chat.controller.ts:24–53`

---

### 8. `DEFAULT_COMPANY_ID` fallback creates implicit single-tenancy for legacy users

**Risk: Medium | Cost to fix later: High**

CLIENT/CUSTOMER users without a `companyId` (legacy rows) fall back to `DEFAULT_COMPANY_ID` in both `TenantContextInterceptor` (`tenant-context.interceptor.ts:104`) and `CompanyLifecycleGuard`. This means those users are implicitly scoped to the first company — a single-tenancy assumption embedded in env-var logic. As new companies are onboarded, clients who registered before MT-schema migration need their `companyId` backfilled. Until that migration is complete, `DEFAULT_COMPANY_ID` must be set and correct, or those legacy users get 500 errors. The flag `DISABLE_DEFAULT_COMPANY_FALLBACK` is available but defaults to false.

**Citation:** `apps/api/src/common/interceptors/tenant-context.interceptor.ts:104`, `apps/api/src/config/env.validation.ts:212`

---

### 9. `Unit.type` and `InstallmentPlanTemplate.visibility` are unvalidated plain strings

**Risk: Low-Medium | Cost to fix later: Medium**

`Unit.type` is `String` with no enum — `schema.prisma:529`. Admin can create units with arbitrary type values ("studio", "1BR", "2BR", "villa", ...). Mobile and web filters that list distinct unit types will accumulate inconsistent values over time (e.g. "1BR" vs "1-bedroom" vs "شقة غرفة واحدة"). Similarly, `InstallmentPlanTemplate.visibility` defaults to `"SALES_ONLY"` as a plain string — `schema.prisma:1383`. An enum would catch typos and enable Prisma-level filtering.

**Citation:** `apps/api/prisma/schema.prisma:529`, `schema.prisma:1383`

---

### 10. `Setting` model is missing `createdAt` — no audit trail for when settings were first created

**Risk: Low | Cost to fix later: Low**

`Setting` has `updatedAt` but no `createdAt` — `schema.prisma:2131`. Every other model in the schema has `createdAt`. The absence means it's impossible to query "when was this setting first introduced" or filter audit logs by setting creation date. This is a minor schema oversight but becomes harder to fix retroactively once there are many setting rows (backfilling `createdAt` from `updatedAt` would be lossy).

**Citation:** `apps/api/prisma/schema.prisma:2131–2141`

---

## NEEDS HUMAN INPUT

The following items could not be fully verified from static analysis:

1. **Google Maps API key environment variable name** — `@react-google-maps/api` is used in `apps/web-admin/src/components/maps/project-map.tsx:8` but the env var expected by Next.js (likely `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) was not confirmed in a `.env.example` or config file within scope.

2. **`GET /visits` admin route in web-admin** — No `apps/web-admin/src/app/dashboard/visits/page.tsx` was found in the filesystem listing (the directory may exist under a different path or the visits feature may be accessed via `/dashboard/requests`). Needs manual verification.

3. **NotificationTemplate codes seeded for EMAIL channel** — Could not verify which `NotificationTemplate` rows in the seed file use `channel=EMAIL`. If any do, those notifications are silently dropped (see Concern #3). Requires checking `apps/api/prisma/seed.ts`.

4. **`DISABLE_DEFAULT_COMPANY_FALLBACK` production value** — The env flag defaults to `false` (legacy-compatible). Whether this is intentionally left as `false` in production needs confirmation from the ops team.

5. **Prisma `$use` deprecation** — The comment in `apps/api/src/common/prisma/prisma.service.ts:50` notes that `$use` is deprecated in Prisma 5 and scheduled for removal in Prisma 6. Whether the project has already upgraded to Prisma 6 or has a migration plan needs confirmation.

6. **`ChatFeedback.messageId`** — Typed as `String? @db.Uuid` with no `@relation` to `ChatMessage` (`schema.prisma:2298`). Whether this is intentional (polymorphic future use) or an oversight needs clarification.

7. **Firebase credentials in production** — FCM push gracefully disables when credentials are absent. Confirmation that `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are provisioned in production is needed to verify push notifications actually work.

8. **R2/MinIO private-bucket isolation in production** — `R2_PRIVATE_BUCKET` falls back to the public bucket if unset. Confirmation that this env var is set in production is needed to ensure contracts and receipts are not served from the CDN-public bucket.
