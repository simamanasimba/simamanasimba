import { IsString } from "class-validator";

export class LinkMediaHostDto {
  @IsString()
  mediaHostId!: string;
}

export class LinkInfluencerDto {
  @IsString()
  influencerId!: string;
}
