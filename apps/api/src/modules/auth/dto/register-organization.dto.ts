import { IsEmail, IsString, MinLength } from "class-validator";

export class RegisterOrganizationDto {
  @IsString()
  @MinLength(2)
  organizationName!: string;

  @IsString()
  @MinLength(1)
  adminFirstName!: string;

  @IsString()
  @MinLength(1)
  adminLastName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(10, { message: "Password must be at least 10 characters" })
  adminPassword!: string;
}
