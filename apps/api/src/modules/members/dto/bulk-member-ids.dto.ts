import { ArrayMinSize, IsArray, IsString } from "class-validator";

export class BulkMemberIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  memberIds!: string[];
}
