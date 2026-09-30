import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { DataExportController } from './data-export.controller';
import { DataExportService } from './data-export.service';

@Module({
  imports: [PrismaModule],
  controllers: [DataExportController],
  providers: [DataExportService],
})
export class DataExportModule {}
