import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { DataImportController } from './data-import.controller';
import { DataImportService } from './data-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [DataImportController],
  providers: [DataImportService],
})
export class DataImportModule {}
