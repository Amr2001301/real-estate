import { Module } from '@nestjs/common';
import { DataMigrationAdminController, DataMigrationController } from './data-migration.controller';
import { DataMigrationService } from './data-migration.service';
import { MigrationMappingService } from './migration-mapping.service';

@Module({
  controllers: [DataMigrationController, DataMigrationAdminController],
  providers: [DataMigrationService, MigrationMappingService],
})
export class DataMigrationModule {}
