import {
  BadRequestException,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DocumentOwnerType, DocumentVisibility, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { OwnershipService } from '../../common/ownership/ownership.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { R2Service } from '../media/r2.service';
import { MediaModule } from '../media/media.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { DocumentsModule, DocumentsService } from './documents.module';

// Owner types a customer is allowed to enumerate documents for.
const CUSTOMER_OWNER_TYPES = new Set<DocumentOwnerType>([
  DocumentOwnerType.CONTRACT,
  DocumentOwnerType.DEPOSIT,
  DocumentOwnerType.MAINTENANCE_REQUEST,
]);

// Customer-facing documents: list CUSTOMER_VISIBLE metadata for an owned entity
// (no fileUrl leaked) and mint short-lived signed download URLs just-in-time.
@ApiTags('me-documents')
@RequireCapability('feature.customerApp')
@Controller('me/documents')
class MeDocumentsController {
  constructor(
    private readonly ownership: OwnershipService,
    private readonly documents: DocumentsService,
    private readonly r2: R2Service,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Aggregate all CUSTOMER_VISIBLE documents across every entity this user
   * owns (contracts, deposits, maintenance requests). Returns a flat list
   * sorted newest-first with an ownerType label for the frontend to filter by.
   */
  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Get('all')
  async listAll(@CurrentUser() user: AuthUser) {
    const userId = user.sub;

    // Collect all owned entity IDs in parallel.
    const [contractIds, depositIds, maintenanceIds] = await Promise.all([
      this.prisma.contract
        .findMany({ where: { customerId: userId }, select: { id: true } })
        .then((rows) => rows.map((r) => r.id)),
      this.prisma.deposit
        .findMany({
          where: { contract: { customerId: userId } },
          select: { id: true },
        })
        .then((rows) => rows.map((r) => r.id)),
      this.prisma.maintenanceRequest
        .findMany({ where: { customerId: userId }, select: { id: true } })
        .then((rows) => rows.map((r) => r.id)),
    ]);

    if (!contractIds.length && !depositIds.length && !maintenanceIds.length) {
      return [];
    }

    const docs = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        visibility: DocumentVisibility.CUSTOMER_VISIBLE,
        OR: [
          ...(contractIds.length ? [{ ownerType: DocumentOwnerType.CONTRACT, ownerId: { in: contractIds } }] : []),
          ...(depositIds.length ? [{ ownerType: DocumentOwnerType.DEPOSIT, ownerId: { in: depositIds } }] : []),
          ...(maintenanceIds.length ? [{ ownerType: DocumentOwnerType.MAINTENANCE_REQUEST, ownerId: { in: maintenanceIds } }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        fileName: true,
        mimeType: true,
        category: true,
        ownerType: true,
        ownerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return docs;
  }

  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('ownerType') ownerTypeRaw: string,
    @Query('ownerId', ParseUUIDPipe) ownerId: string,
  ) {
    const ownerType = ownerTypeRaw as DocumentOwnerType;
    if (!CUSTOMER_OWNER_TYPES.has(ownerType)) {
      throw new BadRequestException('Unsupported ownerType');
    }
    await this.ownership.assertOwnsOwner(user.sub, ownerType, ownerId);
    const docs = await this.documents.listForOwner(
      ownerType,
      ownerId,
      50,
      DocumentVisibility.CUSTOMER_VISIBLE,
    );
    // Metadata only — never expose the stored permanent fileUrl.
    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      fileName: d.fileName,
      mimeType: d.mimeType,
      category: d.category,
      createdAt: d.createdAt,
    }));
  }

  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Get(':id/download')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const doc = await this.ownership.getCustomerDocumentOrThrow(user.sub, id);
    const key = this.r2.keyFromPublicUrl(doc.fileUrl);
    const signed = await this.r2.createPresignedDownload({
      key,
      fileName: doc.fileName,
      contentType: doc.mimeType,
    });
    return {
      url: signed.url,
      fileName: doc.fileName,
      contentType: doc.mimeType,
      expiresIn: signed.expiresIn,
    };
  }
}

@Module({
  imports: [MediaModule, DocumentsModule, PrismaModule],
  controllers: [MeDocumentsController],
})
export class MeDocumentsModule {}
