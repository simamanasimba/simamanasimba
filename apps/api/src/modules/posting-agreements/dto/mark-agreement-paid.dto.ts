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
}
