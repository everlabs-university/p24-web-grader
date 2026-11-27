import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';

const path = resolve(process.cwd(), 'pr10-performance-catalog', 'catalog.js');
let sequence = 0;
async function load() {
  const url = pathToFileURL(path);
  url.searchParams.set('case', String(++sequence));
  return import(url.href);
}
const items = [
  { id: 'a', title: 'Blue notebook', category: 'Office', price: 50 },
  { id: 'b', title: 'Red lamp', category: 'Home', price: 120 },
  { id: 'c', title: 'Green notebook', category: 'Office', price: 70 },
];
const dom = () => new JSDOM('<main><p id="count"></p><ul id="results"></ul><button id="more">Show more</button></main>');

it('filters product titles case-insensitively with surrounding whitespace', async () => {
  const { filterProducts } = await load();
  expect(filterProducts(items, '  NOTEBOOK  ').map(({ id }) => id)).toEqual(['a', 'c']);
});
it('filters categories and preserves source order', async () => {
  const { filterProducts } = await load();
  expect(filterProducts(items, 'home').map(({ id }) => id)).toEqual(['b']);
  expect(filterProducts(items, 'office').map(({ id }) => id)).toEqual(['a', 'c']);
});
it('never mutates the supplied product collection', async () => {
  const { filterProducts } = await load();
  const input = structuredClone(items);
  const result = filterProducts(input, 'note');
  expect(input).toEqual(items);
  expect(result).not.toBe(input);
});
it('limits the first visible page without discarding total matches', async () => {
  const { selectPage } = await load();
  const data = Array.from({ length: 55 }, (_, n) => ({ ...items[0], id: String(n) }));
  expect(selectPage(data, 1, 24).map(({ id }) => id)).toEqual(data.slice(0, 24).map(({ id }) => id));
  expect(data).toHaveLength(55);
});
it('shows the next page and does not repeat earlier products', async () => {
  const { selectPage } = await load();
  const data = Array.from({ length: 55 }, (_, n) => ({ ...items[0], id: String(n) }));
  expect(selectPage(data, 2, 24).map(({ id }) => id)).toEqual(data.slice(24, 48).map(({ id }) => id));
  expect(selectPage(data, 3, 24).map(({ id }) => id)).toEqual(data.slice(48).map(({ id }) => id));
});
it('renders a bounded set of product cards for a large collection', async () => {
  const { renderCatalog } = await load();
  const document = dom().window.document;
  const data = Array.from({ length: 1000 }, (_, n) => ({ ...items[0], id: String(n) }));
  renderCatalog(document, data, '', 1);
  expect(document.querySelectorAll('#results li')).toHaveLength(24);
  expect(document.querySelector('#count').textContent).toContain('1000');
});
it('escapes product titles instead of injecting HTML into results', async () => {
  const { renderCatalog } = await load();
  const document = dom().window.document;
  renderCatalog(document, [{ ...items[0], title: '<img src=x onerror=alert(1)>' }], '', 1);
  expect(document.querySelector('#results img')).toBeNull();
  expect(document.querySelector('#results').textContent).toContain('<img src=x');
});
it('renders an empty state and hides more when nothing matches', async () => {
  const { renderCatalog } = await load();
  const document = dom().window.document;
  renderCatalog(document, items, 'no such item', 1);
  expect(document.querySelector('#results').textContent).toMatch(/no products/i);
  expect(document.querySelector('#more').hidden).toBe(true);
});
