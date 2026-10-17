import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { reportFailure } from '../../common/observability/report-failure';
import { companyTimeZone, startOfLocalToday } from '../../common/time/company-timezone';
import { NotificationsService } from '../notifications/notifications.module';
import { startUnitWarranties } from './unit-warranties';

/** What is checked when a unit is handed over. */
export const HANDOVER_CHECKLIST_KEYS = ['keys', 'meters', 'inspection', 'snags', 'documents'] as const;

export class HandoverChecklistItemDto {
  @IsIn(HANDOVER_CHECKLIST_KEYS as unknown as string[]) key!: string;
  @IsBoolean() done!: boolean;
}

export class RecordHandoverDto {
  /** The day the buyer received the unit (not in the future). */
  @IsDateString() handedOverAt!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(HANDOVER_CHECKLIST_KEYS.length)
  @ValidateNested({ each: true })
  @Type(() => HandoverChecklistItemDto)
  checklist?: HandoverChecklistItemDto[];

  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

/**
 * The unit handover (decided 2026-10-16): the buyer receives the unit on a
 * date, with a checklist. The unit's warranties start then — not at the
 * contract's creation — and the customer's maintenance requests open from
 * then on. One per contract.
 */
@Injectable()
export class UnitHandoverService {
  private readonly logger = new Logger(UnitHandoverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async record(contractId: string, dto: RecordHandoverDto, actorId: string) {
    const companyId = getRequiredCompanyId();
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, companyId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        signedAt: true,
        unitId: true,
        customerId: true,
        contractNumber: true,
        unit: { select: { code: true } },
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.deletedAt || contract.status !== ContractStatus.ACTIVE || !contract.signedAt) {
      throw new BadRequestException('لا يُسلَّم إلا عقد موقَّع وساري');
    }
    const handedOverAt = new Date(`${dto.handedOverAt.slice(0, 10)}T00:00:00Z`);
    const tomorrow = new Date(startOfLocalToday(await companyTimeZone(this.prisma, companyId)).getTime() + 86_400_000);
    if (handedOverAt >= tomorrow) throw new BadRequestException('تاريخ التسليم لا يمكن أن يكون في المستقبل');
    if (handedOverAt < new Date(`${contract.signedAt.toISOString().slice(0, 10)}T00:00:00Z`)) {
      throw new BadRequestException('تاريخ التسليم قبل توقيع العقد');
    }
    const checklist = HANDOVER_CHECKLIST_KEYS.map((key) => ({
      key,
      done: dto.checklist?.find((c) => c.key === key)?.done ?? false,
    }));

    let handover;
    try {
      handover = await this.prisma.$transaction(async (tx) => {
        const row = await tx.unitHandover.create({
          data: {
            contractId,
            unitId: contract.unitId,
            handedOverAt,
            checklist: checklist as Prisma.InputJsonValue,
            notes: dto.notes?.trim() || null,
            performedById: actorId,
            companyId,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'contract.unit-handed-over',
            entityType: 'Contract',
            entityId: contractId,
            after: { unitId: contract.unitId, handedOverAt: handedOverAt.toISOString(), checklist },
            companyId,
          },
        });
        return row;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('سُجِّل تسليم هذه الوحدة بالفعل');
      }
      throw e;
    }

    // The warranties run from the handover. Idempotent: only items not yet started.
    await startUnitWarranties(this.prisma, contract.unitId, handedOverAt);
    try {
      await this.notifications.sendToUser(
        contract.customerId,
        'unit_handed_over',
        {
          contractId,
          contractNumber: contract.contractNumber ?? '',
          unitCode: contract.unit?.code ?? '',
          handedOverAt: handedOverAt.toISOString().slice(0, 10),
          entityType: 'contract',
          entityId: contractId,
        },
        { except: actorId },
      );
    } catch (err) {
      reportFailure(this.logger, 'notifications', `contract ${contractId} handover notice failed`, err);
    }
    return handover;
  }
}
