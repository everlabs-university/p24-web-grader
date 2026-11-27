export function filterProducts(products, query) {
  const needle = String(query).trim().toLocaleLowerCase();
  return products.filter((product) =>
    product.title.toLocaleLowerCase().includes(needle)
    || product.category.toLocaleLowerCase().includes(needle));
}

export function selectPage(products, page, pageSize = 24) {
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const start = (safePage - 1) * pageSize;
  return products.slice(start, start + pageSize);
}

export function renderCatalog(document, products, query, page) {
  const matches = filterProducts(products, query);
  const visible = selectPage(matches, page);
  const list = document.querySelector('#results');
  list.replaceChildren();
  if (matches.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'No products match your search.';
    list.append(empty);
  } else {
    const fragment = document.createDocumentFragment();
    for (const product of visible) {
      const item = document.createElement('li');
      item.textContent = `${product.title} — ${product.category} — ${product.price}`;
      fragment.append(item);
    }
    list.append(fragment);
  }
  document.querySelector('#count').textContent = `${matches.length} products found`;
  document.querySelector('#more').hidden = page * 24 >= matches.length;
}
