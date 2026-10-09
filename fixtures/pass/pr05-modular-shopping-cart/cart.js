const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isProduct(product) {
  return product
    && isNonEmptyString(product.id)
    && isNonEmptyString(product.name)
    && isNonEmptyString(product.category)
    && Number.isFinite(product.price)
    && product.price >= 0
    && Number.isInteger(product.stock)
    && product.stock > 0;
}

function isLine(line) {
  return isProduct(line)
    && Number.isInteger(line.quantity)
    && line.quantity > 0
    && line.quantity <= line.stock;
}

function isCart(cart) {
  return Array.isArray(cart)
    && cart.every(isLine)
    && new Set(cart.map(({ id }) => id)).size === cart.length;
}

function cloneCart(cart) {
  return cart.map((line) => ({ ...line }));
}

function error(message) {
  return { ok: false, message };
}

export function addToCart(cart, product, quantity) {
  if (!isCart(cart)) return error('Cart is invalid.');
  if (!isProduct(product)) return error('Product is invalid.');
  if (!Number.isInteger(quantity) || quantity <= 0) return error('Quantity must be a positive integer.');

  const index = cart.findIndex(({ id }) => id === product.id);
  const currentQuantity = index === -1 ? 0 : cart[index].quantity;
  if (currentQuantity + quantity > product.stock) return error('Requested quantity exceeds stock.');

  const nextCart = cloneCart(cart);
  if (index === -1) nextCart.push({ ...product, quantity });
  else nextCart[index] = { ...product, quantity: currentQuantity + quantity };

  return { ok: true, cart: nextCart };
}

export function removeFromCart(cart, productId) {
  if (!isCart(cart)) return error('Cart is invalid.');
  if (!isNonEmptyString(productId)) return error('Product id is invalid.');
  if (!cart.some(({ id }) => id === productId)) return error('Product is not present in the cart.');
  return { ok: true, cart: cart.filter(({ id }) => id !== productId).map((line) => ({ ...line })) };
}

export function getCartSummary(cart, promoCode = '') {
  if (!isCart(cart)) return error('Cart is invalid.');
  if (promoCode !== '' && promoCode !== 'STUDENT10') return error('Promo code is invalid.');

  const itemCount = cart.reduce((sum, { quantity }) => sum + quantity, 0);
  const subtotal = roundMoney(cart.reduce((sum, { price, quantity }) => sum + price * quantity, 0));
  const discountRate = Math.max(itemCount >= 5 ? 0.15 : 0, promoCode === 'STUDENT10' ? 0.1 : 0);
  const discount = roundMoney(subtotal * discountRate);
  const discountedSubtotal = roundMoney(subtotal - discount);
  const shipping = itemCount === 0 || discountedSubtotal >= 1500 ? 0 : 120;

  return {
    ok: true,
    summary: {
      itemCount,
      uniqueItemCount: cart.length,
      subtotal,
      discountRate,
      discount,
      shipping,
      total: roundMoney(discountedSubtotal + shipping),
    },
  };
}
