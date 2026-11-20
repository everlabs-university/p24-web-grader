import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, it } from 'vitest';

const MODULE_PATH = resolve(process.cwd(), 'pr09-typed-expense-tracker', 'expense-ledger.ts');
let importSequence = 0;

async function loadLedger() {
  const url = pathToFileURL(MODULE_PATH);
  url.searchParams.set('test', String(importSequence += 1));
  const module = await import(url.href);
  for (const name of [
    'createExpenseLedger',
    'addExpense',
    'removeExpense',
    'filterExpenses',
    'summarizeExpenses',
  ]) {
    expect(module[name]).toEqual(expect.any(Function));
  }
  return module;
}

const expense = (overrides = {}) => ({
  id: 'exp-1',
  title: 'Lunch',
  amount: 165,
  category: 'food',
  date: '2026-11-18',
  note: 'College cafe',
  ...overrides,
});

const ledgerValue = (expenses = []) => ({ expenses });

it('creates a validated ledger and clones every accepted expense', async () => {
  const { createExpenseLedger } = await loadLedger();
  const source = [
    expense({ title: '  Lunch  ', note: '  College cafe  ' }),
    expense({ id: 'exp-2', title: 'Bus', amount: 48, category: 'transport', note: undefined }),
  ];

  const result = createExpenseLedger(source);

  expect(result).toEqual({
    ok: true,
    value: ledgerValue([
      expense(),
      { id: 'exp-2', title: 'Bus', amount: 48, category: 'transport', date: '2026-11-18' },
    ]),
  });
  expect(result.value.expenses).not.toBe(source);
  expect(result.value.expenses[0]).not.toBe(source[0]);
});

it('rejects malformed expenses and invalid categories without throwing', async () => {
  const { createExpenseLedger } = await loadLedger();
  const invalid = [
    null,
    expense({ id: '' }),
    expense({ title: '   ' }),
    expense({ amount: 0 }),
    expense({ amount: Number.NaN }),
    expense({ category: 'travel' }),
    expense({ date: '18.11.2026' }),
    expense({ note: 42 }),
  ];

  for (const candidate of invalid) {
    expect(() => createExpenseLedger([candidate])).not.toThrow();
    expect(createExpenseLedger([candidate])).toMatchObject({ ok: false, kind: 'validation' });
  }
  expect(createExpenseLedger('not-an-array')).toMatchObject({ ok: false, kind: 'validation' });
});

it('adds a normalized expense immutably', async () => {
  const { addExpense } = await loadLedger();
  const source = ledgerValue([expense()]);
  const input = expense({
    id: 'exp-2',
    title: '  Bus  ',
    amount: 48,
    category: 'transport',
    note: '   ',
  });

  const result = addExpense(source, input);

  expect(result).toEqual({
    ok: true,
    value: ledgerValue([
      expense(),
      { id: 'exp-2', title: 'Bus', amount: 48, category: 'transport', date: '2026-11-18' },
    ]),
  });
  expect(source).toEqual(ledgerValue([expense()]));
  expect(result.value).not.toBe(source);
  expect(result.value.expenses).not.toBe(source.expenses);
});

it('rejects duplicate identifiers without changing the source ledger', async () => {
  const { addExpense } = await loadLedger();
  const source = ledgerValue([expense()]);

  const duplicate = addExpense(source, expense({ title: 'Another expense' }));
  const malformed = addExpense(source, expense({ id: 'exp-2', amount: -10 }));

  expect(duplicate).toMatchObject({ ok: false, kind: 'duplicate' });
  expect(malformed).toMatchObject({ ok: false, kind: 'validation' });
  expect(source).toEqual(ledgerValue([expense()]));
});

it('removes an existing expense immutably and reports unknown identifiers', async () => {
  const { removeExpense } = await loadLedger();
  const second = expense({ id: 'exp-2', title: 'Bus', amount: 48, category: 'transport' });
  const source = ledgerValue([expense(), second]);

  const removed = removeExpense(source, '  exp-1  ');
  const missing = removeExpense(source, 'missing');

  expect(removed).toEqual({ ok: true, value: ledgerValue([second]) });
  expect(removed.value.expenses).not.toBe(source.expenses);
  expect(missing).toMatchObject({ ok: false, kind: 'not-found' });
  expect(source).toEqual(ledgerValue([expense(), second]));
});

it('filters by category text amount and date without reordering the source', async () => {
  const { filterExpenses } = await loadLedger();
  const source = ledgerValue([
    expense({ id: 'exp-1', title: 'Lunch', amount: 165, category: 'food', date: '2026-11-18' }),
    expense({ id: 'exp-2', title: 'Bus pass', amount: 300, category: 'transport', date: '2026-11-10' }),
    expense({ id: 'exp-3', title: 'Coffee', amount: 75, category: 'food', date: '2026-11-20' }),
  ]);

  expect(filterExpenses(source, { category: 'food' })).toMatchObject({
    ok: true,
    value: [expect.objectContaining({ id: 'exp-1' }), expect.objectContaining({ id: 'exp-3' })],
  });
  expect(filterExpenses(source, { query: '  PASS ' })).toMatchObject({
    ok: true,
    value: [expect.objectContaining({ id: 'exp-2' })],
  });
  expect(filterExpenses(source, { minAmount: 100, maxAmount: 250 })).toMatchObject({
    ok: true,
    value: [expect.objectContaining({ id: 'exp-1' })],
  });
  expect(filterExpenses(source, { dateFrom: '2026-11-18', dateTo: '2026-11-20' })).toMatchObject({
    ok: true,
    value: [expect.objectContaining({ id: 'exp-1' }), expect.objectContaining({ id: 'exp-3' })],
  });
  expect(source.expenses.map(({ id }) => id)).toEqual(['exp-1', 'exp-2', 'exp-3']);
});

it('summarizes count total average and category totals exactly', async () => {
  const { summarizeExpenses } = await loadLedger();
  const source = ledgerValue([
    expense({ amount: 165, category: 'food' }),
    expense({ id: 'exp-2', amount: 48, category: 'transport' }),
    expense({ id: 'exp-3', amount: 75, category: 'food' }),
  ]);

  expect(summarizeExpenses(source)).toEqual({
    ok: true,
    value: {
      count: 3,
      total: 288,
      average: 96,
      byCategory: {
        food: 240,
        transport: 48,
        housing: 0,
        services: 0,
        other: 0,
      },
    },
  });
  expect(summarizeExpenses(ledgerValue([]))).toMatchObject({
    ok: true,
    value: { count: 0, total: 0, average: 0 },
  });
});

it('returns independent result objects across repeated operations', async () => {
  const { createExpenseLedger, filterExpenses, summarizeExpenses } = await loadLedger();
  const source = [expense()];

  const first = createExpenseLedger(source);
  const second = createExpenseLedger(source);
  const firstFilter = filterExpenses(first.value, {});
  const secondFilter = filterExpenses(first.value, {});
  const firstSummary = summarizeExpenses(first.value);
  const secondSummary = summarizeExpenses(first.value);

  expect(first).toEqual(second);
  expect(first).not.toBe(second);
  expect(first.value).not.toBe(second.value);
  expect(firstFilter.value).not.toBe(secondFilter.value);
  expect(firstFilter.value[0]).not.toBe(secondFilter.value[0]);
  expect(firstSummary.value).not.toBe(secondSummary.value);
  expect(firstSummary.value.byCategory).not.toBe(secondSummary.value.byCategory);
});
