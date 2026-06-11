import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  DocumentCategory,
  DocumentOwnerType,
  DocumentVisibility,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { MediaModule } from '../media/media.module';
import { R2Service } from '../media/r2.service';

// ── URL safety ────────────────────────────────────────────────────────────

/**
 * Reject obviously unsafe URLs before they hit the database. We only
 * accept http(s) absolute URLs (S3/R2/CDN) and signed presigned URLs from
 * the existing presign endpoint. Anything else (javascript:, file:, data:,
 * arbitrary local paths) is refused.
 *
 * `allowedLocalBase` is the configured object-storage public base
 * (R2Service.publicBaseUrl). When set, a localhost URL is permitted ONLY if
 * it lives under that exact base. This lets our own presigned-origin URLs
 * round-trip through the signed-download path in local dev (where the
 * storage base is http://localhost:9000/…) while still rejecting arbitrary
 * localhost/SSRF targets.
 */
function assertSafeUrl(value: unknown, allowedLocalBase = ''): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BadRequestException('fileUrl is required');
  }
  const trimmed = value.trim();
  if (trimmed.length > 2048) {
    throw new BadRequestException('fileUrl is too long');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException('fileUrl must be an absolute http(s) URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException(
      `fileUrl scheme "${parsed.protocol}" is not allowed`,
    );
  }
  // Reject anything that resolves to localhost — admin-uploaded docs should
  // live on a public/CDN URL. Exception: our own configured object storage,
  // which is localhost in local dev (MinIO). That carve-out is matched by an
  // exact base-prefix check, not a bare host check.
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '0.0.0.0' || host === '127.0.0.1') {
    if (allowedLocalBase && trimmed.startsWith(allowedLocalBase)) return trimmed;
    throw new BadRequestException('fileUrl must not point at localhost');
  }
  return trimmed;
}

// ── DTOs ──────────────────────────────────────────────────────────────────

// ── Upload constraints ───────────────────────────────────────────────────

/**
 * MIME types accepted by the documents presign endpoint. Anything not in
 * this set is rejected at the API layer BEFORE we mint a presigned URL,
 * so executables / HTML / scripts never get an upload slot. The client-side
 * `accept` attribute is advisory; this is the real gate.
 */
const ALLOWED_DOCUMENT_MIME_TYPES = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);

const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MiB — chosen to fit ~95% of admin-uploaded PDFs/contracts.

class DocumentsPresignDto {
  /** MIME type the client intends to upload (validated against the whitelist). */
  @IsString() @MaxLength(120)
  contentType!: string;

  /** Size in bytes the client claims (validated against MAX_DOCUMENT_SIZE_BYTES). */
  @Type(() => Number) @IsInt() @Min(1)
  sizeBytes!: number;

  /** Original file name, for picking the right extension on the key. */
  @IsOptional() @IsString() @MaxLength(255)
  fileName?: string;
}

class DocumentsQueryDto {
  @IsOptional() @IsEnum(DocumentOwnerType) ownerType?: DocumentOwnerType;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsEnum(DocumentCategory) category?: DocumentCategory;
  @IsOptional() @IsUUID() uploadedById?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder?: 'asc' | 'desc';
}

class CreateDocumentDto {
  @IsEnum(DocumentOwnerType) ownerType!: DocumentOwnerType;
  @IsUUID() ownerId!: string;
  @IsOptional() @IsEnum(DocumentCategory) category?: DocumentCategory;
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @MaxLength(2048) fileUrl!: string;
  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
  @IsOptional() @IsString() @MaxLength(120) mimeType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sizeBytes?: number;
  @IsOptional() @IsEnum(DocumentVisibility) visibility?: DocumentVisibility;
}

class UpdateDocumentDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsEnum(DocumentCategory) category?: DocumentCategory;
  @IsOptional() @IsEnum(DocumentVisibility) visibility?: DocumentVisibility;
  @IsOptional() @IsString() @MaxLength(2048) fileUrl?: string;
  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
  @IsOptional() @IsString() @MaxLength(120) mimeType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sizeBytes?: number;
}

