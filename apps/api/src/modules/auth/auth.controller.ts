import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  CustomerLoginDto,
  CustomerRegisterDto,
  LoginEmailDto,
  OtpRequestDto,
  OtpVerifyDto,
  RefreshDto,
} from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  login(@Body() dto: LoginEmailDto) {
    return this.auth.loginEmail(dto.email, dto.password);
  }

  // ── Public customer email/password ──────────────────────────────────────
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('customer/register')
  customerRegister(@Body() dto: CustomerRegisterDto) {
    return this.auth.registerCustomer(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('customer/login')
  customerLogin(@Body() dto: CustomerLoginDto) {
    return this.auth.loginCustomer(dto.email, dto.password);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('otp/request')
  otpRequest(@Body() dto: OtpRequestDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('otp/verify')
  otpVerify(@Body() dto: OtpVerifyDto) {
    return this.auth.verifyOtp(dto.phone, dto.code, dto.fullName);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }
}
