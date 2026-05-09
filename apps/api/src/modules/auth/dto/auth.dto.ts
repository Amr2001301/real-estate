import { IsEmail, IsString, Length, Matches, MinLength, IsOptional } from 'class-validator';

export class LoginEmailDto {
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
