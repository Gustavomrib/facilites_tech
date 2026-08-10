import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Coca-Cola 2L' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({
    example: 'BEB-001',
    description:
      'Required for stockable products (type=PRODUCT); ignored/cleared for services. Normalized (trimmed, uppercased) and enforced unique per company in the service layer.',
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: 'Bebidas' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: ProductType, default: ProductType.PRODUCT })
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @ApiPropertyOptional({ example: 10, description: 'Ignored for SERVICE type' })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ example: 3, description: 'Ignored for SERVICE type' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minQuantity?: number;

  @ApiProperty({ example: 9.9 })
  @IsNumber()
  @Min(0.01)
  salePrice: number;

  @ApiPropertyOptional({ example: 5.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;
}
