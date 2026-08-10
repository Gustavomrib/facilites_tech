import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MinLength, NotEquals } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({ example: -2, description: 'Positive to add stock, negative to remove it' })
  @IsInt()
  @NotEquals(0)
  delta: number;

  @ApiProperty({ example: 'Contagem de inventário' })
  @IsString()
  @MinLength(3)
  reason: string;
}
