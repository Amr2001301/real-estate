import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReservationStatus, type SignatureRequest } from '@prisma/client';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { assertSalesRecordInScope } from '../../common/utils/sales-scope';
import { imageExtension, imageSize } from '../../common/utils/report-brand';
import { SmsService } from '../auth/sms.service';
import type { CreateSignatureRequestDto, SignDocumentDto } from './dto/e-sign.dto';

/** How long a signing link stays open. */
export const LINK_TTL_HOURS = 72;
const OTP_TTL_MIN = 10;
const OTP_RESEND_SEC = 60;
const OTP_MAX_ATTEMPTS = 5;
// Under the API's 100 KB JSON body limit.
const SNAPSHOT_MAX_BYTES = 80_000;
const SIGNATURE_MAX_BYTES = 70_000;

const sha256 = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');

/** A stable JSON form (sorted keys) so the same content always hashes alike. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** "+201001234567" → "+20 ••• ••• 4567" — enough to recognise, not to read. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${phone.startsWith('+') ? '+' : ''}${digits.slice(0, 2)} ••• ••• ${digits.slice(-4)}`;
}

/** A booking can be signed while it is live. */
const SIGNABLE: ReservationStatus[] = [ReservationStatus.PENDING, ReservationStatus.APPROVED];

type RequestState = 'PENDING' | 'SIGNED' | 'CANCELLED' | 'EXPIRED';

/**
 * Electronic signature by the customer (P5), booking forms first. The staff
 * send a link; the customer opens it on the company's website, reads the
 * document as it stood when sent, proves the phone on file with a code and
 * signs by hand. Only the link's hash is stored, a link works for one
 * signature, and a change to the booking afterwards shows the signature is
 * on an older version.
 */
