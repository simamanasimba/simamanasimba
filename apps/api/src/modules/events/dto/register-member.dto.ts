import { IsString } from "class-validator";

export class RegisterMemberDto {
  @IsString()
  memberId!: string;
}
