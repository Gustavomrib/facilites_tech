import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateSaleDto {
  @ApiProperty({ example: '2026-08-02', description: 'ISO date (no time component)' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Coca-Cola 2L' })
  @IsString()
  @MinLength(1)
  description: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 9.9 })
  @IsNumber()
  @Min(0.01)
  unitPrice: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ description: 'Set when the sale is tied to a catalog product/service' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Required when paymentMethod is STORE_CREDIT ("fiado")' })
  @ValidateIf((o: CreateSaleDto) => o.paymentMethod === PaymentMethod.STORE_CREDIT)
  @IsUUID()
  customerId?: string;
}
