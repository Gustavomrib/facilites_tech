import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findMine(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(companyId: string, userId: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.update({ where: { id: companyId }, data: dto });
    await this.auditLogsService.record({
      companyId,
      userId,
      action: 'company.update',
      entityType: 'Company',
      entityId: companyId,
      metadata: dto as Record<string, unknown>,
    });
    return company;
  }
}
