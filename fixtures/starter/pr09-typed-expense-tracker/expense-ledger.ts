export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'housing',
  'services',
  'other',
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export type Expense = {
  readonly id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  note?: string;
};

export type ExpenseLedger = {
  expenses: Expense[];
};

export type ExpenseFilters = {
  category?: ExpenseCategory;
  query?: string;
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
};

export type ExpenseSummary = {
  count: number;
  total: number;
  average: number;
  byCategory: Record<ExpenseCategory, number>;
};

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; kind: 'validation' | 'duplicate' | 'not-found'; message: string };

export function createExpenseLedger(_value: unknown): Result<ExpenseLedger> {
  throw new Error('TODO: implement createExpenseLedger');
}

export function addExpense(_ledger: unknown, _value: unknown): Result<ExpenseLedger> {
  throw new Error('TODO: implement addExpense');
}

export function removeExpense(_ledger: unknown, _id: unknown): Result<ExpenseLedger> {
  throw new Error('TODO: implement removeExpense');
}

export function filterExpenses(_ledger: unknown, _filters: unknown): Result<Expense[]> {
  throw new Error('TODO: implement filterExpenses');
}

export function summarizeExpenses(_ledger: unknown): Result<ExpenseSummary> {
  throw new Error('TODO: implement summarizeExpenses');
}