const DOCUMENT_INCLUDE = {
  uploadedBy: {
    select: { id: true, fullName: true, email: true, role: true },
  },
} as const;

// ── Service ───────────────────────────────────────────────────────────────

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  // ── Presign ─────────────────────────────────────────────────────────

  /**
   * Returns a short-lived presigned R2 PUT URL that the browser can use to
   * upload the file directly. The MIME type whitelist and size cap are
   * enforced here so unsupported / oversized files never get an upload slot.
   * The eventual public URL is also returned so the client can post it to
   * `POST /documents` once the PUT succeeds.
   */
  async presign(dto: DocumentsPresignDto) {
    const contentType = dto.contentType.trim().toLowerCase();
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(contentType)) {
      throw new BadRequestException(
        `Content type "${dto.contentType}" is not allowed for document uploads`,
      );
    }
    if (dto.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large: ${dto.sizeBytes} bytes (max ${MAX_DOCUMENT_SIZE_BYTES})`,
      );
    }
    // Use the original file extension when available — falls back to a
    // content-type guess via R2Service.
    let extension: string | undefined;
    if (dto.fileName) {
      const dot = dto.fileName.lastIndexOf('.');
      if (dot >= 0) {
        const ext = dto.fileName.slice(dot).toLowerCase();
        // Only accept short, alphanumeric extensions so a path-like file
        // name can't poison the R2 key.
        if (/^\.[a-z0-9]{1,8}$/.test(ext)) extension = ext;
      }
    }
    return this.r2.createPresignedUpload({
      contentType,
      folder: 'documents',
      extension,
    });
  }

  async list(query: DocumentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);

    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
      ...(query.ownerType ? { ownerType: query.ownerType } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.uploadedById ? { uploadedById: query.uploadedById } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
              { fileName: { contains: query.q, mode: 'insensitive' } },
              { uploadedBy: { fullName: { contains: query.q, mode: 'insensitive' } } },
              { uploadedBy: { email: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: query.sortOrder ?? 'asc' },
        include: DOCUMENT_INCLUDE,
        ...takeSkip({ page, pageSize }),
      }),
      this.prisma.document.count({ where }),
    ]);
    return paginate(rows, total, { page, pageSize });
  }

  async findOne(id: string) {
    const row = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: DOCUMENT_INCLUDE,
    });
    if (!row) throw new NotFoundException('Document not found');
    return row;
  }

  async create(uploadedById: string, dto: CreateDocumentDto) {
    const fileUrl = assertSafeUrl(dto.fileUrl, this.r2.publicBaseUrl);
    await this.assertOwnerExists(dto.ownerType, dto.ownerId);
    return this.prisma.document.create({
      data: {
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        category: dto.category ?? DocumentCategory.OTHER,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        fileUrl,
        fileName: dto.fileName?.trim() ?? null,
        mimeType: dto.mimeType?.trim() ?? null,
        sizeBytes: dto.sizeBytes ?? null,
        visibility: dto.visibility ?? DocumentVisibility.ADMIN_ONLY,
        uploadedById,
      },
      include: DOCUMENT_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateDocumentDto) {
    await this.findOne(id); // throws 404 if missing/deleted
    const data: Prisma.DocumentUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined)
      data.description = dto.description ? dto.description.trim() : null;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.visibility !== undefined) data.visibility = dto.visibility;
    if (dto.fileUrl !== undefined) data.fileUrl = assertSafeUrl(dto.fileUrl, this.r2.publicBaseUrl);
    if (dto.fileName !== undefined) data.fileName = dto.fileName?.trim() ?? null;
    if (dto.mimeType !== undefined) data.mimeType = dto.mimeType?.trim() ?? null;
    if (dto.sizeBytes !== undefined) data.sizeBytes = dto.sizeBytes ?? null;

    return this.prisma.document.update({
      where: { id },
      data,
      include: DOCUMENT_INCLUDE,
    });
  }

  /** Soft delete — sets `deletedAt`. The row stays in the DB for audit. */
  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { status: 'deleted' as const };
  }

  /**
   * Lookup helper for entity-page widgets. Returns up to `limit` most
   * recent non-deleted documents for the given owner. ADMIN-only at the
   * controller — for portal/broker access, see Phase 17 §E note.
   */
  async listForOwner(
    ownerType: DocumentOwnerType,
    ownerId: string,
    limit = 5,
    visibility?: DocumentVisibility,
  ) {
    return this.prisma.document.findMany({
      where: { ownerType, ownerId, deletedAt: null, ...(visibility ? { visibility } : {}) },
      orderBy: { createdAt: 'desc' },
      include: DOCUMENT_INCLUDE,
      take: limit,
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private async assertOwnerExists(ownerType: DocumentOwnerType, ownerId: string) {
    // Best-effort existence check. If the entity model isn't easily known,
    // we accept the row — the document can be reattached if the owner
    // arrives later. For the high-value types we check.
    switch (ownerType) {
      case DocumentOwnerType.PROJECT:
        await this.assertFound(this.prisma.project.findUnique({ where: { id: ownerId }, select: { id: true } }), 'Project');
        break;
      case DocumentOwnerType.UNIT:
        await this.assertFound(this.prisma.unit.findUnique({ where: { id: ownerId }, select: { id: true } }), 'Unit');
        break;
      case DocumentOwnerType.LEAD:
        await this.assertFound(this.prisma.lead.findUnique({ where: { id: ownerId }, select: { id: true } }), 'Lead');
        break;
      case DocumentOwnerType.RESERVATION:
        await this.assertFound(this.prisma.reservation.findUnique({ where: { id: ownerId }, select: { id: true } }), 'Reservation');
        break;
      case DocumentOwnerType.CONTRACT:
        await this.assertFound(this.prisma.contract.findUnique({ where: { id: ownerId }, select: { id: true } }), 'Contract');
        break;
      case DocumentOwnerType.DEPOSIT:
        await this.assertFound(this.prisma.deposit.findUnique({ where: { id: ownerId }, select: { id: true } }), 'Deposit');
        break;
      case DocumentOwnerType.BROKER:
        await this.assertFound(this.prisma.broker.findUnique({ where: { id: ownerId }, select: { id: true } }), 'Broker');
        break;
      case DocumentOwnerType.BROKER_COMMISSION:
        await this.assertFound(this.prisma.brokerCommission.findUnique({ where: { id: ownerId }, select: { id: true } }), 'BrokerCommission');
        break;
      case DocumentOwnerType.BROKER_PAYOUT:
        await this.assertFound(this.prisma.brokerPayout.findUnique({ where: { id: ownerId }, select: { id: true } }), 'BrokerPayout');
        break;
      case DocumentOwnerType.USER:
        await this.assertFound(this.prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } }), 'User');
        break;
      case DocumentOwnerType.MAINTENANCE_REQUEST:
        await this.assertFound(this.prisma.maintenanceRequest.findUnique({ where: { id: ownerId }, select: { id: true } }), 'MaintenanceRequest');
        break;
      case DocumentOwnerType.OTHER:
        // No validation for OTHER — caller is asserting an external identifier.
        break;
    }
  }

  private async assertFound<T>(promise: Promise<T | null>, label: string) {
    const row = await promise;
    if (!row) throw new BadRequestException(`${label} not found for ownerId`);
  }
}

// ── Controller ────────────────────────────────────────────────────────────

@ApiTags('documents')
@Roles(UserRole.ADMIN)
@Controller('documents')
class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  // Mints the presigned R2 upload URL. Mounted BEFORE `:id` routes so
  // the literal segment isn't interpreted as a UUID parameter.
  @Permissions('documents:upload')
  @Post('presign')
  presign(@Body() dto: DocumentsPresignDto) {
    return this.svc.presign(dto);
  }

  @Permissions('documents:read')
  @Get()
  list(@Query() query: DocumentsQueryDto) {
    return this.svc.list(query);
  }

  @Permissions('documents:read')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Permissions('documents:upload')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentDto) {
    return this.svc.create(user.sub, dto);
  }

  @Permissions('documents:update')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentDto) {
    return this.svc.update(id, dto);
  }

  @Permissions('documents:delete')
  @Delete(':id')
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.softDelete(id);
  }
}

@Module({
  imports: [MediaModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
