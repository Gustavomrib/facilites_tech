import { Injectable } from '@nestjs/common';
import { AccountType, PaymentMethod, ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { addUTCDays, daysBetweenUTC, startOfUTCDay, toUTCDateOnly } from '../common/date.util';

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
    const periodStart = company.dashboardPeriod === 'WEEK' ? addUTCDays(today, -6) : today;

    const [sales, accounts, products] = await Promise.all([
      this.prisma.sale.findMany({
        where: { companyId, date: { gte: addUTCDays(today, -6), lt: addUTCDays(today, 1) } },
      }),
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

    // Business rule: a STORE_CREDIT ("fiado") sale never moves cash on the day it's
    // booked — it only creates a RECEIVABLE. So cash-oriented metrics (period sales,
    // today's cash in, the 7-day chart) must exclude it; the pending amounts live on
    // the "A Receber" side (receivableOpen / receivableOpenTotal), and they only count
    // as cash when the receivable is actually settled.
    const salesInPeriod = sales.filter(
      (s) => toUTCDateOnly(s.date) >= periodStart && s.paymentMethod !== PaymentMethod.STORE_CREDIT,
    );
    const expensesInPeriod = accounts.filter(
      (a) =>
        a.type === AccountType.PAYABLE && a.paid && a.paidAt && toUTCDateOnly(a.paidAt) >= periodStart,
    );

    const periodSales = salesInPeriod.reduce((sum, s) => sum + saleTotal(s), 0);
    const periodExpenses = expensesInPeriod.reduce((sum, a) => sum + Number(a.amount), 0);

    // "Entrada do Dia": sales settled at the point of purchase (no fiado) plus the
    // store-credit debts (RECEIVABLE) actually received today.
    const todaySales = sales
      .filter(
        (s) =>
          toUTCDateOnly(s.date).getTime() === today.getTime() &&
          s.paymentMethod !== PaymentMethod.STORE_CREDIT,
      )
      .reduce((sum, s) => sum + saleTotal(s), 0);
    const receivablesReceivedToday = accounts
      .filter(
        (a) =>
          a.type === AccountType.RECEIVABLE &&
          a.paid &&
          a.paidAt &&
          toUTCDateOnly(a.paidAt).getTime() === today.getTime(),
      )
      .reduce((sum, a) => sum + Number(a.amount), 0);
    const todayCashIn = todaySales + receivablesReceivedToday;

    const productsById = new Map(products.map((p) => [p.id, p]));
    const estimatedProfitToday = sales
      .filter((s) => toUTCDateOnly(s.date).getTime() === today.getTime() && s.productId)
      .reduce((sum, s) => {
        const product = productsById.get(s.productId!);
        if (!product || product.cost === null || product.cost === undefined) return sum;
        return sum + (Number(s.unitPrice) - Number(product.cost)) * s.quantity;
      }, 0);

    const payableToday = accounts.filter(
      (a) =>
        a.type === AccountType.PAYABLE &&
        !a.paid &&
        toUTCDateOnly(a.dueDate).getTime() === today.getTime(),
    );
    const receivableOpen = accounts.filter((a) => a.type === AccountType.RECEIVABLE && !a.paid);
    const overduePayables = accounts.filter(
      (a) => a.type === AccountType.PAYABLE && !a.paid && toUTCDateOnly(a.dueDate) < today,
    );
    const dueSoonPayables = accounts.filter((a) => {
      if (a.type !== AccountType.PAYABLE || a.paid) return false;
      const diff = daysBetweenUTC(today, toUTCDateOnly(a.dueDate));
      return diff > 0 && diff <= 3;
    });
    const lowStockProducts = company.tracksInventory
      ? products.filter((p) => p.type === ProductType.PRODUCT && p.quantity <= p.minQuantity)
      : [];

    const last7Days = Array.from({ length: 7 }, (_, i) => addUTCDays(today, i - 6)).map((day) => ({
      date: day.toISOString().slice(0, 10),
      total: sales
        .filter(
          (s) =>
            toUTCDateOnly(s.date).getTime() === day.getTime() &&
            s.paymentMethod !== PaymentMethod.STORE_CREDIT,
        )
        .reduce((sum, s) => sum + saleTotal(s), 0),
    }));

    return {
      cashBalance,
      todaySales,
      receivablesReceivedToday,
      todayCashIn,
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

function startOfToday(): Date {
  return startOfUTCDay();
}
