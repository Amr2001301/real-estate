import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Injectable,
  Logger,
  Module,
  OnModuleInit,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  Prisma,
  NotificationChannel,
  UserRole,
  type CompanyLifecycleStatus,
  type NotificationTemplate,
  type SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { formatMoney, getCompanyCurrency } from '../../common/currency/currency';
import { COMPANY_TIMEZONE_DEFAULT, currentCompanyTimeZone } from '../../common/time/company-timezone';
import {
  findTenantUser,
  resolveTenantUser,
  scopedUserFindMany,
} from '../../common/tenant/resolve-tenant-entity';
import { getRequiredCompanyId, getTenantContext } from '../../common/tenant/tenant-context';
import { companyAccessAllowed } from '../../common/tenant/company-access';
import { Roles } from '../../common/decorators/roles.decorator';
import { GrantedBy } from '../../common/decorators/granted-by.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { PushService } from './push.service';
import { AuthModule } from '../auth/auth.module';
import { EmailService } from '../auth/email.service';
import { NOTIFICATION_CATALOG } from './notification-catalog';
import { channelAllowed } from './notification-groups';
import { Counter, register } from 'prom-client';
import { reportFailure } from '../../common/observability/report-failure';

/** Push / e-mail delivery outcomes; `failed` means the provider refused or threw. */
export const notificationDeliveryTotal = new Counter({
  name: 'notification_delivery_total',
  help: 'Notification push / e-mail deliveries by channel and outcome',
  labelNames: ['channel', 'outcome'],
  registers: [register],
});

const PUSH_UNCONFIGURED = 'FCM not configured';
const EMAIL_UNCONFIGURED = 'SMTP not configured';
/** FG-09 — redelivery of failed push / e-mail. */
export const MAX_DELIVERY_RETRIES = 3;
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
const RETRY_BATCH = 200;
const SETUP_ERROR_PREFIX = 'Delivery error: ';
/** 5, 15, then 45 minutes after the previous attempt. */
export function retryDueAt(previousAttempt: Date, retriesSoFar: number): Date {
  return new Date(previousAttempt.getTime() + 5 * 60_000 * 3 ** retriesSoFar);
}

class UpsertTemplateDto {
  @IsString() code!: string;
  @IsEnum(NotificationChannel) channel!: NotificationChannel;
  @IsString() ar_subject!: string;
  @IsString() en_subject!: string;
  @IsString() ar_body!: string;
  @IsString() en_body!: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
}

class SendNotificationDto {
  @IsUUID() userId!: string;
  @IsString() templateCode!: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
  @IsOptional() @IsEnum(NotificationChannel) channel?: NotificationChannel;
}

class UnregisterDeviceDto {
  @IsString() @IsNotEmpty() @MaxLength(4096) token!: string;
}

class RegisterDeviceDto {
  @IsString() token!: string;
  @IsString() platform!: string; // ios | android | web
}

/** Who the broadcast targets — used in BroadcastNotificationDto. */
export enum BroadcastTarget {
  USER = 'USER',
  ROLE = 'ROLE',
  ALL_CUSTOMERS = 'ALL_CUSTOMERS',
  ALL_BROKERS = 'ALL_BROKERS',
  ALL_SALES = 'ALL_SALES',
  ALL_MAINTENANCE_SUPERVISORS = 'ALL_MAINTENANCE_SUPERVISORS',
  ALL_ACTIVE = 'ALL_ACTIVE',
}

/**
 * Delivery channel for admin broadcasts. Separate from the Prisma
 * NotificationChannel to allow IN_APP_AND_PUSH without a DB migration.
 * String values intentionally match NotificationChannel where they overlap.
 *
 * IN_APP          → create Notification DB rows only. No FCM.
 * PUSH            → send FCM only. No DB rows. Requires Firebase.
 * IN_APP_AND_PUSH → create DB rows AND send FCM. Requires Firebase.
 *                   One DB row per recipient regardless of device count.
 */
export enum BroadcastChannel {
  IN_APP          = 'IN_APP',
  PUSH            = 'PUSH',
  IN_APP_AND_PUSH = 'IN_APP_AND_PUSH',
}

class BroadcastNotificationDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title_ar!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) title_en!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) body_ar!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) body_en!: string;
  @IsEnum(BroadcastTarget) target!: BroadcastTarget;
  @IsOptional() @IsUUID() targetUserId?: string;
  @IsOptional() @IsEnum(UserRole) targetRole?: UserRole;
  @IsEnum(BroadcastChannel) channel!: BroadcastChannel;
  @IsOptional() @IsString() @MaxLength(60) entityType?: string;
  @IsOptional() @IsString() @MaxLength(36) entityId?: string;
}

/** Dry-run DTO — only the targeting fields; returns count without sending. */
class BroadcastPreviewDto {
  @IsEnum(BroadcastTarget) target!: BroadcastTarget;
  @IsOptional() @IsUUID() targetUserId?: string;
  @IsOptional() @IsEnum(UserRole) targetRole?: UserRole;
  /** When PUSH or IN_APP_AND_PUSH, also returns estimated device token counts. */
  @IsOptional() @IsEnum(BroadcastChannel) channel?: BroadcastChannel;
}

type Locale = 'ar' | 'en';

