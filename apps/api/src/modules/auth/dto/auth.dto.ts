import {
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

// Authenticated self-service password change (POST /auth/change-password).
// The signed-in user is taken from the JWT, never the body.
export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

// A customer's phone change: the new number, then the code sent to it
// (POST /auth/me/phone, POST /auth/me/phone/confirm).
export class PhoneChangeRequestDto {
  @IsString()
  @MaxLength(32)
  phone!: string;
}

export class PhoneChangeConfirmDto {
  @Matches(/^[0-9]{6}$/)
  code!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(1)
  token!: string;
}

// ── TFA1 — two-step sign-in ─────────────────────────────────────────────────

/** A 6-digit code from the app, or a recovery code like `k7m2-9xq4`. */
const TWO_FACTOR_CODE = /^(\d{6}|[A-Za-z0-9]{4}-?[A-Za-z0-9]{4})$/;

export class TwoFactorChallengeDto {
  @IsString()
  @MaxLength(2048)
  challenge!: string;
}

export class TwoFactorVerifyDto extends TwoFactorChallengeDto {
  @Matches(TWO_FACTOR_CODE)
  code!: string;
}

/** Codes from the app only (turning it on, or new recovery codes). */
export class TwoFactorCodeDto {
  @Matches(/^\d{6}$/)
  code!: string;
}

export class TwoFactorSetupFinishDto extends TwoFactorChallengeDto {
  @Matches(/^\d{6}$/)
  code!: string;
}

export class TwoFactorDisableDto {
  @IsString()
  @MaxLength(256)
  password!: string;

  @Matches(TWO_FACTOR_CODE)
  code!: string;
}

export class TwoFactorPolicyDto {
  @IsIn(['OFF', 'ADMINS', 'STAFF'])
  mode!: 'OFF' | 'ADMINS' | 'STAFF';
}
