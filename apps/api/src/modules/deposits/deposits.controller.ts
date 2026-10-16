import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DepositReviewStatus, UserRole, type Prisma } from '@prisma/client';
import { OwnershipService } from '../../common/ownership/ownership.service';
import { DocumentsService } from '../documents/documents.module';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions, PermissionsStrict } from '../../common/decorators/permissions.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { DepositsService } from './deposits.service';
import {
  ApproveDepositDto,
  AttachReceiptDto,
  CustomerPresignDto,
  CustomerResubmitProofDto,
  CustomerSubmitProofDto,
  ListDepositsQueryDto,
  RecordDepositDto,
  RejectDepositDto,
  ReverseDepositDto,
  VerifyDepositDto,
} from './deposits.dto';

/**
 * A deposit row as its customer sees it: no staff names, no internal
 * correction reasons or ids, no other party's name, no receipt URL (files go
 * through the signed-download endpoint).
 */
function customerDepositView(row: {
  id: string; type: string; amount: unknown; paidAt: Date; verified: boolean;
  reviewStatus: string; rejectionReason: string | null; reviewedAt: Date | null; paymentMethod: string | null;
  createdAt: Date;
  contract: { id: string; contractNumber: string | null; unit: { id: string; code: string } | null } | null;
  installment: { id: string; dueDate: Date; amount: unknown; type: string; status: string; paidAt: Date | null } | null;
  reservation: { id: string; reservationNumber: string | null; unit: { id: string; code: string } | null } | null;
  proofDocument: unknown;
}) {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    verified: row.verified,
    reviewStatus: row.reviewStatus,
    rejectionReason: row.rejectionReason,
    reviewedAt: row.reviewedAt,
    paymentMethod: row.paymentMethod,
    receiptUrl: null,
    contract: row.contract
      ? { id: row.contract.id, contractNumber: row.contract.contractNumber, unit: row.contract.unit }
      : null,
    installment: row.installment
      ? {
          id: row.installment.id,
          dueDate: row.installment.dueDate,
          amount: row.installment.amount,
          type: row.installment.type,
          status: row.installment.status,
          paidAt: row.installment.paidAt,
        }
      : null,
    reservation: row.reservation
      ? { id: row.reservation.id, reservationNumber: row.reservation.reservationNumber, unit: row.reservation.unit }
      : null,
    proofDocument: row.proofDocument,
  };
}

@ApiTags('deposits')
@Controller()
export class DepositsController {
  constructor(
    private readonly svc: DepositsService,
    private readonly documents: DocumentsService,
    private readonly ownership: OwnershipService,
  ) {}

  // Admin-only recording per scope §5
  @Roles(UserRole.ADMIN)
  @Permissions('deposits:register')
  @Post('deposits')
  record(@CurrentUser() user: AuthUser, @Body() dto: RecordDepositDto) {
    return this.svc.record(dto, user.sub);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('deposits:read')
  @Get('deposits')
  list(@Query() q: ListDepositsQueryDto) {
    return this.svc.list({
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
      contractId: q.contractId,
      customerId: q.customerId,
      type: q.type,
      projectId: q.projectId,
      unitId: q.unitId,
      q: q.q,
      ref: q.ref,
      paidAtFrom: q.paidAtFrom,
      paidAtTo: q.paidAtTo,
      dueDateFrom: q.dueDateFrom,
      dueDateTo: q.dueDateTo,
      verified: q.verified,
      reviewStatus: q.reviewStatus,
    });
  }

  // ── P11 — Admin payment-proof review queue ─────────────────────────────
  // Convenience endpoint that defaults to PENDING_REVIEW so the queue page
  // doesn't need to remember the query param. Falls through to the full
  // list() method otherwise.
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('deposits:read')
  @Get('deposits/review-queue')
  reviewQueue(@Query() q: ListDepositsQueryDto) {
    return this.svc.list({
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
      contractId: q.contractId,
      customerId: q.customerId,
      type: q.type,
      projectId: q.projectId,
      unitId: q.unitId,
      q: q.q,
      ref: q.ref,
      paidAtFrom: q.paidAtFrom,
      paidAtTo: q.paidAtTo,
      dueDateFrom: q.dueDateFrom,
      dueDateTo: q.dueDateTo,
      verified: q.verified,
      reviewStatus: q.reviewStatus ?? DepositReviewStatus.PENDING_REVIEW,
    });
  }

