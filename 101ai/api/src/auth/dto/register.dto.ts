import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEmail()
  email: string;

  // Same policy as SetPasswordDto — keep the two in sync.
  @IsString()
  @MinLength(8)
  password: string;
}
