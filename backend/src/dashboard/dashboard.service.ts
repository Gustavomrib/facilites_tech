import { Injectable } from '@nestjs/common';
import { AccountType, PaymentMethod, ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Everything the original frontend computed client-side from localStorage
   * (AppDataContext.tsx) now lives here, scoped by company and backed by the
   * database — the frontend just renders whatever this returns.
   */
  async summary(companyId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const today = startOfToday();
    const periodStart = company.dashboardPeriod === 'WEEK' ? addDays(today, -6) : today;

    const [sales, accounts, products] = await Promise.all([
      this.prisma.sale.findMany({ where: { companyId, date: { gte: addDays(today, -6) } } }),
      this.prisma.account.findMany({ where: { companyId } }),
      this.prisma.product.findMany({ where: { companyId } }),
    ]);

    const cashInflows = sales
      .filter((s) => s.paymentMethod !== PaymentMethod.STORE_CREDIT)
      .reduce((sum, s) => sum + saleTotal(s), 0);
    const receivedAccounts = accounts
      .filter((a) => a.type === AccountType.RECEIVABLE && a.paid)
      .reduce((sum, a) => sum + Number(a.amount), 0);
    const paidPayables = accounts
      .filter((a) => a.type === AccountType.PAYABLE && a.paid)
      .reduce((sum, a) => sum + Number(a.amount), 0);
    const cashBalance = cashInflows + receivedAccounts - paidPayables;

    const salesInPeriod = sales.filter((s) => toDateOnly(s.date) >= periodStart);
    const expensesInPeriod = accounts.filter(
      (a) =>
        a.type === AccountType.PAYABLE && a.paid && a.paidAt && toDateOnly(a.paidAt) >= periodStart,
    );

    const periodSales = salesInPeriod.reduce((sum, s) => sum + saleTotal(s), 0);
    const periodExpenses = expensesInPeriod.reduce((sum, a) => sum + Number(a.amount), 0);

    const productsById = new Map(products.map((p) => [p.id, p]));
    const estimatedProfitToday = sales
      .filter((s) => toDateOnly(s.date).getTime() === today.getTime() && s.productId)
      .reduce((sum, s) => {
        const product = productsById.get(s.productId!);
        if (!product || product.cost === null || product.cost === undefined) return sum;
        return sum + (Number(s.unitPrice) - Number(product.cost)) * s.quantity;
      }, 0);

    const payableToday = accounts.filter(
      (a) =>
        a.type === AccountType.PAYABLE &&
        !a.paid &&
        toDateOnly(a.dueDate).getTime() === today.getTime(),
    );
    const receivableOpen = accounts.filter((a) => a.type === AccountType.RECEIVABLE && !a.paid);
    const overduePayables = accounts.filter(
      (a) => a.type === AccountType.PAYABLE && !a.paid && toDateOnly(a.dueDate) < today,
    );
    const dueSoonPayables = accounts.filter((a) => {
      if (a.type !== AccountType.PAYABLE || a.paid) return false;
      const diff = daysBetween(today, toDateOnly(a.dueDate));
      return diff > 0 && diff <= 3;
    });
    const lowStockProducts = company.tracksInventory
      ? products.filter((p) => p.type === ProductType.PRODUCT && p.quantity <= p.minQuantity)
      : [];

    const last7Days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((day) => ({
      date: day.toISOString().slice(0, 10),
      total: sales
        .filter((s) => toDateOnly(s.date).getTime() === day.getTime())
        .reduce((sum, s) => sum + saleTotal(s), 0),
    }));

    return {
      cashBalance,
      todaySales: salesTotalOn(sales, today),
      periodSales,
      periodExpenses,
      estimatedProfitToday,
      dailySalesGoal: company.dailySalesGoal ? Number(company.dailySalesGoal) : null,
      payableTodayTotal: payableToday.reduce((sum, a) => sum + Number(a.amount), 0),
      receivableOpenTotal: receivableOpen.reduce((sum, a) => sum + Number(a.amount), 0),
      overduePayablesCount: overduePayables.length,
      overduePayablesTotal: overduePayables.reduce((sum, a) => sum + Number(a.amount), 0),
      dueSoonPayables,
      lowStockCount: lowStockProducts.length,
      totalNotifications: lowStockProducts.length + dueSoonPayables.length + overduePayables.length,
      last7Days,
    };
  }
}

function saleTotal(sale: { unitPrice: unknown; quantity: number }): number {
  return Number(sale.unitPrice) * sale.quantity;
}

function salesTotalOn(
  sales: { date: Date; unitPrice: unknown; quantity: number }[],
  day: Date,
): number {
  return sales
    .filter((s) => toDateOnly(s.date).getTime() === day.getTime())
    .reduce((sum, s) => sum + saleTotal(s), 0);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
