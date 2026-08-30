import { IsString, MinLength } from "class-validator";

export class LookupIdentifierDto {
  @IsString()
  @MinLength(1)
  identifier!: string;
}
