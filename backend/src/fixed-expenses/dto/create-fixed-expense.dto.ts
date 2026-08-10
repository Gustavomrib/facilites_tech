import { ApiProperty } from '@nestjs/swagger';
import { Recurrence } from '@prisma/client';
import { IsEnum, IsNumber, IsString, Min, MinLength } from 'class-validator';

export class CreateFixedExpenseDto {
  @ApiProperty({ example: 'Aluguel' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 900.0 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: Recurrence })
  @IsEnum(Recurrence)
  recurrence: Recurrence;
}
