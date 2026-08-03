import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FixedExpensesService } from '../fixed-expenses/fixed-expenses.service';
import { CreatePayableDto } from './dto/create-payable.dto';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly fixedExpensesService: FixedExpensesService,
  ) {}

  async createPayable(companyId: string, userId: string, dto: CreatePayableDto) {
    const account = await this.prisma.account.create({
      data: {
        companyId,
        type: AccountType.PAYABLE,
        description: dto.description,
        amount: dto.amount,
        dueDate: new Date(dto.dueDate),
      },
    });

    await this.auditLogsService.record({
      companyId,
      userId,
      action: 'accounts.create',
      entityType: 'Account',
      entityId: account.id,
    });

    return account;
  }

  findAll(companyId: string, type: AccountType) {
    return this.prisma.account.findMany({
      where: { companyId, type },
      include: { customer: true },
      orderBy: { dueDate: 'asc' },
    });
  }

  findOverdue(companyId: string, type: AccountType) {
    return this.prisma.account.findMany({
      where: { companyId, type, paid: false, dueDate: { lt: startOfToday() } },
      orderBy: { dueDate: 'asc' },
    });
  }

  findDueSoon(companyId: string, type: AccountType, days = 3) {
    const today = startOfToday();
    const limit = new Date(today);
    limit.setDate(limit.getDate() + days);
    return this.prisma.account.findMany({
      where: { companyId, type, paid: false, dueDate: { gt: today, lte: limit } },
      orderBy: { dueDate: 'asc' },
    });
  }

  async settle(companyId: string, id: string, userId: string, paidAt?: string) {
    const account = await this.prisma.account.findFirst({ where: { id, companyId } });
    if (!account) throw new NotFoundException('Account not found');
    if (account.paid) throw new BadRequestException('Account is already settled');

    const updated = await this.prisma.account.update({
      where: { id },
      data: { paid: true, paidAt: paidAt ? new Date(paidAt) : new Date() },
    });

    await this.auditLogsService.record({
      companyId,
      userId,
      action: 'accounts.settle',
      entityType: 'Account',
      entityId: id,
    });

    if (updated.fixedExpenseId) {
      await this.fixedExpensesService.generateNextIfNeeded(updated.fixedExpenseId);
    }

    return updated;
  }
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
