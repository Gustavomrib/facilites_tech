// Shapes exactly as the NestJS backend returns/expects them (English fields, enum values
// matching prisma/schema.prisma). Kept separate from src/types.ts, which stays the
// frontend's own vocabulary (Portuguese) — src/api/mappers.ts converts between the two so
// pages never need to know the backend speaks a different language.

export type BackendRole = 'OWNER' | 'ADMIN' | 'STAFF';
export type BackendOffering = 'PRODUCTS' | 'SERVICES' | 'BOTH';
export type BackendDashboardPeriod = 'DAY' | 'WEEK';
export type BackendReportFrequency = 'NONE' | 'WEEKLY' | 'MONTHLY' | 'BOTH';
export type BackendProductType = 'PRODUCT' | 'SERVICE';
export type BackendPaymentMethod = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'STORE_CREDIT';
export type BackendAccountType = 'PAYABLE' | 'RECEIVABLE';
export type BackendRecurrence = 'WEEKLY' | 'MONTHLY';

export interface BackendUser {
  id: string;
  companyId: string;
  role: BackendRole;
  email: string;
}

export interface BackendSession {
  accessToken: string;
  user: BackendUser;
}

export interface BackendCompany {
  id: string;
  name: string;
  sector: string | null;
  offering: BackendOffering;
  tracksInventory: boolean;
  dailySalesGoal: string | null;
  dashboardPeriod: BackendDashboardPeriod;
  reportFrequency: BackendReportFrequency;
  reportByEmail: boolean;
  reportEmail: string | null;
  onboardingCompleted: boolean;
}

export interface BackendCustomer {
  id: string;
  name: string;
  phone: string | null;
}

export interface BackendProduct {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  type: BackendProductType;
  quantity: number;
  minQuantity: number;
  salePrice: string;
  cost: string | null;
}

export interface BackendSale {
  id: string;
  date: string;
  description: string;
  quantity: number;
  unitPrice: string;
  paymentMethod: BackendPaymentMethod;
  productId: string | null;
  customerId: string | null;
  product?: BackendProduct | null;
}

export interface BackendAccount {
  id: string;
  type: BackendAccountType;
  description: string;
  amount: string;
  dueDate: string;
  paid: boolean;
  paidAt: string | null;
  originSaleId: string | null;
  customerId: string | null;
  fixedExpenseId: string | null;
  customer?: BackendCustomer | null;
}

export interface BackendFixedExpense {
  id: string;
  name: string;
  amount: string;
  recurrence: BackendRecurrence;
  active: boolean;
}

export interface BackendDashboardSummary {
  cashBalance: number;
  todaySales: number;
  periodSales: number;
  periodExpenses: number;
  estimatedProfitToday: number;
  dailySalesGoal: number | null;
  payableTodayTotal: number;
  receivableOpenTotal: number;
  overduePayablesCount: number;
  overduePayablesTotal: number;
  dueSoonPayables: BackendAccount[];
  lowStockCount: number;
  totalNotifications: number;
  last7Days: { date: string; total: number }[];
}
