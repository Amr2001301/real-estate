import { Global, Module } from '@nestjs/common';
import { OwnershipService } from './ownership.service';

// Provides the centralized customer ownership policy app-wide.
@Global()
@Module({
  providers: [OwnershipService],
  exports: [OwnershipService],
})
export class OwnershipModule {}
