import { Module } from '@nestjs/common';
import { DataMigrationAdminController, DataMigrationController } from './data-migration.controller';
import { DataMigrationService } from './data-migration.service';

@Module({
  controllers: [DataMigrationController, DataMigrationAdminController],
  providers: [DataMigrationService],
})
export class DataMigrationModule {}
