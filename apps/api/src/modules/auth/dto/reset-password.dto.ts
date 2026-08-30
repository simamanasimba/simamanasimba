import { IsEmail, IsString, MinLength } from "class-validator";

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(10, { message: "Password must be at least 10 characters" })
  newPassword!: string;
}

export class VerifyEmailDto {
  @IsString()
  token!: string;
}
