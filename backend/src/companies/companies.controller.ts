import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtPayload } from '../common/types/auth-request';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('me')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.companiesService.findMine(user.companyId);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch('me')
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(user.companyId, user.sub, dto);
  }
}
