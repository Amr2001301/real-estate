import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  CustomerLoginDto,
  CustomerRegisterDto,
  ForgotPasswordDto,
  LoginEmailDto,
  OtpRequestDto,
  OtpVerifyDto,
  RefreshDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

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

  // Authenticated self-service password change. NOT @Public — the global
  // JwtAuthGuard requires a valid access token, and the user comes from the
  // JWT (never the body), so a caller can only change their OWN password.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  // Identical 200 response for existing and non-existing accounts prevents
  // user enumeration. Per-IP throttle applies; limit is intentionally strict.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
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

  // ── Email verification ──────────────────────────────────────────────────
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  // Authenticated resend — requires a valid JWT. Prevents enumeration attacks
  // (an attacker cannot determine account existence via this endpoint without
  // already holding a session). 1 request per 60 seconds per user enforced
  // at the service layer; this throttle adds an IP-level guard on top.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('resend-verification')
  resendVerification(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.sub);
  }
}