function pickLocale(header?: string): Locale {
  return (header ?? 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
}

/** Id keys a push carries for deep links (ids only, never content). */
const PUSH_ID_KEYS = [
  'contractId',
  'reservationId',
  'leadId',
  'depositId',
  'installmentId',
  'visitId',
  'requestId',
] as const;

/** Payload fields that hold an amount of money (raw Decimal strings). */
const MONEY_KEYS = new Set([
  'amount',
  'bookingAmount',
  'penaltyAmount',
  'monthlyAmount',
  'refundAmount',
  'retainedAmount',
]);

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;

/**
 * A timestamp in a payload, as a reader expects it: a day ("2026-09-01")
 * for a date-only value (stored at UTC midnight, or midnight company
 * time), else the company's wall time ("2026-10-20 13:00").
 */
function formatPayloadTime(iso: string, timeZone: string): string {
  if (/T00:00(:00(\.0+)?)?Z$/.test(iso)) return iso.slice(0, 10);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}`;
  return time === '00:00' ? day : `${day} ${time}`;
}

/** Like the currency: formatting a date must never fail the notification. */
async function notificationTimeZone(
  db: Parameters<typeof currentCompanyTimeZone>[0],
  companyId: string | null | undefined,
): Promise<string> {
  try {
    return await currentCompanyTimeZone(db, companyId);
  } catch {
    return COMPANY_TIMEZONE_DEFAULT;
  }
}

/**
 * Fills `{{var}}` placeholders from the notification payload. Amounts are
 * shown in the company's currency, in the reader's language
 * ("2,500,000 ج.م." / "EGP 2,500,000") instead of the raw "2500000.00";
 * timestamps as a day or the company's wall time, not raw ISO.
 */
function interpolate(
  template: string,
  payload: Record<string, unknown>,
  locale: Locale,
  currency: string,
  timeZone: string,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = payload[key];
    if (v === null || v === undefined) return '';
    if (MONEY_KEYS.has(key)) return formatMoney(v, currency, locale);
    if (typeof v === 'string' && ISO_TIMESTAMP.test(v)) return formatPayloadTime(v, timeZone);
    return String(v);
  });
}

interface TranslatableText {
  ar?: string;
  en?: string;
}

function resolveText(
  text: Prisma.JsonValue | null | undefined,
  payload: Record<string, unknown>,
  locale: Locale,
  fallback: string,
  currency: string,
  timeZone: string,
): string {
  const t = (text ?? {}) as TranslatableText;
  const raw = t[locale] ?? t.ar ?? t.en ?? fallback;
  return interpolate(raw, payload, locale, currency, timeZone);
}


/** Who must not get a notification — usually the user whose action caused it. */
export interface NotifyOptions {
  except?: string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** One template per code: a company override beats the platform default. */
function pickEffective(rows: NotificationTemplate[]): Map<string, NotificationTemplate> {
  const byCode = new Map<string, NotificationTemplate>();
  for (const row of rows) {
    const current = byCode.get(row.code);
    if (!current || (row.companyId !== null && current.companyId === null)) byCode.set(row.code, row);
  }
  return byCode;
}

/** Notices about the company's own subscription/state — sent even when it is blocked. */
const PLATFORM_NOTICE = /^(subscription_|company_)/;

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly email: EmailService,
  ) {}

  /**
   * Inserts every catalog template (notification-catalog.ts) that has no
   * platform default yet, so a new event never ships without its text —
   * independent of whether the seed ran. Existing rows (and companies'
   * overrides) are never touched.
   */
  async onModuleInit() {
    try {
      const existing = await this.prisma.notificationTemplate.findMany({
        where: { companyId: null, code: { in: NOTIFICATION_CATALOG.map((t) => t.code) } },
        select: { code: true },
      });
      const have = new Set(existing.map((t) => t.code));
      const missing = NOTIFICATION_CATALOG.filter((t) => !have.has(t.code));
      for (const t of missing) {
        await this.prisma.notificationTemplate.create({
          data: {
            code: t.code,
            channel: t.channel,
            emailEnabled: t.emailEnabled ?? false,
            subject: { ar: t.ar_subject, en: t.en_subject } as Prisma.InputJsonValue,
            body: { ar: t.ar_body, en: t.en_body } as Prisma.InputJsonValue,
          },
        });
      }
      this.logger.log(`notification templates verified (${missing.length} added)`);
    } catch (err) {
      // Non-fatal: log and continue — a send with a missing template is
      // skipped with a warning (e.g. DB not yet migrated).
      reportFailure(this.logger, 'notification-templates', `notification template bootstrap failed`, err, 'error');
    }
  }

  /**
   * FG-26 — writes the caller's company override for `code`. The platform
   * default and other companies' overrides are never touched: the row is
   * keyed on (companyId, code) and companyId always comes from the context.
   */
  async upsertTemplate(dto: UpsertTemplateDto) {
    const companyId = getRequiredCompanyId();
    const existing = await this.prisma.notificationTemplate.findFirst({
      where: { companyId, code: dto.code },
      select: { id: true },
    });
    const content = {
      channel: dto.channel,
      subject: { ar: dto.ar_subject, en: dto.en_subject } as Prisma.InputJsonValue,
      body: { ar: dto.ar_body, en: dto.en_body } as Prisma.InputJsonValue,
    };
    if (existing) {
      return this.prisma.notificationTemplate.update({
        where: { id: existing.id },
        data: { ...content, active: dto.active ?? undefined, emailEnabled: dto.emailEnabled },
      });
    }
    return this.prisma.notificationTemplate.create({
      data: {
        ...content,
        code: dto.code,
        companyId,
        active: dto.active ?? true,
        emailEnabled: dto.emailEnabled ?? false,
      },
    });
  }

  /** The templates this company actually uses: its overrides over the platform defaults. */
  async listTemplates() {
    const companyId = getRequiredCompanyId();
    const rows = await this.prisma.notificationTemplate.findMany({
      where: { OR: [{ companyId: null }, { companyId }] },
    });
    return [...pickEffective(rows).values()].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }

  /**
   * FG-26 — resolve templates for the current company: its override where it
   * has one, else the platform default. With no company in context (a cron in
   * bypass) only platform defaults are considered — never another company's
   * override.
   */
  private async templatesFor(codes: string[]): Promise<Map<string, NotificationTemplate>> {
    const companyId = getTenantContext()?.companyId ?? null;
    const rows = await this.prisma.notificationTemplate.findMany({
      where: {
        code: { in: codes },
        OR: companyId ? [{ companyId: null }, { companyId }] : [{ companyId: null }],
      },
    });
    return pickEffective(rows);
  }

  private async templateFor(code: string): Promise<NotificationTemplate | null> {
    return (await this.templatesFor([code])).get(code) ?? null;
  }

  /**
   * Fan-out helper used by business modules to deliver a notification without
   * coupling them to the underlying send/push/template machinery.
   *
   * - DB row is always created (best-effort: any thrown error is logged and
   *   swallowed so the caller's business action never fails).
   * - Push is attempted via [send] and is already best-effort there.
   * - Returns void; recipient resolution / lookup errors do not propagate.
   */
  async sendToUser(
    userId: string | null | undefined,
    templateCode: string,
    payload: Record<string, unknown> = {},
    opts: NotifyOptions = {},
  ): Promise<void> {
    if (!userId) return; // safe skip — recipient missing
    if (opts.except && userId === opts.except) return; // the actor already knows
    try {
      await this.send({ userId, templateCode, payload, skipInactive: true });
    } catch (err) {
      reportFailure(this.logger, 'notification', `Notification send failed (${templateCode})`, err);
    }
  }

  /**
   * Deliver one notification to many recipients. Deduplicates user ids so a
   * customer who's also flagged as a recipient through some other path never
   * sees the same notification twice. Empty / null entries are silently
   * dropped. Each per-user send is independent — one failure does not abort
   * the rest.
   */
  async sendToUsers(
    userIds: ReadonlyArray<string | null | undefined>,
    templateCode: string,
    payload: Record<string, unknown> = {},
    opts: NotifyOptions = {},
  ): Promise<void> {
    const unique = Array.from(
      new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0)),
    );
    if (unique.length === 0) return;
    await Promise.all(
      unique.map((userId) => this.sendToUser(userId, templateCode, payload, opts)),
    );
  }

  /**
   * Resolve recipients by role and deliver to each. Inactive users are
   * skipped. Used for the "notify all admins" / "notify sales managers" fan-
   * outs that visit lifecycle events trigger. Like the other helpers, this
   * never throws past the caller.
   */
  async sendToRoles(
    roles: ReadonlyArray<UserRole>,
    templateCode: string,
    payload: Record<string, unknown> = {},
    opts: NotifyOptions = {},
  ): Promise<void> {
    if (roles.length === 0) return;
    try {
      const users = await scopedUserFindMany(
        this.prisma,
        { role: { in: [...roles] }, active: true },
        { id: true },
      );
      await this.sendToUsers(users.map((u) => u.id), templateCode, payload, opts);
    } catch (err) {
      reportFailure(this.logger, 'notification', `Notification fan-out failed (${templateCode})`, err);
    }
  }

  /**
   * Specific people plus everyone active in `roles`, as one deduplicated
   * fan-out: a sales manager who is also the deal's sales person hears once.
   * Never throws past the caller.
   */
  async sendToUsersAndRoles(
    userIds: ReadonlyArray<string | null | undefined>,
    roles: ReadonlyArray<UserRole>,
    templateCode: string,
    payload: Record<string, unknown> = {},
    opts: NotifyOptions = {},
  ): Promise<void> {
    try {
      const byRole = roles.length
        ? await scopedUserFindMany(
            this.prisma,
            { role: { in: [...roles] }, active: true },
            { id: true },
          )
        : [];
      await this.sendToUsers([...userIds, ...byRole.map((u) => u.id)], templateCode, payload, opts);
    } catch (err) {
      reportFailure(this.logger, 'notification', `Notification fan-out failed (${templateCode})`, err);
    }
  }

  /**
   * Who on a broker firm hears about a deal: the agent who owns it plus the
   * firm's managers (primary contact or `canManageBrokerUsers`) — not every
   * agent of the firm. With no agent (firm-level events such as unit access
   * or payouts) it is the managers only; `everyone` reaches every active
   * user (the firm's own approval / suspension). Money events (commissions,
   * payouts) keep only users allowed to see commissions.
   */
  async brokerRecipients(
    brokerId: string | null | undefined,
    opts: { agentUserId?: string | null; money?: boolean; everyone?: boolean } = {},
  ): Promise<string[]> {
    if (!brokerId) return [];
    const users = await this.prisma.brokerUser.findMany({
      where: {
        brokerId,
        status: 'ACTIVE',
        ...(opts.money ? { canViewCommissions: true } : {}),
        ...(opts.everyone
          ? {}
          : {
              OR: [
                { isPrimaryContact: true },
                { canManageBrokerUsers: true },
                ...(opts.agentUserId ? [{ userId: opts.agentUserId }] : []),
              ],
            }),
      },
      select: { userId: true },
    });
    return users.map((u) => u.userId);
  }

  /**
   * A member joined a broker firm's team or changed status: the member hears,
   * and so do the firm's managers — never whoever made the change.
   */
  async notifyBrokerTeamChange(
    brokerId: string,
    member: { userId: string; name: string },
    event: 'added' | 'status',
    extra: Record<string, unknown> = {},
    opts: NotifyOptions = {},
  ): Promise<void> {
    try {
      const broker = await this.prisma.broker.findFirst({
        where: { id: brokerId, companyId: getRequiredCompanyId() },
        select: { companyName: true, commercialName: true },
      });
      const payload = {
        name: member.name,
        brokerName: broker?.commercialName || broker?.companyName || '',
        entityType: 'broker',
        entityId: brokerId,
        ...extra,
      };
      const managers = (await this.brokerRecipients(brokerId)).filter((id) => id !== member.userId);
      if (event === 'added') {
        await this.sendToUser(member.userId, 'broker_user_invited', payload, opts);
        await this.sendToUsers(managers, 'broker_team_member_added', payload, opts);
      } else {
        await this.sendToUser(member.userId, 'broker_user_status_changed', payload, opts);
        await this.sendToUsers(managers, 'broker_team_member_status_changed', payload, opts);
      }
    } catch (err) {
      reportFailure(this.logger, 'notification', 'notifyBrokerTeamChange failed', err);
    }
  }

  private async companyBlocked(): Promise<boolean> {
    const companyId = getTenantContext()?.companyId;
    if (!companyId) return false;
    let company: { lifecycleStatus: CompanyLifecycleStatus; subscriptionStatus: SubscriptionStatus } | null;
    try {
      company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { lifecycleStatus: true, subscriptionStatus: true },
      });
    } catch {
      return false;
    }
    // Only an explicit block stops a send — a partial read is not a reason
    // to drop a notice.
    return (
      !!company &&
      (company.lifecycleStatus !== undefined || company.subscriptionStatus !== undefined) &&
      !companyAccessAllowed(company)
    );
  }

  private async recipientGone(userId: string): Promise<boolean> {
    try {
      const u = await findTenantUser(this.prisma, userId, { active: true, deletedAt: true });
      return !!u && (u.active === false || !!u.deletedAt);
    } catch {
      return false; // no tenant context to look in: deliver as before
    }
  }

  async send(dto: SendNotificationDto & { skipInactive?: boolean }) {
    const tpl = await this.templateFor(dto.templateCode);
    if (!tpl) throw new Error(`Template ${dto.templateCode} not found`);
    // A company that switched an event off (templates page) gets no
    // automatic notification for it; an admin's manual send still goes out.
    if (dto.skipInactive && tpl.active === false) return null;
    // Automatic events never go to a deactivated or deleted account — a
    // departed employee kept getting pushes about leads and customers.
    if (dto.skipInactive && (await this.recipientGone(dto.userId))) return null;
    // A suspended, archived or expired company sends its customers and staff
    // nothing automatic — reminders kept going out after access was cut. The
    // platform's own notices about the subscription itself still go.
    if (dto.skipInactive && !PLATFORM_NOTICE.test(dto.templateCode) && (await this.companyBlocked())) return null;
    const channel = dto.channel ?? tpl.channel;
    const payload = (dto.payload ?? {}) as Record<string, unknown>;

    // sentAt = row-creation timestamp. Delivery truth is in the four outcome
    // columns (emailSentAt, emailError, pushSentAt, pushError) written below.
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        templateCode: dto.templateCode,
        payload: payload as Prisma.InputJsonValue,
        channel,
        sentAt: new Date(),
      },
    });

    await this.deliver(
      { id: notification.id, userId: dto.userId, templateCode: dto.templateCode },
      tpl,
      payload,
      { push: true, email: true },
    );

    return notification;
  }

  /**
   * Push and e-mail for a stored notification row, outcome written back to the
   * row. `want` limits the channels (a retry only re-sends what failed); the
   * user's own opt-outs are checked again every time.
   */
  private async deliver(
    n: { id: string; userId: string; templateCode: string },
    tpl: NotificationTemplate,
    payload: Record<string, unknown>,
    want: { push: boolean; email: boolean },
    retry = false,
  ): Promise<void> {
    // Delivery outcome accumulator — written back to the row once at the end.
    const outcome: {
      pushSentAt?: Date;
      pushError?: string | null;
      emailSentAt?: Date;
      emailError?: string | null;
    } = {};

    try {
      const user = await resolveTenantUser(
        this.prisma,
        n.userId,
        { locale: true, email: true, notificationPrefs: true },
      );
      // The user's own opt-outs (in-app always stays).
      const pushWanted = want.push && channelAllowed(user?.notificationPrefs, 'push', n.templateCode);
      const emailWanted = want.email && channelAllowed(user?.notificationPrefs, 'email', n.templateCode);
      const locale = pickLocale(user?.locale ?? 'ar');
      const companyId = getTenantContext()?.companyId;
      const [currency, timeZone] = await Promise.all([
        getCompanyCurrency(this.prisma, companyId),
        notificationTimeZone(this.prisma, companyId),
      ]);

      // FCM data values must all be strings. Include entityType/entityId so
      // the mobile app can deep-link directly from the push tap without a
      // separate API call. Never include sensitive fields.
      const fcmData: Record<string, string> = {
        templateCode: n.templateCode,
        notificationId: n.id,
      };
      if (payload.entityType && typeof payload.entityType === 'string') {
        fcmData['entityType'] = payload.entityType;
      }
      if (payload.entityId && typeof payload.entityId === 'string') {
        fcmData['entityId'] = payload.entityId;
      }
      // Related ids (never content) so a push tap opens the same screen as
      // the in-app list does.
      for (const key of PUSH_ID_KEYS) {
        const v = payload[key];
        if (typeof v === 'string' && v) fcmData[key] = v;
      }

      // Push and email run concurrently so SMTP latency does not stack on top
      // of FCM latency. Each promise catches its own errors and records them
      // in `outcome`; neither can reject Promise.all.
      const pushPromise: Promise<void> = !pushWanted
        ? Promise.resolve()
        : this.push
        .sendToUser(n.userId, {
          title: resolveText(tpl.subject, payload, locale, n.templateCode, currency, timeZone),
          body:  resolveText(tpl.body,    payload, locale, '', currency, timeZone),
          data:  fcmData,
        })
        .then((result) => {
          if (!result.enabled) {
            outcome.pushError = PUSH_UNCONFIGURED;
            notificationDeliveryTotal.inc({ channel: 'push', outcome: 'unconfigured' });
          } else if (result.sent > 0) {
            outcome.pushSentAt = new Date();
            if (retry) outcome.pushError = null;
            notificationDeliveryTotal.inc({ channel: 'push', outcome: 'sent' });
          }
          // sent === 0 with no failure: user has no registered device.
          // Not an error — no pushError, no pushSentAt.
        })
        .catch((err: unknown) => {
          outcome.pushError = ((err as Error).message ?? 'FCM error').slice(0, 500);
          notificationDeliveryTotal.inc({ channel: 'push', outcome: 'failed' });
          reportFailure(this.logger, 'notification-push', `Push failed (${n.templateCode})`, err);
        });

      const emailPromise: Promise<void> =
        user?.email && tpl.emailEnabled && emailWanted
          ? (() => {
              // Escaped: payload values (names, notes) are user input.
              const subject  = escapeHtml(resolveText(tpl.subject, payload, locale, n.templateCode, currency, timeZone));
              const bodyText = escapeHtml(resolveText(tpl.body,    payload, locale, '', currency, timeZone));
              const dir      = locale === 'ar' ? 'rtl' : 'ltr';
              const htmlBody = `<div dir="${dir}" style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#1a1a2e;"><h2 style="margin:0 0 16px;color:#0F1E33;">${subject}</h2><p style="margin:0 0 24px;line-height:1.7;">${bodyText}</p><hr style="margin:28px 0;border:none;border-top:1px solid #eee;"/><p style="margin:0;font-size:12px;color:#999;">© ديفورا — منصة الإدارة العقارية</p></div>`;
              return this.email
                .sendNotificationEmail(user.email, subject, htmlBody)
                .then((result) => {
                  if (result.ok) {
                    outcome.emailSentAt = result.sentAt;
                    if (retry) outcome.emailError = null;
                    notificationDeliveryTotal.inc({ channel: 'email', outcome: 'sent' });
                  } else if (result.unconfigured) {
                    outcome.emailError = result.error;
                    notificationDeliveryTotal.inc({ channel: 'email', outcome: 'unconfigured' });
                  } else {
                    outcome.emailError = result.error;
                    notificationDeliveryTotal.inc({ channel: 'email', outcome: 'failed' });
                    reportFailure(
                      this.logger,
                      'notification-email',
                      `E-mail failed (${n.templateCode})`,
                      new Error(result.error),
                    );
                  }
                });
            })()
          : Promise.resolve();

      await Promise.all([pushPromise, emailPromise]);
    } catch (err) {
      // user lookup failed or another setup error — record on push channel
      // (the most likely recipient of the original intent).
      const msg = ((err as Error).message ?? 'delivery setup error').slice(0, 500);
      reportFailure(this.logger, 'notification', `Delivery setup failed for ${n.templateCode}`, err);
      outcome.pushError = outcome.pushError ?? `${SETUP_ERROR_PREFIX}${msg}`;
    }

    // Write delivery outcome back in a single update. Skip when nothing was
    // attempted (e.g. template has no eligible channels and user has no email).
    // A retry always records itself, so the job never picks the row up early.
    const data = retry
      ? { ...outcome, deliveryRetries: { increment: 1 }, lastRetryAt: new Date() }
      : outcome;
    if (Object.keys(data).length > 0) {
      await this.prisma.notification.update({ where: { id: n.id }, data });
    }

  }

  /**
   * FG-09 — re-send the push / e-mail of recent notifications whose delivery
   * failed. Only real failures are retried (not "FCM / SMTP not configured"),
   * at most MAX_DELIVERY_RETRIES times with growing gaps, within 24 hours of
   * the notification. Must run inside the row's company context; the cron
   * groups rows by company. Returns how many rows were retried.
   */
  async retryFailedDeliveries(now = new Date()): Promise<number> {
    const rows = await this.prisma.notification.findMany({
      where: {
        createdAt: { gte: new Date(now.getTime() - RETRY_WINDOW_MS) },
        deliveryRetries: { lt: MAX_DELIVERY_RETRIES },
        OR: [
          { pushError: { not: null }, NOT: { pushError: PUSH_UNCONFIGURED } },
          { emailError: { not: null }, NOT: { emailError: EMAIL_UNCONFIGURED } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: RETRY_BATCH,
    });
    let retried = 0;
    for (const row of rows) {
      const due = retryDueAt(row.lastRetryAt ?? row.createdAt, row.deliveryRetries);
      if (due > now) continue;
      try {
        const tpl = await this.templateFor(row.templateCode);
        if (!tpl) {
          // Template gone: nothing to re-send — stop picking the row up.
          await this.prisma.notification.update({
            where: { id: row.id },
            data: { deliveryRetries: MAX_DELIVERY_RETRIES, lastRetryAt: now },
          });
          continue;
        }
        await this.deliver(
          row,
          tpl,
          (row.payload ?? {}) as Record<string, unknown>,
          {
            push: !!row.pushError && row.pushError !== PUSH_UNCONFIGURED,
            // A setup failure ("Delivery error: …", recorded on push) stopped
            // the e-mail too, so it is re-tried with it.
            email:
              (!!row.emailError && row.emailError !== EMAIL_UNCONFIGURED) ||
              !!row.pushError?.startsWith(SETUP_ERROR_PREFIX),
          },
          true,
        );
        retried += 1;
      } catch (err) {
        reportFailure(this.logger, 'notification-retry', `Retry of notification ${row.id} failed`, err);
      }
    }
    return retried;
  }

  async listMine(
    userId: string,
    opts: { unreadOnly: boolean; page: number; pageSize: number; locale: Locale },
  ) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(opts.unreadOnly ? { readAt: null } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...takeSkip(opts),
      }),
      this.prisma.notification.count({ where }),
    ]);

    // Resolve titles/bodies from templates (batched) in the requested locale.
    const codes = [...new Set(rows.map((r) => r.templateCode))];
    const companyId = getTenantContext()?.companyId;
    const [byCode, currency, timeZone] = await Promise.all([
      this.templatesFor(codes),
      getCompanyCurrency(this.prisma, companyId),
      notificationTimeZone(this.prisma, companyId),
    ]);

    const data = rows.map((r) => {
      const tpl = byCode.get(r.templateCode);
      const payload = (r.payload ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        templateCode: r.templateCode,
        title: resolveText(tpl?.subject, payload, opts.locale, r.templateCode, currency, timeZone),
        body: resolveText(tpl?.body, payload, opts.locale, '', currency, timeZone),
        payload: r.payload,
        channel: r.channel,
        read: r.readAt !== null,
        createdAt: r.createdAt,
      };
    });

    return paginate(data, total, opts);
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const result = await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform },
      update: { userId, platform: dto.platform },
    });
    this.logger.log(`[DeviceToken] registered for user ${userId} platform=${dto.platform}`);
    return result;
  }

  /**
   * Sign-out: this device stops receiving the user's pushes. Only the
   * caller's own registration is removed — a token another account holds is
   * left alone.
   */
  async unregisterDevice(userId: string, token: string): Promise<{ removed: number }> {
    const { count } = await this.prisma.deviceToken.deleteMany({ where: { token, userId } });
    return { removed: count };
  }

  /**
   * Admin manual broadcast. Channel determines the delivery path strictly:
   *
   * IN_APP          → create one Notification DB row per recipient. No FCM.
   * PUSH            → send FCM per recipient. No DB rows. Requires Firebase.
   * IN_APP_AND_PUSH → create DB rows AND send FCM. Requires Firebase.
   *                   One DB row per user regardless of how many devices they have.
   *
   * Paths are strictly separated — no silent fallback ever occurs.
   * Audit: every payload carries broadcastId, sentBy, broadcastAt,
   * targetType, and targetValue for traceability.
   */
  async broadcastNotification(
    adminId: string,
    dto: BroadcastNotificationDto,
  ): Promise<{
    broadcastId: string;
    channel: BroadcastChannel;
    recipientCount: number;
    // IN_APP + IN_APP_AND_PUSH
    notificationRecordsCreated?: number;
    failed?: number;
    // PUSH + IN_APP_AND_PUSH
    pushSent?: number;
    pushFailed?: number;
    noDeviceTokens?: number;
    failureHint?: string;
  }> {
    // Guard: PUSH and IN_APP_AND_PUSH require Firebase. Block before any DB writes
    // so the admin gets a clear error rather than silent non-delivery.
    const needsPush = dto.channel === BroadcastChannel.PUSH ||
                      dto.channel === BroadcastChannel.IN_APP_AND_PUSH;
    if (needsPush && !this.push.pushEnabled) {
      throw new BadRequestException(
        `${dto.channel} channel requires Firebase — not configured or the API was not ` +
        `restarted after adding FIREBASE_* credentials. Use IN_APP to skip push.`,
      );
    }

    const broadcastId = randomUUID();
    const userIds = await this.resolveRecipients(dto.target, dto.targetUserId, dto.targetRole);

    if (userIds.length === 0) {
      return { broadcastId, channel: dto.channel, recipientCount: 0 };
    }

    // Audit payload carried inside every Notification row / FCM data envelope.
    const auditPayload: Record<string, unknown> = {
      title_ar: dto.title_ar,
      title_en: dto.title_en,
      body_ar: dto.body_ar,
      body_en: dto.body_en,
      sentBy: adminId,
      broadcastAt: new Date().toISOString(),
      broadcastId,
      targetType: dto.target,
      targetValue: dto.targetUserId ?? dto.targetRole ?? dto.target,
      ...(dto.entityType ? { entityType: dto.entityType } : {}),
      ...(dto.entityId ? { entityId: dto.entityId } : {}),
    };

    // ── IN_APP path ───────────────────────────────────────────────────────────
    if (dto.channel === BroadcastChannel.IN_APP) {
      const tpl = await this.templateFor('admin_broadcast');
      if (!tpl) {
        throw new BadRequestException(
          'Template admin_broadcast not found in the database — restart the API to auto-create it.',
        );
      }

      const results = await Promise.allSettled(
        userIds.map((userId) =>
          this.prisma.notification.create({
            data: {
              userId,
              templateCode: 'admin_broadcast',
              payload: auditPayload as Prisma.InputJsonValue,
              channel: NotificationChannel.IN_APP,
              sentAt: new Date(),
            },
          }),
        ),
      );

      const notificationRecordsCreated = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed > 0) {
        (results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')).forEach(
          (r, i) => this.logger.warn(
            `Broadcast ${broadcastId} IN_APP[${i}] failed: ${(r.reason as Error).message}`,
          ),
        );
      }

      this.logger.log(
        `Broadcast ${broadcastId} by ${adminId}: IN_APP target=${dto.target} ` +
        `recipients=${userIds.length} created=${notificationRecordsCreated} failed=${failed}`,
      );

      return {
        broadcastId,
        channel: BroadcastChannel.IN_APP,
        recipientCount: userIds.length,
        notificationRecordsCreated,
        failed,
        ...(failed > 0 ? { failureHint: 'database_error' } : {}),
      };
    }

    // ── Shared push helper ────────────────────────────────────────────────────
    // Used by PUSH and IN_APP_AND_PUSH paths.
    const buildPushResults = async (
      ids: string[],
      notifIdByUser: Map<string, string>,
    ) => {
      // IDs from resolveRecipients which is now company-scoped (V-19..V-21 fixed).
      const usersWithLocale = await scopedUserFindMany(
        this.prisma,
        { id: { in: ids } },
        { id: true, locale: true },
      );
      const localeMap = new Map(
        usersWithLocale.map((u) => [u.id, pickLocale(u.locale ?? 'ar')]),
      );

      return Promise.allSettled(
        ids.map((userId) => {
          const locale = localeMap.get(userId) ?? 'ar';
          const fcmData: Record<string, string> = {
            broadcastId,
            templateCode: 'admin_broadcast',
          };
          const notifId = notifIdByUser.get(userId);
          if (notifId)       fcmData['notificationId'] = notifId;
          if (dto.entityType) fcmData['entityType']    = dto.entityType;
          if (dto.entityId)   fcmData['entityId']      = dto.entityId;
          return this.push.sendToUser(userId, {
            title: locale === 'en' ? dto.title_en : dto.title_ar,
            body:  locale === 'en' ? dto.body_en  : dto.body_ar,
            data:  fcmData,
          });
        }),
      );
    };

    const tallyCounts = (
      results: PromiseSettledResult<Awaited<ReturnType<PushService['sendToUser']>>>[],
      label: string,
    ) => {
      let pushSent = 0, pushFailed = 0, noDeviceTokens = 0;
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const res = r.value;
          if (!res.enabled)                        pushFailed++;
          else if (res.sent === 0 && res.failed === 0) noDeviceTokens++;
          else { pushSent += res.sent; pushFailed += res.failed; }
        } else {
          pushFailed++;
          this.logger.warn(`Broadcast ${broadcastId} ${label} PUSH: ${(r.reason as Error).message}`);
        }
      }
      return { pushSent, pushFailed, noDeviceTokens };
    };

    // ── PUSH path ─────────────────────────────────────────────────────────────
    // Firebase confirmed enabled. No Notification DB rows — delivery only.
    if (dto.channel === BroadcastChannel.PUSH) {
      const rawResults = await buildPushResults(userIds, new Map());
      const { pushSent, pushFailed, noDeviceTokens } = tallyCounts(rawResults, 'PUSH');

      this.logger.log(
        `Broadcast ${broadcastId} by ${adminId}: PUSH target=${dto.target} ` +
        `recipients=${userIds.length} pushSent=${pushSent} pushFailed=${pushFailed} noDeviceTokens=${noDeviceTokens}`,
      );

      const failureHint =
        noDeviceTokens === userIds.length ? 'no_device_tokens' :
        pushFailed > 0                    ? 'push_failed'       : undefined;

      return {
        broadcastId,
        channel: BroadcastChannel.PUSH,
        recipientCount: userIds.length,
        pushSent,
        pushFailed,
        noDeviceTokens,
        ...(failureHint ? { failureHint } : {}),
      };
    }

    // ── IN_APP_AND_PUSH path ──────────────────────────────────────────────────
    // Phase 1: create one Notification DB row per recipient (channel=IN_APP).
    const tpl2 = await this.templateFor('admin_broadcast');
    if (!tpl2) {
      throw new BadRequestException(
        'Template admin_broadcast not found — restart the API to auto-create it.',
      );
    }

    const dbResults2 = await Promise.allSettled(
      userIds.map((userId) =>
        this.prisma.notification.create({
          data: {
            userId,
            templateCode: 'admin_broadcast',
            payload: auditPayload as Prisma.InputJsonValue,
            channel: NotificationChannel.IN_APP,
            sentAt: new Date(),
          },
        }),
      ),
    );

    let notificationRecordsCreated2 = 0;
    let dbFailed = 0;
    const notifIdByUser = new Map<string, string>();

    for (const [i, r] of dbResults2.entries()) {
      if (r.status === 'fulfilled') {
        notificationRecordsCreated2++;
        notifIdByUser.set(userIds[i]!, r.value.id);
      } else {
        dbFailed++;
        this.logger.warn(
          `Broadcast ${broadcastId} IN_APP+PUSH DB[${i}]: ${(r.reason as Error).message}`,
        );
      }
    }

    // Phase 2: send FCM (best-effort, including notificationId for deep-link).
    const rawResults2 = await buildPushResults(userIds, notifIdByUser);
    const { pushSent: ps2, pushFailed: pf2, noDeviceTokens: nd2 } =
      tallyCounts(rawResults2, 'IN_APP+PUSH');

    this.logger.log(
      `Broadcast ${broadcastId} by ${adminId}: IN_APP+PUSH target=${dto.target} ` +
      `recipients=${userIds.length} dbCreated=${notificationRecordsCreated2} dbFailed=${dbFailed} ` +
      `pushSent=${ps2} pushFailed=${pf2} noDeviceTokens=${nd2}`,
    );

    const failureHint2 =
      nd2 === userIds.length && ps2 === 0 ? 'no_device_tokens' :
      pf2 > 0 || dbFailed > 0            ? 'push_failed'       : undefined;

    return {
      broadcastId,
      channel: BroadcastChannel.IN_APP_AND_PUSH,
      recipientCount: userIds.length,
      notificationRecordsCreated: notificationRecordsCreated2,
      failed: dbFailed,
      pushSent: ps2,
      pushFailed: pf2,
      noDeviceTokens: nd2,
      ...(failureHint2 ? { failureHint: failureHint2 } : {}),
    };
  }

  /**
   * Dry-run preview — resolves recipient count without sending anything.
   * When channel=PUSH also counts registered device tokens so the admin
   * can see how many recipients have no device before sending.
   */
  async previewBroadcast(dto: BroadcastPreviewDto): Promise<{
    recipientCount: number;
    pushEnabled: boolean;
    estimatedDeviceCount?: number;
    usersWithoutDevices?: number;
  }> {
    const userIds = await this.resolveRecipients(dto.target, dto.targetUserId, dto.targetRole);
    const base = { recipientCount: userIds.length, pushEnabled: this.push.pushEnabled };

    const needsDeviceInfo = dto.channel === BroadcastChannel.PUSH ||
                            dto.channel === BroadcastChannel.IN_APP_AND_PUSH;
    if (!needsDeviceInfo || userIds.length === 0) {
      return base;
    }

    // Count device tokens so the admin can see device coverage before sending.
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true },
    });
    const usersWithDevices = new Set(tokens.map((t) => t.userId));
    return {
      ...base,
      estimatedDeviceCount: tokens.length,
      usersWithoutDevices: userIds.filter((id) => !usersWithDevices.has(id)).length,
    };
  }

  private async resolveRecipients(
    target: BroadcastTarget,
    targetUserId?: string,
    targetRole?: UserRole,
  ): Promise<string[]> {
    switch (target) {
      case BroadcastTarget.USER:
        if (!targetUserId) throw new BadRequestException('targetUserId required when target is USER');
        // V-19: validate targetUserId belongs to the current tenant before any action.
        // Throws 404 for cross-tenant or missing user (no existence leak).
        await resolveTenantUser(this.prisma, targetUserId, { id: true });
        return [targetUserId];
      case BroadcastTarget.ROLE:
        if (!targetRole) throw new BadRequestException('targetRole required when target is ROLE');
        return this.activeUserIdsByRole([targetRole]);
      case BroadcastTarget.ALL_CUSTOMERS:
        return this.activeUserIdsByRole([UserRole.CUSTOMER]);
      case BroadcastTarget.ALL_BROKERS:
        return this.activeUserIdsByRole([UserRole.BROKER]);
      case BroadcastTarget.ALL_SALES:
        return this.activeUserIdsByRole([UserRole.SALES]);
      case BroadcastTarget.ALL_MAINTENANCE_SUPERVISORS:
        return this.activeUserIdsByRole([UserRole.MAINTENANCE_SUPERVISOR]);
      case BroadcastTarget.ALL_ACTIVE: {
        const users = await scopedUserFindMany(this.prisma, { active: true }, { id: true });
        return users.map((u) => u.id);
      }
      default:
        throw new BadRequestException('Invalid broadcast target');
    }
  }

  private async activeUserIdsByRole(roles: UserRole[]): Promise<string[]> {
    const users = await scopedUserFindMany(
      this.prisma,
      { role: { in: roles }, active: true },
      { id: true },
    );
    return users.map((u) => u.id);
  }
}

