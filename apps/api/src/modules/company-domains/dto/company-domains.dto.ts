import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCustomDomainDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  hostname!: string;
}