@Injectable()
export class ESignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly config: ConfigService,
  ) {}

  // ── Staff ─────────────────────────────────────────────────────────────────

  /** What a signature on a booking vouches for: who, which unit, how much. */
  private async reservationSource(reservationId: string) {
    const companyId = getRequiredCompanyId();
    const r = await this.prisma.reservation.findFirst({
      where: { id: reservationId, companyId, deletedAt: null },
      select: {
        id: true,
        status: true,
        salesId: true,
        unitId: true,
        clientId: true,
        bookingAmount: true,
        selectedDurationMonths: true,
        snapshotDownPaymentAmount: true,
        snapshotFinancedAmount: true,
        snapshotMonthlyInstallment: true,
        snapshotTotalPayable: true,
        client: { select: { fullName: true, phone: true, nationalId: true } },
        lead: { select: { fullName: true, phone: true } },
      },
    });
    if (!r) throw new NotFoundException('الحجز غير موجود');
    const fingerprint = sha256(
      canonicalJson({
        unitId: r.unitId,
        clientId: r.clientId,
        name: r.client?.fullName ?? r.lead?.fullName ?? null,
        nationalId: r.client?.nationalId ?? null,
        bookingAmount: r.bookingAmount.toString(),
        months: r.selectedDurationMonths,
        downPayment: r.snapshotDownPaymentAmount?.toString() ?? null,
        financed: r.snapshotFinancedAmount?.toString() ?? null,
        installment: r.snapshotMonthlyInstallment?.toString() ?? null,
        total: r.snapshotTotalPayable?.toString() ?? null,
      }),
    );
    return { reservation: r, phone: r.client?.phone ?? r.lead?.phone ?? null, fingerprint };
  }

  /** The company's website: its primary verified domain, else the platform's. */
  private async siteUrl(companyId: string): Promise<string> {
    const domain = await this.prisma.companyDomain.findFirst({
      where: { companyId, isPrimary: true, verifiedAt: { not: null } },
      select: { hostname: true },
    });
    if (domain) return `https://${domain.hostname}`;
    return (this.config.get<string>('PUBLIC_WEB_URL') ?? '').replace(/\/$/, '');
  }

  /** A new signing link for a booking; an earlier open one stops working. */
  async createForReservation(reservationId: string, dto: CreateSignatureRequestDto, user: AuthUser) {
    const companyId = getRequiredCompanyId();
    const { reservation, phone, fingerprint } = await this.reservationSource(reservationId);
    await assertSalesRecordInScope(this.prisma, user, reservation.salesId, { mode: 'forbidden' });
    if (!SIGNABLE.includes(reservation.status)) {
      throw new ConflictException('لا يمكن طلب توقيع على حجز منتهٍ');
    }
    if (!phone) throw new BadRequestException('لا يوجد رقم هاتف للعميل — أضفه أولاً ليصله كود التأكيد');

    const snapshotJson = canonicalJson(dto.snapshot);
    if (Buffer.byteLength(snapshotJson) > SNAPSHOT_MAX_BYTES) throw new BadRequestException('المستند أكبر من المسموح');

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + LINK_TTL_HOURS * 3600_000);
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.signatureRequest.updateMany({
        where: { companyId, documentType: 'RESERVATION', documentId: reservationId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      return tx.signatureRequest.create({
        data: {
          companyId,
          documentType: 'RESERVATION',
          documentId: reservationId,
          tokenHash: sha256(token),
          expiresAt,
          phone,
          snapshot: dto.snapshot as object,
          snapshotHash: sha256(snapshotJson),
          sourceHash: fingerprint,
          createdById: user.sub,
        },
      });
    });
    return {
      ...this.present(created, fingerprint),
      // The link is only ever shown here: only its hash is kept.
      url: `${await this.siteUrl(companyId)}/sign/${token}`,
    };
  }

  private state(r: SignatureRequest): RequestState {
    if (r.status === 'PENDING' && r.expiresAt.getTime() <= Date.now()) return 'EXPIRED';
    return r.status as RequestState;
  }

  private present(r: SignatureRequest, fingerprint: string) {
    const state = this.state(r);
    return {
      id: r.id,
      state,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      phone: maskPhone(r.phone),
      snapshotHash: r.snapshotHash,
      signerName: r.signerName,
      signedAt: r.signedAt,
      // The booking changed after the customer signed: the signature is on an older version.
      outdated: state === 'SIGNED' && r.sourceHash !== fingerprint,
      signature:
        state === 'SIGNED' && r.signatureImage
          ? `data:image/png;base64,${Buffer.from(r.signatureImage).toString('base64')}`
          : null,
    };
  }

  /** A booking's signing requests, newest first, the signature image included. */
  async listForReservation(reservationId: string, user: AuthUser) {
    const companyId = getRequiredCompanyId();
    const { reservation, fingerprint } = await this.reservationSource(reservationId);
    await assertSalesRecordInScope(this.prisma, user, reservation.salesId, { mode: 'forbidden' });
    const rows = await this.prisma.signatureRequest.findMany({
      where: { companyId, documentType: 'RESERVATION', documentId: reservationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((r) => this.present(r, fingerprint));
  }

  async cancel(id: string, user: AuthUser) {
    const companyId = getRequiredCompanyId();
    const r = await this.prisma.signatureRequest.findFirst({ where: { id, companyId } });
    if (!r) throw new NotFoundException('طلب التوقيع غير موجود');
    const { reservation } = await this.reservationSource(r.documentId);
    await assertSalesRecordInScope(this.prisma, user, reservation.salesId, { mode: 'forbidden' });
    if (r.status !== 'PENDING') throw new ConflictException('لا يمكن إلغاء طلب تم توقيعه أو إلغاؤه');
    await this.prisma.signatureRequest.updateMany({ where: { id, companyId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    return { ok: true };
  }

  // ── Customer (the link) ───────────────────────────────────────────────────

  /** The request a link opens, in the company the website belongs to. */
  private async byToken(token: string) {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new NotFoundException('الرابط غير صالح');
    const companyId = getRequiredCompanyId();
    const r = await this.prisma.signatureRequest.findFirst({ where: { companyId, tokenHash: sha256(token) } });
    if (!r) throw new NotFoundException('الرابط غير صالح');
    return r;
  }

  private assertOpen(r: SignatureRequest) {
    const state = this.state(r);
    if (state === 'SIGNED') throw new ConflictException('تم توقيع هذا المستند بالفعل');
    if (state === 'CANCELLED') throw new GoneException('تم إلغاء هذا الرابط — اطلب رابطاً جديداً من الشركة');
    if (state === 'EXPIRED') throw new GoneException('انتهت صلاحية هذا الرابط — اطلب رابطاً جديداً من الشركة');
  }

  /** What the customer sees: the document as sent, and where the code goes. */
  async view(token: string) {
    const r = await this.byToken(token);
    return {
      state: this.state(r),
      expiresAt: r.expiresAt,
      phone: maskPhone(r.phone),
      snapshot: r.snapshot,
      snapshotHash: r.snapshotHash,
      signerName: r.signerName,
      signedAt: r.signedAt,
    };
  }

  /** A code to the phone on file — never to a number the visitor types. */
  async sendCode(token: string) {
    const r = await this.byToken(token);
    this.assertOpen(r);
    if (r.otpSentAt && Date.now() - r.otpSentAt.getTime() < OTP_RESEND_SEC * 1000) {
      throw new BadRequestException('انتظر دقيقة قبل طلب كود جديد');
    }
    const code = String(randomInt(100_000, 999_999));
    await this.prisma.signatureRequest.updateMany({
      where: { id: r.id, companyId: r.companyId },
      data: {
        otpHash: sha256(code),
        otpSentAt: new Date(),
        otpExpiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000),
        otpAttempts: 0,
      },
    });
    await this.sms.sendOtp(r.phone, code);
    return { ok: true, phone: maskPhone(r.phone) };
  }

  /** The code proves the phone; the drawn signature and typed name sign. */
  async sign(token: string, dto: SignDocumentDto, evidence: { ip: string | null; userAgent: string | null }) {
    const r = await this.byToken(token);
    this.assertOpen(r);
    if (!r.otpHash || !r.otpExpiresAt || r.otpExpiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('اطلب كود التأكيد أولاً');
    }
    if (r.otpAttempts >= OTP_MAX_ATTEMPTS) throw new ForbiddenException('محاولات كثيرة — اطلب كوداً جديداً');
    const ok = timingSafeEqual(Buffer.from(sha256(dto.code)), Buffer.from(r.otpHash));
    if (!ok) {
      await this.prisma.signatureRequest.updateMany({
        where: { id: r.id, companyId: r.companyId },
        data: { otpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('الكود غير صحيح');
    }

    const png = Buffer.from(dto.signature.slice(dto.signature.indexOf(',') + 1), 'base64');
    const size = imageSize(png);
    if (imageExtension(png) !== 'png' || !size || png.length > SIGNATURE_MAX_BYTES || size.width > 4000 || size.height > 4000) {
      throw new BadRequestException('التوقيع غير صالح');
    }

    // One signature per link, even when two submissions race.
    const signed = await this.prisma.signatureRequest.updateMany({
      where: { id: r.id, companyId: r.companyId, status: 'PENDING', expiresAt: { gt: new Date() } },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        signerName: dto.name,
        signatureImage: png,
        signerIp: evidence.ip?.slice(0, 64) ?? null,
        signerUserAgent: evidence.userAgent?.slice(0, 300) ?? null,
        otpHash: null,
      },
    });
    if (signed.count !== 1) throw new ConflictException('تم توقيع هذا المستند بالفعل');
    return { ok: true, signedAt: new Date(), snapshotHash: r.snapshotHash };
  }
}