@ApiTags('notifications')
@Controller()
class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('notifications:templates:manage')
  @GrantedBy('notifications:templates:manage')
  @Get('notification-templates')
  listTemplates() {
    return this.svc.listTemplates();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('notifications:templates:manage')
  @GrantedBy('notifications:templates:manage')
  @Post('notification-templates')
  upsertTemplate(@Body() dto: UpsertTemplateDto) {
    return this.svc.upsertTemplate(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('notifications:send')
  @GrantedBy('notifications:send')
  @Post('notifications/send')
  send(@Body() dto: SendNotificationDto) {
    return this.svc.send(dto);
  }

  /**
   * Dry-run preview: resolves recipient count without sending any notifications.
   * Must be declared before /broadcast to avoid route collision.
   */
  @Roles(UserRole.ADMIN)
  @Permissions('notifications:send')
  @GrantedBy('notifications:send')
  @Post('notifications/broadcast/preview')
  previewBroadcast(@Body() dto: BroadcastPreviewDto) {
    return this.svc.previewBroadcast(dto);
  }

  /**
   * Admin manual broadcast — sends to a resolved audience and returns a
   * delivery summary. Requires notifications:send permission.
   */
  @Roles(UserRole.ADMIN)
  @Permissions('notifications:send')
  @GrantedBy('notifications:send')
  @Post('notifications/broadcast')
  broadcast(@CurrentUser() user: AuthUser, @Body() dto: BroadcastNotificationDto) {
    return this.svc.broadcastNotification(user.sub, dto);
  }

  @Get('me/notifications')
  myList(
    @CurrentUser() user: AuthUser,
    @Headers('accept-language') acceptLanguage?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.listMine(user.sub, {
      unreadOnly: unreadOnly === '1',
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      locale: pickLocale(acceptLanguage),
    });
  }

  @Get('me/notifications/unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.svc.unreadCount(user.sub);
  }

  @Patch('me/notifications/:id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.markRead(user.sub, id);
  }

  @Patch('me/notifications/read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.svc.markAllRead(user.sub);
  }

  @Post('me/devices')
  registerDevice(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.svc.registerDevice(user.sub, dto);
  }

  // Called by the apps on sign-out, before the session is revoked.
  @Post('me/devices/unregister')
  @HttpCode(HttpStatus.OK)
  unregisterDevice(@CurrentUser() user: AuthUser, @Body() dto: UnregisterDeviceDto) {
    return this.svc.unregisterDevice(user.sub, dto.token);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService, FirebaseService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
