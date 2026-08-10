import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/auth-request';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.companyId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query('search') search?: string) {
    return this.customersService.findAll(user.companyId, search);
  }

  @Get('open-balances')
  openBalances(@CurrentUser() user: JwtPayload) {
    return this.customersService.openBalances(user.companyId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.customersService.findOne(user.companyId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(user.companyId, id, dto);
  }
}
