import { ArrayMinSize, IsArray, IsString } from "class-validator";

export class BulkAdminCheckinDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  memberIds!: string[];
}
