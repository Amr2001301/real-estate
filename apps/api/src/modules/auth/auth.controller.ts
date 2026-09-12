import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService, DEPRECATED_ENDPOINT_HEADER } from './auth.service';
import { TenantResolverService } from './tenant-resolver.service';
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
import {
  StaffLoginDto,
  SuperAdminLoginDto,
  TenantCustomerLoginDto,
  TenantCustomerRegisterDto,
  TenantForgotPasswordDto,
  TenantOtpRequestDto,
  TenantOtpVerifyDto,
  TenantResetPasswordDto,
} from './dto/tenant-auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { PlatformPublic } from '../../common/decorators/platform-public.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  // ── Legacy staff/admin login (MT-035 — deprecation telemetry) ─────────────
  // Kept fully functional. Adds a Deprecation response header so clients and
  // logs can track usage. Actual retirement is gated by ENFORCE_TENANT_SCOPED_AUTH.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  async login(
    @Body() dto: LoginEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader(DEPRECATED_ENDPOINT_HEADER, 'true; rel="https://docs.example.com/migration/auth-v2"');
    const result = await this.auth.loginEmail(dto.email, dto.password);
    this.auth.recordLegacyLoginTelemetry();
    return result;
  }

  // ── MT-026 — Tenant staff login ───────────────────────────────────────────
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login-staff')
  async loginStaff(@Body() dto: StaffLoginDto) {
    const tenant = await this.tenantResolver.resolveBySlug(dto.slug);
    return this.auth.loginStaff(tenant.companyId, dto.email, dto.password);
  }

  // ── MT-027 — Super-admin login ────────────────────────────────────────────
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login-super-admin')
  loginSuperAdmin(@Body() dto: SuperAdminLoginDto) {
    return this.auth.loginSuperAdmin(dto.email, dto.password);
  }

  // ── MT-028 — Tenant customer login ────────────────────────────────────────
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('tenant/customer/login')
  async tenantCustomerLogin(@Body() dto: TenantCustomerLoginDto) {
    const tenant = await this.tenantResolver.resolveBySlug(dto.slug);
    return this.auth.loginCustomerV2(tenant.companyId, dto.email, dto.password);
  }

  // ── MT-029 — Tenant customer registration ────────────────────────────────
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('tenant/customer/register')
  async tenantCustomerRegister(@Body() dto: TenantCustomerRegisterDto) {
    const tenant = await this.tenantResolver.resolveBySlug(dto.slug);
    return this.auth.registerCustomerV2(tenant.companyId, tenant.country, {
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email,
      password: dto.password,
    });
  }

  // ── MT-030 — Tenant OTP ───────────────────────────────────────────────────
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('tenant/otp/request')
  async tenantOtpRequest(@Body() dto: TenantOtpRequestDto) {
    const tenant = await this.tenantResolver.resolveBySlug(dto.slug);
    return this.auth.requestOtpV2(tenant.companyId, tenant.country, dto.phone);
  }

  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('tenant/otp/verify')
  async tenantOtpVerify(@Body() dto: TenantOtpVerifyDto) {
    const tenant = await this.tenantResolver.resolveBySlug(dto.slug);
    return this.auth.verifyOtpV2(tenant.companyId, tenant.country, dto.phone, dto.code, dto.fullName);
  }

  // ── MT-030 — Tenant forgot/reset password ────────────────────────────────
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('tenant/forgot-password')
  async tenantForgotPassword(@Body() dto: TenantForgotPasswordDto) {
    const tenant = await this.tenantResolver.resolveBySlug(dto.slug);
    return this.auth.forgotPasswordV2(tenant.companyId, dto.email);
  }

  // Reset password is token-based — no slug needed; the token identifies the user.
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('tenant/reset-password')
  tenantResetPassword(@Body() dto: TenantResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  // ── Legacy public customer email/password (DEFAULT_COMPANY_ID scoped) ─────
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
