import { Test } from '@nestjs/testing';
import { AccountType, PaymentMethod, ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService — cash balance', () => {
  let service: DashboardService;
  let prisma: {
    company: { findUniqueOrThrow: jest.Mock };
    sale: { findMany: jest.Mock };
    account: { findMany: jest.Mock };
    product: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      company: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'company-1',
          dashboardPeriod: 'DAY',
          tracksInventory: true,
          dailySalesGoal: null,
        }),
      },
      sale: { findMany: jest.fn().mockResolvedValue([]) },
      account: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  it('excludes STORE_CREDIT (fiado) sales from cash inflow until the receivable is actually settled', async () => {
    const today = new Date();
    const isoToday = today.toISOString().slice(0, 10);

    prisma.sale.findMany.mockResolvedValue([
      {
        id: 's1',
        date: new Date(isoToday),
        unitPrice: 100,
        quantity: 1,
        paymentMethod: PaymentMethod.CASH,
        productId: null,
      },
      {
        id: 's2',
        date: new Date(isoToday),
        unitPrice: 200,
        quantity: 1,
        paymentMethod: PaymentMethod.STORE_CREDIT,
        productId: null,
      },
    ]);

    const summary = await service.summary('company-1');

    // Only the CASH sale counts as available cash; the fiado sale doesn't until paid.
    expect(summary.cashBalance).toBe(100);
  });

  it('adds a receivable to cash only once it is marked paid', async () => {
    const today = new Date();
    const isoToday = today.toISOString().slice(0, 10);

    prisma.account.findMany.mockResolvedValue([
      {
        id: 'a1',
        type: AccountType.RECEIVABLE,
        paid: true,
        paidAt: new Date(isoToday),
        amount: 75,
        dueDate: new Date(isoToday),
      },
    ]);

    const summary = await service.summary('company-1');

    expect(summary.cashBalance).toBe(75);
  });

  it('subtracts settled payables from the cash balance', async () => {
    const today = new Date();
    const isoToday = today.toISOString().slice(0, 10);

    prisma.account.findMany.mockResolvedValue([
      {
        id: 'a1',
        type: AccountType.PAYABLE,
        paid: true,
        paidAt: new Date(isoToday),
        amount: 30,
        dueDate: new Date(isoToday),
      },
    ]);

    const summary = await service.summary('company-1');

    expect(summary.cashBalance).toBe(-30);
  });

  it('excludes services from the low-stock count even at zero quantity', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', type: ProductType.SERVICE, quantity: 0, minQuantity: 0 },
      { id: 'p2', type: ProductType.PRODUCT, quantity: 0, minQuantity: 5 },
    ]);

    const summary = await service.summary('company-1');

    expect(summary.lowStockCount).toBe(1);
  });
});
