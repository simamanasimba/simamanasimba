import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { PaymentBeneficiaryType } from "@event-intel/database";

export class BulkPaymentEntryDto {
  @IsString()
  beneficiaryId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class BulkCreatePaymentDto {
  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsEnum(PaymentBeneficiaryType)
  beneficiaryType!: PaymentBeneficiaryType;

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkPaymentEntryDto)
  entries!: BulkPaymentEntryDto[];
}
