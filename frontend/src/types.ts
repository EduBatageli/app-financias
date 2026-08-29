export type Tab = 'dashboard' | 'invoices' | 'investments' | 'goals' | 'accounts';
export type ModalKind = 'expense' | 'expenseEdit' | 'account' | 'accountEdit' | 'invoice' | 'pay' | 'investment' | 'investmentEdit' | 'investmentMovement' | 'investmentValue' | 'goal' | 'contribution' | null;

export interface Account {
  id: number; name: string; kind: 'credit' | 'bank'; balance: number;
  creditLimit: number; color: string; active: boolean;
}

export interface Invoice {
  id: number; accountId: number; accountName: string; startDate: string;
  endDate: string; dueDate: string; status: 'open' | 'paid' | 'overdue' | 'cancelled';
  paidAt?: string; total: number; creditLimit: number; outstandingTotal?: number; expenseCount?: number;
}

export interface InvoiceExpense extends Expense {
  invoiceInstallment: number; invoiceAmount: number; invoicePaid: boolean;
}

export interface Expense {
  id: number; accountId: number; description: string; category: string; totalAmount: number;
  purchaseDate: string; accountName: string; installments: number; currentInstallment: number;
  paidInstallments: number; remainingInstallments: number;
  document?: { id: number; originalName: string; sizeBytes: number; status: 'stored' | 'processing' | 'processed' | 'failed' } | null;
  installmentsDetail?: Array<{ number: number; total: number; amount: number; projectedDate: string; invoiceId: number | null; paid: boolean }>;
}

export interface Projection { month: string; total: number; installments: number }
export interface Investment { id: number; name: string; type: string; investedAmount: number; currentAmount: number; updatedAt?: string }
export interface Goal { id: number; name: string; targetAmount: number; currentAmount: number; deadline?: string; color: string }

export interface DashboardData {
  summary: { accountBalance: number; investments: number; goalsSaved: number; netWorth: number };
  currentInvoice: Invoice | null;
  recentExpenses: Expense[];
  monthlySpending: Array<{ month: string; total: number }>;
}

export interface AppData {
  dashboard: DashboardData;
  accounts: Account[];
  invoices: Invoice[];
  expenses: Expense[];
  projections: Projection[];
  investments: Investment[];
  goals: Goal[];
}
