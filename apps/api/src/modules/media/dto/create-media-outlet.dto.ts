import { IsString, MinLength } from "class-validator";

export class CreateMediaOutletDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
