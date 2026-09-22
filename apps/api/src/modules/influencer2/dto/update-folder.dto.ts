import { OmitType, PartialType } from "@nestjs/mapped-types";
import { CreateFolderDto } from "./create-folder.dto";

/** A folder's beneficiary is fixed at creation — only its name and date range can change. */
export class UpdateFolderDto extends PartialType(OmitType(CreateFolderDto, ["mediaHostId", "influencerId"] as const)) {}
