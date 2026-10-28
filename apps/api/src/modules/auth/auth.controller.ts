import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService, DEPRECATED_ENDPOINT_HEADER } from './auth.service';
import { TenantResolverService } from './tenant-resolver.service';
import { TwoFactorService } from './two-factor.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  PhoneChangeConfirmDto,
  PhoneChangeRequestDto,
  LoginEmailDto,
  RefreshDto,
  ResetPasswordDto,
  TwoFactorChallengeDto,
  TwoFactorCodeDto,
  TwoFactorDisableDto,
  TwoFactorPolicyDto,
  TwoFactorSetupFinishDto,
  TwoFactorVerifyDto,
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
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { runAsPlatform, runInCompany } from '../../common/tenant/tenant-context';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tenantResolver: TenantResolverService,
    private readonly twoFactor: TwoFactorService,
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
    // Tenant-less by design: checks the password against every company's
    // account with this email (see AuthService.loginEmail).
    const result = await runAsPlatform(() => this.auth.loginEmail(dto.email, dto.password));
    this.auth.recordLegacyLoginTelemetry();
    return result;
  }

  // ── MT-026 — Tenant staff login ───────────────────────────────────────────
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login-staff')
  async loginStaff(@Body() dto: StaffLoginDto) {
    const tenant = await this.tenantResolver.resolveBySlug(dto.slug);
    return runInCompany(tenant.companyId, () =>
      this.auth.loginStaff(tenant.companyId, dto.email, dto.password),
    );
  }

  // ── MT-027 — Super-admin login ────────────────────────────────────────────
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login-super-admin')
  loginSuperAdmin(@Body() dto: SuperAdminLoginDto) {
    // SUPER_ADMIN has no company; the service filters on role.
    return runAsPlatform(() => this.auth.loginSuperAdmin(dto.email, dto.password));
  }

  // ── MT-028 — Tenant customer login ────────────────────────────────────────
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('tenant/customer/login')
  async tenantCustomerLogin(@Body() dto: TenantCustomerLoginDto) {
    const tenant = await this.tenantResolver.resolveBySlug(dto.slug);
    return runInCompany(tenant.companyId, () =>
      this.auth.loginCustomerV2(tenant.companyId, dto.email, dto.password),
    );
  }

  // ── MT-029 — Tenant customer registration ────────────────────────────────
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('tenant/customer/register')
  async tenantCustomerRegister(@Body() dto: TenantCustomerRegisterDto) {
    const tenant = await this.tenantResolver.resolveBySlug(dto.slug);
    return runInCompany(tenant.companyId, () =>
      this.auth.registerCustomerV2(tenant.companyId, tenant.country, {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        password: dto.password,
      }),
    );
  }

  // ── MT-030 — Tenant OTP ───────────────────────────────────────────────────
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('tenant/otp/request')
  async tenantOtpRequest(@Body() dto: TenantOtpRequestDto) {
    const tenant = await this.tenantResolver.resolveBySlug(dto.slug);
    return runInCompany(tenant.companyId, () =>
      this.auth.requestOtpV2(tenant.companyId, tenant.country, dto.phone),
    );
  }

  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('tenant/otp/verify')
  async tenantOtpVerify(@Body() dto: TenantOtpVerifyDto) {
    const tenant = await this.tenantResolver.resolveBySlug(dto.slug);
    return runInCompany(tenant.companyId, () =>
      this.auth.verifyOtpV2(tenant.companyId, tenant.country, dto.phone, dto.code, dto.fullName),
    );
  }

  // ── MT-030 — Tenant forgot/reset password ────────────────────────────────
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('tenant/forgot-password')
  async tenantForgotPassword(@Body() dto: TenantForgotPasswordDto) {
    const tenant = await this.tenantResolver.resolveBySlug(dto.slug);
    return runInCompany(tenant.companyId, () => this.auth.forgotPasswordV2(tenant.companyId, dto.email));
  }

  // Reset password is token-based — no slug needed; the token identifies the user.
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('tenant/reset-password')
  tenantResetPassword(@Body() dto: TenantResetPasswordDto) {
    return runAsPlatform(() => this.auth.resetPassword(dto.token, dto.newPassword));
  }

  // Authenticated self-service password change. NOT @Public — the global
  // JwtAuthGuard requires a valid access token, and the user comes from the
  // JWT (never the body), so a caller can only change their OWN password.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.sub, dto.currentPassword, dto.newPassword, user.sid);
  }

  // ── TFA1 — the second sign-in step. No session yet: the signed challenge
  // from the password step names the account. Tenant-less like refresh.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('2fa/verify')
  verifyTwoFactor(@Body() dto: TwoFactorVerifyDto) {
    return runAsPlatform(() => this.auth.verifyTwoFactor(dto.challenge, dto.code));
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('2fa/setup-challenge')
  startTwoFactorSetup(@Body() dto: TwoFactorChallengeDto) {
    return runAsPlatform(() => this.auth.startTwoFactorSetup(dto.challenge));
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('2fa/enable-challenge')
  finishTwoFactorSetup(@Body() dto: TwoFactorSetupFinishDto) {
    return runAsPlatform(() => this.auth.finishTwoFactorSetup(dto.challenge, dto.code));
  }

  // ── TFA1 — own two-step sign-in (JWT; own account only). ────────────────
  @Get('2fa')
  twoFactorStatus(@CurrentUser() user: AuthUser) {
    return this.twoFactor.status(user.sub);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('2fa/setup')
  twoFactorSetup(@CurrentUser() user: AuthUser) {
    return this.twoFactor.setup(user.sub);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('2fa/enable')
  twoFactorEnable(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto) {
    return this.twoFactor.enable(user.sub, dto.code);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('2fa/disable')
  twoFactorDisable(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorDisableDto) {
    return this.twoFactor.disable(user.sub, dto.password, dto.code);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('2fa/recovery-codes')
  twoFactorRecoveryCodes(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto) {
    return this.twoFactor.regenerateRecoveryCodes(user.sub, dto.code);
  }

  // The company's rule: who must use it (security.require2fa).
  @Roles(UserRole.ADMIN)
  @Permissions('settings:read')
  @Get('2fa/policy')
  async twoFactorPolicy(@CurrentUser() user: AuthUser) {
    return { mode: await this.twoFactor.policy(user.companyId) };
  }

  @Roles(UserRole.ADMIN)
  @Permissions('settings:write')
  @Put('2fa/policy')
  setTwoFactorPolicy(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorPolicyDto) {
    return this.twoFactor.setPolicy(user.companyId!, dto.mode);
  }

  // ── SES1 — own sessions (linked devices). Own account only (JWT). ────────
  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user.sub, user.sid);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('sessions/revoke-others')
  revokeOtherSessions(@CurrentUser() user: AuthUser) {
    return this.auth.revokeOtherSessions(user.sub, user.sid);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Delete('sessions/:id')
  revokeSession(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.auth.revokeSession(user.sub, id);
  }

  // A customer changing their phone: the code goes to the new number and the
  // change is made only once it is entered. Own account only (JWT).
  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('me/phone')
  requestPhoneChange(@CurrentUser() user: AuthUser, @Body() dto: PhoneChangeRequestDto) {
    return this.auth.requestPhoneChange(user.sub, dto.phone);
  }

  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('me/phone/confirm')
  confirmPhoneChange(@CurrentUser() user: AuthUser, @Body() dto: PhoneChangeConfirmDto) {
    return this.auth.confirmPhoneChange(user.sub, dto.code);
  }

  // Identical 200 response for existing and non-existing accounts prevents
  // user enumeration. Per-IP throttle applies; limit is intentionally strict.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    // Tenant-less (web-admin and the staff app send no slug): one reset link
    // per company account with this email.
    return runAsPlatform(() => this.auth.forgotPassword(dto.email));
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return runAsPlatform(() => this.auth.resetPassword(dto.token, dto.newPassword));
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return runAsPlatform(() => this.auth.refresh(dto.refreshToken));
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
    return runAsPlatform(() => this.auth.verifyEmail(dto.token));
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
