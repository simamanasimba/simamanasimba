import { IsNumber, IsString, MinLength } from "class-validator";

export class CreateMediaActivationDto {
  @IsString()
  @MinLength(1)
  week!: string;

  @IsString()
  @MinLength(1)
  platformProgram!: string;

  @IsString()
  @MinLength(1)
  activationChannel!: string;

  @IsString()
  @MinLength(1)
  personnelOutlet!: string;

  @IsString()
  @MinLength(1)
  personnelRole!: string;

  @IsNumber()
  rateTzs!: number;

  @IsNumber()
  engagement!: number;

  @IsNumber()
  totalTzs!: number;

  @IsString()
  @MinLength(1)
  engagementDates!: string;

  @IsString()
  @MinLength(1)
  link!: string;
}
