import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { expect, it } from 'vitest';

const CART_PATH = resolve(process.cwd(), 'pr05-modular-shopping-cart', 'cart.js');
let importSequence = 0;

async function loadCartModule() {
  const url = pathToFileURL(CART_PATH);
  url.searchParams.set('test', String(importSequence += 1));
  const module = await import(url.href);
  expect(module.addToCart).toEqual(expect.any(Function));
  expect(module.removeFromCart).toEqual(expect.any(Function));
  expect(module.getCartSummary).toEqual(expect.any(Function));
  return module;
}

function cartFixture() {
  return [
    { id: 'book-js', name: 'JavaScript Guide', category: 'books', price: 400, stock: 5, quantity: 2 },
    { id: 'mouse', name: 'Gaming Mouse', category: 'tech', price: 800, stock: 3, quantity: 1 },
  ];
}

function productFixture() {
  return { id: 'headphones', name: 'Headphones', category: 'tech', price: 600, stock: 4 };
}

function expectErrorWithoutThrow(callback) {
  let result;
  expect(() => { result = callback(); }).not.toThrow();
  expect(result).toMatchObject({ ok: false });
  expect(result.message).toEqual(expect.any(String));
  expect(result.message.trim().length).toBeGreaterThan(0);
}

it('adding a new product creates a normalized line without mutating inputs', async () => {
  const { addToCart } = await loadCartModule();
  const cart = cartFixture();
  const product = productFixture();
  const beforeCart = JSON.stringify(cart);
  const beforeProduct = JSON.stringify(product);

  const result = addToCart(cart, product, 2);

  expect(result.ok).toBe(true);
  expect(result.cart).toEqual([
    ...cart,
    { ...product, quantity: 2 },
  ]);
  expect(JSON.stringify(cart)).toBe(beforeCart);
  expect(JSON.stringify(product)).toBe(beforeProduct);
  expect(result.cart).not.toBe(cart);
  expect(result.cart.at(-1)).not.toBe(product);
});

it('adding an existing product merges quantities in the original line order', async () => {
  const { addToCart } = await loadCartModule();
  const cart = cartFixture();
  const result = addToCart(cart, { id: 'book-js', name: 'JavaScript Guide', category: 'books', price: 400, stock: 5 }, 2);

  expect(result.ok).toBe(true);
  expect(result.cart.map(({ id }) => id)).toEqual(['book-js', 'mouse']);
  expect(result.cart[0]).toEqual({
    id: 'book-js', name: 'JavaScript Guide', category: 'books', price: 400, stock: 5, quantity: 4,
  });
  expect(cart[0].quantity).toBe(2);
  expect(result.cart[0]).not.toBe(cart[0]);
});

it('stock limits and invalid additions return errors without throwing', async () => {
  const { addToCart } = await loadCartModule();
  const cart = cartFixture();

  for (const operation of [
    () => addToCart(cart, { id: 'book-js', name: 'JavaScript Guide', category: 'books', price: 400, stock: 5 }, 4),
    () => addToCart(cart, productFixture(), 0),
    () => addToCart(cart, productFixture(), 1.5),
    () => addToCart(cart, { ...productFixture(), price: -1 }, 1),
    () => addToCart(cart, { ...productFixture(), stock: 0 }, 1),
  ]) expectErrorWithoutThrow(operation);
});

it('removing a product returns a new cart and preserves the source', async () => {
  const { removeFromCart } = await loadCartModule();
  const cart = cartFixture();
  const snapshot = JSON.stringify(cart);
  const result = removeFromCart(cart, 'mouse');

  expect(result).toMatchObject({ ok: true });
  expect(result.cart).toEqual([cart[0]]);
  expect(result.cart).not.toBe(cart);
  expect(result.cart[0]).not.toBe(cart[0]);
  expect(JSON.stringify(cart)).toBe(snapshot);
});

it('removing an unknown product returns an error without throwing', async () => {
  const { removeFromCart } = await loadCartModule();
  expectErrorWithoutThrow(() => removeFromCart(cartFixture(), 'keyboard'));
  expectErrorWithoutThrow(() => removeFromCart(cartFixture(), ''));
});

it('the summary reports exact counts subtotal shipping and total', async () => {
  const { getCartSummary } = await loadCartModule();
  expect(getCartSummary(cartFixture())).toEqual({
    ok: true,
    summary: {
      itemCount: 3,
      uniqueItemCount: 2,
      subtotal: 1600,
      discountRate: 0,
      discount: 0,
      shipping: 0,
      total: 1600,
    },
  });
});

it('the strongest discount wins and shipping uses the discounted subtotal', async () => {
  const { getCartSummary } = await loadCartModule();
  const bulkCart = [
    { id: 'book-js', name: 'JavaScript Guide', category: 'books', price: 400, stock: 5, quantity: 4 },
    { id: 'mouse', name: 'Gaming Mouse', category: 'tech', price: 800, stock: 3, quantity: 1 },
  ];

  expect(getCartSummary(bulkCart, 'STUDENT10').summary).toEqual({
    itemCount: 5,
    uniqueItemCount: 2,
    subtotal: 2400,
    discountRate: 0.15,
    discount: 360,
    shipping: 0,
    total: 2040,
  });

  expect(getCartSummary(cartFixture(), 'STUDENT10').summary).toEqual({
    itemCount: 3,
    uniqueItemCount: 2,
    subtotal: 1600,
    discountRate: 0.1,
    discount: 160,
    shipping: 120,
    total: 1560,
  });
});

it('malformed carts and promo codes return errors without throwing', async () => {
  const { getCartSummary } = await loadCartModule();
  for (const operation of [
    () => getCartSummary(null),
    () => getCartSummary([{ ...cartFixture()[0], quantity: 0 }]),
    () => getCartSummary([{ ...cartFixture()[0], quantity: 6 }]),
    () => getCartSummary(cartFixture(), 'UNKNOWN'),
  ]) expectErrorWithoutThrow(operation);
});
