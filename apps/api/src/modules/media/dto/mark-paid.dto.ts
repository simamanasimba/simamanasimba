import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class MarkPaidDto {
  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  /** What was actually sent. Defaults to the approved amount when omitted. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  /** Required by the service when paidAmount differs from the approved amount. */
  @IsOptional()
  @IsString()
  varianceNote?: string;
}
