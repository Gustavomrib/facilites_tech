import { Test } from '@nestjs/testing';
import { AccountType, Recurrence } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FixedExpensesService } from './fixed-expenses.service';

describe('FixedExpensesService - recurrence correctness', () => {
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

  it('advances monthly expenses by calendar month while preserving the preferred day', async () => {
    prisma.fixedExpense.findUnique.mockResolvedValue({
      id: 'fe-1',
      companyId: 'company-1',
      name: 'Aluguel',
      amount: 900,
      recurrence: Recurrence.MONTHLY,
      active: true,
      dayOfMonth: 5,
      lastGeneratedDueDate: new Date('2026-07-05T00:00:00.000Z'),
    });
    prisma.account.findFirst.mockResolvedValue(null);

    await service.generateNextIfNeeded('fe-1');

    const createCall = prisma.account.create.mock.calls[0][0];
    expect(createCall.data.dueDate.toISOString().slice(0, 10)).toBe('2026-08-05');
    expect(createCall.data.type).toBe(AccountType.PAYABLE);

    const updateCall = prisma.fixedExpense.update.mock.calls[0][0];
    expect(updateCall.data.lastGeneratedDueDate.toISOString().slice(0, 10)).toBe('2026-08-05');
  });

  it('uses the last day of the month when the preferred day does not exist', async () => {
    prisma.fixedExpense.findUnique.mockResolvedValue({
      id: 'fe-1',
      companyId: 'company-1',
      name: 'Aluguel',
      amount: 900,
      recurrence: Recurrence.MONTHLY,
      active: true,
      dayOfMonth: 31,
      lastGeneratedDueDate: new Date('2025-01-31T00:00:00.000Z'),
    });
    prisma.account.findFirst.mockResolvedValue(null);

    await service.generateNextIfNeeded('fe-1');

    const createCall = prisma.account.create.mock.calls[0][0];
    expect(createCall.data.dueDate.toISOString().slice(0, 10)).toBe('2025-02-28');
  });

  it('keeps the original preferred day after a short-month clamp', async () => {
    prisma.fixedExpense.findUnique.mockResolvedValue({
      id: 'fe-1',
      companyId: 'company-1',
      name: 'Aluguel',
      amount: 900,
      recurrence: Recurrence.MONTHLY,
      active: true,
      dayOfMonth: 31,
      lastGeneratedDueDate: new Date('2025-02-28T00:00:00.000Z'),
    });
    prisma.account.findFirst.mockResolvedValue(null);

    await service.generateNextIfNeeded('fe-1');

    const createCall = prisma.account.create.mock.calls[0][0];
    expect(createCall.data.dueDate.toISOString().slice(0, 10)).toBe('2025-03-31');
  });

  it('does not create a duplicate occurrence while one is still open (unpaid)', async () => {
    prisma.fixedExpense.findUnique.mockResolvedValue({
      id: 'fe-1',
      companyId: 'company-1',
      name: 'Aluguel',
      amount: 900,
      recurrence: Recurrence.MONTHLY,
      active: true,
      dayOfMonth: 5,
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
