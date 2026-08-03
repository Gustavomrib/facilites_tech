import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(companyId: string, userId: string, dto: CreateSaleDto) {
    if (dto.paymentMethod === PaymentMethod.STORE_CREDIT && !dto.customerId) {
      throw new BadRequestException('customerId is required for STORE_CREDIT (fiado) sales');
    }

    const sale = await this.prisma.$transaction(async (tx) => {
      if (dto.productId) {
        const product = await tx.product.findFirst({ where: { id: dto.productId, companyId } });
        if (!product) throw new NotFoundException('Product not found');

        const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
        const tracksThisItem = company.tracksInventory && product.type === ProductType.PRODUCT;

        if (tracksThisItem) {
          // Atomic conditional decrement: guards against overselling under concurrent
          // checkouts (two cashiers selling the last unit at the same time). A plain
          // read-then-write from the app layer would have a race window; this doesn't.
          const affected = await tx.$executeRaw`
            UPDATE "products"
            SET quantity = quantity - ${dto.quantity}
            WHERE id = ${dto.productId}
              AND "companyId" = ${companyId}
              AND quantity >= ${dto.quantity}
          `;
          if (affected === 0) {
            throw new ConflictException(
              `Insufficient stock for "${product.name}" (available: ${product.quantity})`,
            );
          }
        }
      }

      if (dto.customerId) {
        const customer = await tx.customer.findFirst({ where: { id: dto.customerId, companyId } });
        if (!customer) throw new NotFoundException('Customer not found');
      }

      const createdSale = await tx.sale.create({
        data: {
          companyId,
          date: new Date(dto.date),
          description: dto.description,
          quantity: dto.quantity,
          unitPrice: dto.unitPrice,
          paymentMethod: dto.paymentMethod,
          productId: dto.productId,
          customerId: dto.paymentMethod === PaymentMethod.STORE_CREDIT ? dto.customerId : undefined,
          createdByUserId: userId,
        },
      });

      if (dto.paymentMethod === PaymentMethod.STORE_CREDIT) {
        await tx.account.create({
          data: {
            companyId,
            type: 'RECEIVABLE',
            description: dto.description,
            amount: dto.quantity * dto.unitPrice,
            dueDate: new Date(dto.date),
            originSaleId: createdSale.id,
            customerId: dto.customerId,
          },
        });
      }

      return createdSale;
    });

    await this.auditLogsService.record({
      companyId,
      userId,
      action: 'sales.create',
      entityType: 'Sale',
      entityId: sale.id,
      metadata: { paymentMethod: sale.paymentMethod, total: dto.quantity * dto.unitPrice },
    });

    return this.findOne(companyId, sale.id);
  }

  findAll(companyId: string, from?: string, to?: string) {
    return this.prisma.sale.findMany({
      where: {
        companyId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: { product: true, customer: true, account: true },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, companyId },
      include: { product: true, customer: true, account: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }
}
