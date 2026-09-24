import { IsDateString, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class MarkAgreementPaidDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @IsDateString()
  paymentDate!: string;

  @IsString()
  method!: string;

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

  /** Only meaningful (and required, enforced in the service) when the evaluation being paid did
   * NOT meet its target — Finance's mandatory justification for paying it anyway. Ignored for a
   * normal met-target payment. */
  @IsOptional()
  @IsString()
  conditionalReason?: string;
}
