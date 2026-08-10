import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsString, Min, MinLength } from 'class-validator';

export class CreatePayableDto {
  @ApiProperty({ example: 'Conta de Luz' })
  @IsString()
  @MinLength(1)
  description: string;

  @ApiProperty({ example: 130.0 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  dueDate: string;
}
