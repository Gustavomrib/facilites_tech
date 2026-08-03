import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class SettleAccountDto {
  @ApiPropertyOptional({ example: '2026-08-02', description: 'Defaults to today' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
