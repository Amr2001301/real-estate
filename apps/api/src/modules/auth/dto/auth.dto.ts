import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MinLength,
  IsOptional,
  Equals,
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

// ── Public customer (email + password) ──────────────────────────────────────

export class CustomerRegisterDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Invalid E.164 phone number' })
  phone!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @Equals(true, { message: 'Terms must be accepted' })
  acceptTerms!: boolean;

  // Optional real-estate preferences. Accepted (so the premium form submits
  // cleanly) but NOT yet persisted — there is no CustomerProfile store. See the
  // W9.1 report: persisting these needs a dedicated profile model later.
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() interestType?: string;
  @IsOptional() @IsString() budgetRange?: string;
  @IsOptional() @IsString() preferredContactMethod?: string;
}

export class CustomerLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class OtpRequestDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Invalid E.164 phone number' })
  phone!: string;
}

export class OtpVerifyDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
