import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ReportsController } from './reports.controller';

@Module({
  imports: [AuditLogsModule],
  controllers: [ReportsController],
})
export class ReportsModule {}
