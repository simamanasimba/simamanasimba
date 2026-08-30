import { ArrayMinSize, IsArray, IsString, MinLength } from "class-validator";

export class BulkEmailMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  memberIds!: string[];

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  message!: string;
}
