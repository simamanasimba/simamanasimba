import { IsDateString, IsString, MaxLength, MinLength } from "class-validator";

export class CreateSavedViewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
