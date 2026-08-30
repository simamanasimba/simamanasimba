import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";
import { ExpenseCategory } from "@event-intel/database";

export class CreateExpenseDto {
  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @IsString()
  @MinLength(1)
  item!: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;

  @IsISO8601()
  dateIssued!: string;

  @IsOptional()
  @IsString()
  concernedParty?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
