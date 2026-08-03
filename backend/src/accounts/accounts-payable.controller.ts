import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/auth-request';
import { AccountsService } from './accounts.service';
import { CreatePayableDto } from './dto/create-payable.dto';
import { SettleAccountDto } from './dto/settle-account.dto';

@ApiTags('accounts-payable')
@ApiBearerAuth()
@Controller('accounts-payable')
export class AccountsPayableController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePayableDto) {
    return this.accountsService.createPayable(user.companyId, user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.accountsService.findAll(user.companyId, AccountType.PAYABLE);
  }

  @Get('overdue')
  overdue(@CurrentUser() user: JwtPayload) {
    return this.accountsService.findOverdue(user.companyId, AccountType.PAYABLE);
  }

  @Get('due-soon')
  dueSoon(@CurrentUser() user: JwtPayload, @Query('days') days?: string) {
    return this.accountsService.findDueSoon(
      user.companyId,
      AccountType.PAYABLE,
      days ? Number(days) : 3,
    );
  }

  @Patch(':id/settle')
  settle(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: SettleAccountDto) {
    return this.accountsService.settle(user.companyId, id, user.sub, dto.paidAt);
  }
}
