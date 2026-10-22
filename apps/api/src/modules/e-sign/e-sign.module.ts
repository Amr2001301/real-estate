import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ESignController } from './e-sign.controller';
import { ESignService } from './e-sign.service';

@Module({
  imports: [AuthModule],
  controllers: [ESignController],
  providers: [ESignService],
})
export class ESignModule {}
