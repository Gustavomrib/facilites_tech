import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountType, Recurrence } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateFixedExpenseDto } from './dto/create-fixed-expense.dto';

const INTERVAL_DAYS: Record<Recurrence, number> = {
  [Recurrence.WEEKLY]: 7,
  [Recurrence.MONTHLY]: 30,
};

@Injectable()
export class FixedExpensesService {
  private readonly logger = new Logger(FixedExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(companyId: string, userId: string, dto: CreateFixedExpenseDto) {
    const fixedExpense = await this.prisma.fixedExpense.create({
      data: { companyId, name: dto.name, amount: dto.amount, recurrence: dto.recurrence },
    });

    await this.auditLogsService.record({
      companyId,
      userId,
      action: 'fixed-expenses.create',
      entityType: 'FixedExpense',
      entityId: fixedExpense.id,
    });

    await this.generateNextIfNeeded(fixedExpense.id);
    return fixedExpense;
  }

  findAll(companyId: string) {
    return this.prisma.fixedExpense.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deactivate(companyId: string, id: string, userId: string) {
    const existing = await this.prisma.fixedExpense.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Fixed expense not found');

    const updated = await this.prisma.fixedExpense.update({
      where: { id },
      data: { active: false },
    });

    await this.auditLogsService.record({
      companyId,
      userId,
      action: 'fixed-expenses.deactivate',
      entityType: 'FixedExpense',
      entityId: id,
    });

    return updated;
  }

  /**
   * Ensures the next occurrence of a fixed expense exists as an open payable Account.
   * The next due date always advances from the PREVIOUS SCHEDULED due date
   * (`lastGeneratedDueDate`), never from "today" or the date the previous bill was
   * actually paid. This is the fix for the original frontend bug where a late payment
   * pushed every future occurrence forward by the same delay.
   */
  async generateNextIfNeeded(fixedExpenseId: string): Promise<void> {
    const expense = await this.prisma.fixedExpense.findUnique({ where: { id: fixedExpenseId } });
    if (!expense || !expense.active) return;

    const hasOpenAccount = await this.prisma.account.findFirst({
      where: { fixedExpenseId: expense.id, paid: false },
    });
    if (hasOpenAccount) return;

    const intervalDays = INTERVAL_DAYS[expense.recurrence];
    const base = expense.lastGeneratedDueDate ?? startOfToday();
    const nextDueDate = addDays(base, intervalDays);

    await this.prisma.$transaction([
      this.prisma.account.create({
        data: {
          companyId: expense.companyId,
          type: AccountType.PAYABLE,
          description: expense.name,
          amount: expense.amount,
          dueDate: nextDueDate,
          fixedExpenseId: expense.id,
        },
      }),
      this.prisma.fixedExpense.update({
        where: { id: expense.id },
        data: { lastGeneratedDueDate: nextDueDate },
      }),
    ]);
  }

  /** Daily sweep so occurrences are generated even without user interaction that day. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async generateAllPending(): Promise<void> {
    const activeExpenses = await this.prisma.fixedExpense.findMany({ where: { active: true } });
    this.logger.log(
      `Checking ${activeExpenses.length} active fixed expense(s) for next occurrence`,
    );
    for (const expense of activeExpenses) {
      await this.generateNextIfNeeded(expense.id);
    }
  }
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
