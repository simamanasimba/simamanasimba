import { ArrayMinSize, IsArray, IsString } from "class-validator";

export class BulkAssignFolderDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  campaignIds!: string[];

  @IsString()
  folderId!: string;
}
