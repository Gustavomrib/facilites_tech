import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/auth-request';
import { AccountsService } from './accounts.service';
import { SettleAccountDto } from './dto/settle-account.dto';

/**
 * Receivables are never created directly through this API — they're a side effect of a
 * STORE_CREDIT ("fiado") sale (see SalesService). This mirrors the original product rule:
 * a receivable always traces back to a sale and a customer.
 */
@ApiTags('accounts-receivable')
@ApiBearerAuth()
@Controller('accounts-receivable')
export class AccountsReceivableController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.accountsService.findAll(user.companyId, AccountType.RECEIVABLE);
  }

  @Get('overdue')
  overdue(@CurrentUser() user: JwtPayload) {
    return this.accountsService.findOverdue(user.companyId, AccountType.RECEIVABLE);
  }

  @Get('due-soon')
  dueSoon(@CurrentUser() user: JwtPayload, @Query('days') days?: string) {
    return this.accountsService.findDueSoon(
      user.companyId,
      AccountType.RECEIVABLE,
      days ? Number(days) : 3,
    );
  }

  @Patch(':id/settle')
  settle(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: SettleAccountDto) {
    return this.accountsService.settle(user.companyId, id, user.sub, dto.paidAt);
  }
}