  // Single deposit detail (with contract/reservation/installment context).
  // Declared before the parametric write routes; ADMIN read.
  @Roles(UserRole.ADMIN)
  @Permissions('deposits:read')
  @Get('deposits/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  // Attach/replace the payment proof after creation — links a RECEIPT document
  // and mirrors the legacy receiptUrl. Uses the same write permission as record.
  @Roles(UserRole.ADMIN)
  @Permissions('deposits:register')
  @Post('deposits/:id/receipt')
  attachReceipt(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachReceiptDto,
  ) {
    return this.svc.attachReceipt(id, dto, user.sub);
  }

  // Strict: even an ADMIN must hold deposits:verify explicitly. Segregation
  // of duties — financial verification is a two-person-rule action.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('deposits:verify')
  @Patch('deposits/:id/verify')
  verify(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyDepositDto,
  ) {
    return this.svc.verify(id, dto, actor);
  }

  // §6.2 — Admin manually reverses an APPROVED deposit. Writes PaymentCorrection
  // (REVERSAL), reopens installment as PENDING. Reason is MANDATORY.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('deposits:reverse')
  @Post('deposits/:id/reverse')
  reverseDeposit(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseDepositDto,
  ) {
    return this.svc.reverseDeposit(id, dto, actor);
  }

  // ── P11 — Admin approve / reject payment proof ──────────────────────────
  // Approve mirrors verified=true semantics (idempotent) and marks the
  // installment PAID. Reject requires a non-empty reason and notifies the
  // customer with only a short snippet (no internal notes).
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('deposits:verify')
  @Post('deposits/:id/approve')
  approveProof(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveDepositDto,
  ) {
    return this.svc.approveProof(id, user, dto);
  }

  @Roles(UserRole.ADMIN)
  @PermissionsStrict('deposits:verify')
  @Post('deposits/:id/reject')
  rejectProof(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDepositDto,
  ) {
    return this.svc.rejectProof(id, user, dto);
  }

  // P11.6.1 — staff/admin signed download for a deposit's payment proof.
  // Mirrors the review-queue gate (ADMIN + SALES_MANAGER, deposits:read) so a
  // read-only reviewer can OPEN the proof without holding deposits:verify
  // (which is reserved for approve/reject). Returns a short-lived signed URL
  // only — never a permanent URL or storage key.
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('deposits:read')
  @Get('deposits/:id/proof/download')
  proofDownload(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getProofDownloadLink(id);
  }

  // Customer read-only view — intentionally NOT permission-gated.
  //
  // SECURITY: the underlying Deposit row carries a permanent `receiptUrl`
  // (raw R2 public URL). Same posture as `/me/contracts` — customers
  // reach the receipt ONLY through the signed-download endpoint
  // (`GET /v1/me/documents/:id/download`). Admin views go through
  // `@Get('deposits')` / `@Get('deposits/:id')` above, not this method.
  //
  // P11 — reviewStatus + rejectionReason + paymentMethod ARE exposed (they
  // are not URLs and the customer needs them to drive the UI). receiptUrl
  // remains redacted to null.
  @RequireCapability('feature.customerApp')
  @Roles(UserRole.CUSTOMER)
  @Get('me/deposits')
  async myDeposits(@CurrentUser() user: AuthUser) {
    // Contract payments follow the transfer split (each owner sees the ones
    // made while the contract was theirs); booking payments bind through the
    // reservation, as before.
    const ownerWhere: Prisma.DepositWhereInput = {
      OR: [
        await this.ownership.depositOwnershipWhere(user.sub),
        { contractId: null, reservation: { clientId: user.sub } },
        { contractId: null, reservation: { lead: { is: { clientId: user.sub } } } },
      ],
    };
    const result = await this.svc.list({ page: 1, pageSize: 100, ownerWhere });
    return { ...result, data: result.data.map(customerDepositView) };
  }

  // ── P11 — Customer submits / resubmits a payment proof ─────────────────
  @RequireCapability('feature.customerApp')
  @Roles(UserRole.CUSTOMER)
  @Post('me/deposits')
  submitProof(
    @CurrentUser() user: AuthUser,
    @Body() dto: CustomerSubmitProofDto,
  ) {
    return this.svc.submitProofForCustomer(user.sub, dto);
  }

  @RequireCapability('feature.customerApp')
  @Roles(UserRole.CUSTOMER)
  @Post('me/deposits/:id/resubmit')
  resubmitProof(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerResubmitProofDto,
  ) {
    return this.svc.resubmitProofForCustomer(user.sub, id, dto);
  }

  // Customer-scoped presign for payment-proof uploads. Folder is forced to
  // 'receipts' server-side; the standard MIME + size whitelist applies.
  // Reuses the existing DocumentsService.presign which already validates.
  @RequireCapability('feature.customerApp')
  @Roles(UserRole.CUSTOMER)
  @Post('me/payments/presign')
  customerPresign(@Body() dto: CustomerPresignDto) {
    return this.documents.presign(
      { contentType: dto.contentType, sizeBytes: dto.sizeBytes, fileName: dto.fileName },
      'receipts',
    );
  }

  @Roles(UserRole.ADMIN)
  @Permissions('deposits:delete')
  // Was `@Delete(':id')` / `@Post(':id/restore')` on this prefix-less
  // controller, i.e. DELETE /v1/:id — nothing called it under that path.
  @Delete('deposits/:id')
  softDelete(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.softDelete(id, actor);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('deposits:delete')
  @Post('deposits/:id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.restore(id);
  }
}
