import {
  IsEmail,
  IsString,
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
