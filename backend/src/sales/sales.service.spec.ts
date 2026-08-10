import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PaymentMethod, ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { SalesService } from './sales.service';

describe('SalesService — stock and fiado rules', () => {
  let service: SalesService;
  let tx: {
    product: { findFirst: jest.Mock };
    company: { findUniqueOrThrow: jest.Mock };
    customer: { findFirst: jest.Mock };
    sale: { create: jest.Mock };
    account: { create: jest.Mock };
    $executeRaw: jest.Mock;
  };
  let prisma: { $transaction: jest.Mock; sale: { findFirst: jest.Mock } };

  const baseProduct = {
    id: 'prod-1',
    companyId: 'company-1',
    name: 'Coca-Cola 2L',
    type: ProductType.PRODUCT,
    quantity: 5,
  };

  beforeEach(async () => {
    tx = {
      product: { findFirst: jest.fn().mockResolvedValue(baseProduct) },
      company: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'company-1', tracksInventory: true }),
      },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'cust-1' }) },
      sale: {
        create: jest.fn().mockResolvedValue({ id: 'sale-1', paymentMethod: PaymentMethod.CASH }),
      },
      account: { create: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    prisma = {
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
      sale: { findFirst: jest.fn().mockResolvedValue({ id: 'sale-1' }) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(SalesService);
  });

  it('decrements stock atomically when a tracked product is sold', async () => {
    await service.create('company-1', 'user-1', {
      date: '2026-08-02',
      description: 'Coca-Cola 2L',
      quantity: 2,
      unitPrice: 9.9,
      paymentMethod: PaymentMethod.CASH,
      productId: 'prod-1',
    });

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.account.create).not.toHaveBeenCalled();
  });

  it('rejects the sale when the atomic stock decrement affects zero rows (insufficient stock)', async () => {
    tx.$executeRaw.mockResolvedValue(0);

    await expect(
      service.create('company-1', 'user-1', {
        date: '2026-08-02',
        description: 'Coca-Cola 2L',
        quantity: 99,
        unitPrice: 9.9,
        paymentMethod: PaymentMethod.CASH,
        productId: 'prod-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.sale.create).not.toHaveBeenCalled();
  });

  it('does not touch stock for a SERVICE product even if the company tracks inventory', async () => {
    tx.product.findFirst.mockResolvedValue({ ...baseProduct, type: ProductType.SERVICE });

    await service.create('company-1', 'user-1', {
      date: '2026-08-02',
      description: 'Corte de Cabelo',
      quantity: 1,
      unitPrice: 40,
      paymentMethod: PaymentMethod.CASH,
      productId: 'prod-1',
    });

    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('creates a linked receivable account when the sale is STORE_CREDIT ("fiado")', async () => {
    await service.create('company-1', 'user-1', {
      date: '2026-08-02',
      description: 'Compras da semana',
      quantity: 1,
      unitPrice: 50,
      paymentMethod: PaymentMethod.STORE_CREDIT,
      customerId: 'cust-1',
    });

    expect(tx.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'RECEIVABLE',
          customerId: 'cust-1',
          amount: 50,
        }),
      }),
    );
  });
});
