import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FixedExpensesModule } from '../fixed-expenses/fixed-expenses.module';
import { AccountsPayableController } from './accounts-payable.controller';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [AuditLogsModule, FixedExpensesModule],
  controllers: [AccountsPayableController, AccountsReceivableController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
