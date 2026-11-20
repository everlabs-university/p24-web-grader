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

function failure(kind: 'validation' | 'duplicate' | 'not-found', message: string): Result<never> {
  return { ok: false, kind, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCategory(value: unknown): value is ExpenseCategory {
  return typeof value === 'string'
    && (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function cloneExpense(expense: Expense): Expense {
  return expense.note === undefined ? { ...expense } : { ...expense, note: expense.note };
}

function normalizeExpense(value: unknown): Result<Expense> {
  if (!isRecord(value)) return failure('validation', 'Expense must be an object.');

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const note = typeof value.note === 'string' ? value.note.trim() : value.note;

  if (id === '') return failure('validation', 'Expense id is required.');
  if (title === '') return failure('validation', 'Expense title is required.');
  if (typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount <= 0) {
    return failure('validation', 'Expense amount must be a positive finite number.');
  }
  if (!isCategory(value.category)) return failure('validation', 'Expense category is invalid.');
  if (!isIsoDate(value.date)) return failure('validation', 'Expense date must use YYYY-MM-DD.');
  if (note !== undefined && typeof note !== 'string') {
    return failure('validation', 'Expense note must be a string when supplied.');
  }

  const normalized: Expense = {
    id,
    title,
    amount: value.amount,
    category: value.category,
    date: value.date,
  };
  if (typeof note === 'string' && note !== '') normalized.note = note;
  return { ok: true, value: normalized };
}

function normalizeLedger(value: unknown): Result<ExpenseLedger> {
  if (!isRecord(value) || !Array.isArray(value.expenses)) {
    return failure('validation', 'Ledger must contain an expenses array.');
  }
  return createExpenseLedger(value.expenses);
}

export function createExpenseLedger(value: unknown): Result<ExpenseLedger> {
  if (!Array.isArray(value)) return failure('validation', 'Expenses must be an array.');

  const expenses: Expense[] = [];
  const ids = new Set<string>();
  for (const candidate of value) {
    const result = normalizeExpense(candidate);
    if (!result.ok) return result;
    if (ids.has(result.value.id)) return failure('duplicate', 'Expense ids must be unique.');
    ids.add(result.value.id);
    expenses.push(cloneExpense(result.value));
  }
  return { ok: true, value: { expenses } };
}

export function addExpense(ledger: unknown, value: unknown): Result<ExpenseLedger> {
  const source = normalizeLedger(ledger);
  if (!source.ok) return source;
  const expense = normalizeExpense(value);
  if (!expense.ok) return expense;
  if (source.value.expenses.some(({ id }) => id === expense.value.id)) {
    return failure('duplicate', `Expense ${expense.value.id} already exists.`);
  }
  return {
    ok: true,
    value: {
      expenses: [...source.value.expenses.map(cloneExpense), cloneExpense(expense.value)],
    },
  };
}

export function removeExpense(ledger: unknown, id: unknown): Result<ExpenseLedger> {
  const source = normalizeLedger(ledger);
  if (!source.ok) return source;
  const normalizedId = typeof id === 'string' ? id.trim() : '';
  if (normalizedId === '') return failure('validation', 'Expense id is required.');
  if (!source.value.expenses.some((expense) => expense.id === normalizedId)) {
    return failure('not-found', `Expense ${normalizedId} was not found.`);
  }
  return {
    ok: true,
    value: {
      expenses: source.value.expenses
        .filter((expense) => expense.id !== normalizedId)
        .map(cloneExpense),
    },
  };
}

function normalizeFilters(value: unknown): Result<ExpenseFilters> {
  if (!isRecord(value)) return failure('validation', 'Filters must be an object.');
  if (value.category !== undefined && !isCategory(value.category)) {
    return failure('validation', 'Filter category is invalid.');
  }
  if (value.query !== undefined && typeof value.query !== 'string') {
    return failure('validation', 'Filter query must be a string.');
  }
  for (const key of ['minAmount', 'maxAmount'] as const) {
    const candidate = value[key];
    if (candidate !== undefined && (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < 0)) {
      return failure('validation', `${key} must be a non-negative finite number.`);
    }
  }
  for (const key of ['dateFrom', 'dateTo'] as const) {
    const candidate = value[key];
    if (candidate !== undefined && !isIsoDate(candidate)) {
      return failure('validation', `${key} must use YYYY-MM-DD.`);
    }
  }
  if (
    typeof value.minAmount === 'number'
    && typeof value.maxAmount === 'number'
    && value.minAmount > value.maxAmount
  ) {
    return failure('validation', 'Minimum amount cannot exceed maximum amount.');
  }
  if (typeof value.dateFrom === 'string' && typeof value.dateTo === 'string' && value.dateFrom > value.dateTo) {
    return failure('validation', 'Start date cannot be after end date.');
  }
  return {
    ok: true,
    value: {
      category: value.category as ExpenseCategory | undefined,
      query: typeof value.query === 'string' ? value.query.trim().toLowerCase() : undefined,
      minAmount: value.minAmount as number | undefined,
      maxAmount: value.maxAmount as number | undefined,
      dateFrom: value.dateFrom as string | undefined,
      dateTo: value.dateTo as string | undefined,
    },
  };
}

export function filterExpenses(ledger: unknown, value: unknown): Result<Expense[]> {
  const source = normalizeLedger(ledger);
  if (!source.ok) return source;
  const filters = normalizeFilters(value);
  if (!filters.ok) return filters;
  const { category, query, minAmount, maxAmount, dateFrom, dateTo } = filters.value;
  const expenses = source.value.expenses.filter((expense) => {
    if (category !== undefined && expense.category !== category) return false;
    if (query !== undefined && query !== '' && !expense.title.toLowerCase().includes(query)) return false;
    if (minAmount !== undefined && expense.amount < minAmount) return false;
    if (maxAmount !== undefined && expense.amount > maxAmount) return false;
    if (dateFrom !== undefined && expense.date < dateFrom) return false;
    if (dateTo !== undefined && expense.date > dateTo) return false;
    return true;
  });
  return { ok: true, value: expenses.map(cloneExpense) };
}

export function summarizeExpenses(ledger: unknown): Result<ExpenseSummary> {
  const source = normalizeLedger(ledger);
  if (!source.ok) return source;
  const byCategory: Record<ExpenseCategory, number> = {
    food: 0,
    transport: 0,
    housing: 0,
    services: 0,
    other: 0,
  };
  let total = 0;
  for (const expense of source.value.expenses) {
    total += expense.amount;
    byCategory[expense.category] += expense.amount;
  }
  const count = source.value.expenses.length;
  return {
    ok: true,
    value: {
      count,
      total,
      average: count === 0 ? 0 : total / count,
      byCategory: { ...byCategory },
    },
  };
}
