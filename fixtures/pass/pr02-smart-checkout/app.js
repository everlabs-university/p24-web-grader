'use strict';

function calculateCheckout(subtotal, isStudent, deliveryType) {
  const deliveryTypes = ['pickup', 'standard', 'express'];
  const validInput = typeof subtotal === 'number'
    && Number.isFinite(subtotal)
    && subtotal >= 0
    && typeof isStudent === 'boolean'
    && deliveryTypes.includes(deliveryType);

  if (!validInput) {
    return { ok: false, message: 'Invalid checkout input.' };
  }

  let discountRate = 0;
  if (subtotal >= 1000) {
    discountRate = 0.1;
  } else if (isStudent) {
    discountRate = 0.05;
  }

  const discountAmount = Math.round(subtotal * discountRate * 100) / 100;
  const discountedSubtotal = Math.round((subtotal - discountAmount) * 100) / 100;

  let deliveryFee = 0;
  if (deliveryType === 'express') {
    deliveryFee = 150;
  } else if (deliveryType === 'standard' && discountedSubtotal < 750) {
    deliveryFee = 80;
  }

  const total = Math.round((discountedSubtotal + deliveryFee) * 100) / 100;

  return {
    ok: true,
    subtotal,
    discountRate,
    discountAmount,
    discountedSubtotal,
    deliveryFee,
    total,
  };
}
