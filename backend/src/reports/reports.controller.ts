import { Controller, HttpCode, HttpStatus, NotImplementedException, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/auth-request';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

/**
 * The original frontend faked this endpoint (an `alert()` claiming an e-mail was sent,
 * with no real delivery — see the audit report). This backend does not repeat that:
 * it honestly reports "not implemented" instead of pretending to send anything until a
 * real email/queue provider is wired in.
 */
@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Post('send-now')
  @HttpCode(HttpStatus.OK)
  async sendNow(@CurrentUser() user: JwtPayload) {
    await this.auditLogsService.record({
      companyId: user.companyId,
      userId: user.sub,
      action: 'reports.send-requested',
      entityType: 'Report',
    });
    throw new NotImplementedException(
      'Report delivery is not implemented yet. The request was logged but no e-mail was sent.',
    );
  }
}
