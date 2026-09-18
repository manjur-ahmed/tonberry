import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateContactMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;
}
