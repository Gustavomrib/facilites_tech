import { ApiPropertyOptional } from '@nestjs/swagger';
import { Offering, DashboardPeriod, ReportFrequency } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiPropertyOptional({ enum: Offering })
  @IsOptional()
  @IsEnum(Offering)
  offering?: Offering;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tracksInventory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  dailySalesGoal?: number;

  @ApiPropertyOptional({ enum: DashboardPeriod })
  @IsOptional()
  @IsEnum(DashboardPeriod)
  dashboardPeriod?: DashboardPeriod;

  @ApiPropertyOptional({ enum: ReportFrequency })
  @IsOptional()
  @IsEnum(ReportFrequency)
  reportFrequency?: ReportFrequency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reportByEmail?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateCompanyDto) => !!o.reportByEmail)
  @IsEmail()
  reportEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;
}
