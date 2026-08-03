import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: { companyId, ...dto } });
  }

  findAll(companyId: string, search?: string) {
    return this.prisma.customer.findMany({
      where: {
        companyId,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, companyId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(companyId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOne(companyId, id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  /** Total open (unpaid) receivable balance per customer — powers the "fiado" view. */
  async openBalances(companyId: string) {
    const grouped = await this.prisma.account.groupBy({
      by: ['customerId'],
      where: { companyId, type: 'RECEIVABLE', paid: false, customerId: { not: null } },
      _sum: { amount: true },
    });

    const customers = await this.prisma.customer.findMany({
      where: { companyId, id: { in: grouped.map((g) => g.customerId!).filter(Boolean) } },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));

    return grouped
      .map((g) => ({
        customer: byId.get(g.customerId!),
        totalOpen: g._sum.amount ?? 0,
      }))
      .filter((entry) => entry.customer)
      .sort((a, b) => Number(b.totalOpen) - Number(a.totalOpen));
  }
}
