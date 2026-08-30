import { IsString, MinLength } from "class-validator";

export class LookupIdentifierDto {
  @IsString()
  @MinLength(1)
  identifier!: string;

  /**
   * Membership numbers are sequential and human-shareable by design, so
   * knowing one is not proof of ownership — the caller must also supply the
   * phone or email already on file for that member before we return anything.
   */
  @IsString()
  @MinLength(1, { message: "Enter the phone number or email on file for this member" })
  contact!: string;
}
