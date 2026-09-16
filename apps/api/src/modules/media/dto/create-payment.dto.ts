import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { PaymentBeneficiaryType } from "@event-intel/database";

export class CreatePaymentDto {
  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsEnum(PaymentBeneficiaryType)
  beneficiaryType!: PaymentBeneficiaryType;

  @IsOptional()
  @IsString()
  mediaHostId?: string;

  @IsOptional()
  @IsString()
  influencerId?: string;

  @IsOptional()
  @IsString()
  memberId?: string;

  @IsDateString()
  paymentDate!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

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
  mobileMoneyProvider?: string;

  @IsOptional()
  @IsString()
  mobileMoneyNumber?: string;

  @IsOptional()
  @IsString()
  mobileMoneyTransactionId?: string;

  @IsOptional()
  @IsString()
  mediaEngagementId?: string;

  /** Set instead of mediaEngagementId when paying against an Influencer 2 campaign. */
  @IsOptional()
  @IsString()
  influencer2CampaignId?: string;
}
