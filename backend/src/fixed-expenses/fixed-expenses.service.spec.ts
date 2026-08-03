import { Test } from '@nestjs/testing';
import { AccountType, Recurrence } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FixedExpensesService } from './fixed-expenses.service';

describe('FixedExpensesService — recurrence correctness', () => {
  let service: FixedExpensesService;
  let prisma: {
    fixedExpense: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    account: { findFirst: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      fixedExpense: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      account: { findFirst: jest.fn(), create: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FixedExpensesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(FixedExpensesService);
  });

  it('anchors the next due date on the previous SCHEDULED due date, not on today', async () => {
    // Rent due on the 5th (represented here as day 5 of a fixed epoch), monthly.
    const previousDueDate = new Date('2026-07-05T00:00:00.000Z');

    prisma.fixedExpense.findUnique.mockResolvedValue({
      id: 'fe-1',
      companyId: 'company-1',
      name: 'Aluguel',
      amount: 900,
      recurrence: Recurrence.MONTHLY,
      active: true,
      lastGeneratedDueDate: previousDueDate,
    });
    prisma.account.findFirst.mockResolvedValue(null); // no open bill pending

    await service.generateNextIfNeeded('fe-1');

    const createCall = prisma.account.create.mock.calls[0][0];
    expect(createCall.data.dueDate.toISOString().slice(0, 10)).toBe('2026-08-04');
    // 30 days after 2026-07-05, NOT 30 days after "today" — a late payment must never
    // push this date forward.
    expect(createCall.data.type).toBe(AccountType.PAYABLE);

    const updateCall = prisma.fixedExpense.update.mock.calls[0][0];
    expect(updateCall.data.lastGeneratedDueDate.toISOString().slice(0, 10)).toBe('2026-08-04');
  });

  it('does not create a duplicate occurrence while one is still open (unpaid)', async () => {
    prisma.fixedExpense.findUnique.mockResolvedValue({
      id: 'fe-1',
      companyId: 'company-1',
      name: 'Aluguel',
      amount: 900,
      recurrence: Recurrence.MONTHLY,
      active: true,
      lastGeneratedDueDate: new Date('2026-07-05T00:00:00.000Z'),
    });
    prisma.account.findFirst.mockResolvedValue({ id: 'existing-open-account' });

    await service.generateNextIfNeeded('fe-1');

    expect(prisma.account.create).not.toHaveBeenCalled();
    expect(prisma.fixedExpense.update).not.toHaveBeenCalled();
  });

  it('skips inactive fixed expenses entirely', async () => {
    prisma.fixedExpense.findUnique.mockResolvedValue({
      id: 'fe-1',
      active: false,
    });

    await service.generateNextIfNeeded('fe-1');

    expect(prisma.account.findFirst).not.toHaveBeenCalled();
    expect(prisma.account.create).not.toHaveBeenCalled();
  });
});
