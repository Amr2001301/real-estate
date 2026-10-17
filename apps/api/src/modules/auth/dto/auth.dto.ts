import {
  IsEmail,
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
