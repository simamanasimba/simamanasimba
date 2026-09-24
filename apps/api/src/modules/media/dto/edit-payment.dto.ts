import { IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

/** Super Admin's "fix a mistake on an existing payment record" action — every field is optional
 * (only send what's actually changing), but `reason` is always required: this is a sensitive
 * action flagged in the audit log for follow-up, so there must always be a stated justification. */
export class EditPaymentDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  bankTransactionRef?: string;

  @IsOptional()
  @IsString()
  mobileMoneyNumber?: string;

  @IsOptional()
  @IsString()
  mobileMoneyTransactionId?: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}
