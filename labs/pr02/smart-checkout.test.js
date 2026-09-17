import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

import { expect, it } from 'vitest';

const APP_PATH = resolve(process.cwd(), 'pr02-smart-checkout', 'app.js');

function loadCalculateCheckout() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(readFileSync(APP_PATH, 'utf8'), context, { filename: APP_PATH });
  expect(context.calculateCheckout).toEqual(expect.any(Function));
  return context.calculateCheckout;
}

function expectSuccess(result, expected) {
  expect(result).toMatchObject({ ok: true, ...expected });
}

function expectErrorWithoutThrow(calculateCheckout, ...args) {
  let result;
  expect(() => {
    result = calculateCheckout(...args);
  }).not.toThrow();
  expect(result).toMatchObject({ ok: false });
  expect(result.message).toEqual(expect.any(String));
  expect(result.message.trim().length).toBeGreaterThan(0);
}

it('pickup without a discount keeps a 500 UAH total', () => {
    const result = loadCalculateCheckout()(500, false, 'pickup');

    expectSuccess(result, {
      subtotal: 500,
      discountRate: 0,
      discountAmount: 0,
      discountedSubtotal: 500,
      deliveryFee: 0,
      total: 500,
    });
});

it('a student receives 5 percent before standard delivery', () => {
    const result = loadCalculateCheckout()(500, true, 'standard');

    expectSuccess(result, {
      discountRate: 0.05,
      discountAmount: 25,
      discountedSubtotal: 475,
      deliveryFee: 80,
      total: 555,
    });
});

it('a 1000 UAH order receives 10 percent and free standard delivery', () => {
    const result = loadCalculateCheckout()(1000, false, 'standard');

    expectSuccess(result, {
      discountRate: 0.1,
      discountAmount: 100,
      discountedSubtotal: 900,
      deliveryFee: 0,
      total: 900,
    });
});

it('express delivery stays 150 UAH and the stronger discount wins', () => {
    const result = loadCalculateCheckout()(1000, true, 'express');

    expectSuccess(result, {
      discountRate: 0.1,
      discountAmount: 100,
      deliveryFee: 150,
      total: 1050,
    });
});

it('the 1000 UAH discount boundary is inclusive', () => {
    const below = loadCalculateCheckout()(999.99, false, 'pickup');
    const boundary = loadCalculateCheckout()(1000, false, 'pickup');

    expectSuccess(below, { discountRate: 0, total: 999.99 });
    expectSuccess(boundary, { discountRate: 0.1, total: 900 });
});

it('standard delivery becomes free at a discounted subtotal of 750', () => {
    const result = loadCalculateCheckout()(750, false, 'standard');

    expectSuccess(result, {
      discountedSubtotal: 750,
      deliveryFee: 0,
      total: 750,
    });
});

it('invalid subtotal values return an error result without throwing', () => {
    const calculateCheckout = loadCalculateCheckout();

    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, '500']) {
      expectErrorWithoutThrow(calculateCheckout, value, false, 'pickup');
    }
});

it('invalid student or delivery values return an error result without throwing', () => {
    const calculateCheckout = loadCalculateCheckout();

    expectErrorWithoutThrow(calculateCheckout, 500, 'yes', 'pickup');
    expectErrorWithoutThrow(calculateCheckout, 500, false, 'drone');
});
