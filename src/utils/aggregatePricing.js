// src/utils/aggregatePricing.js
import { api } from "../api/api";

/**
 * cartItems: [{ categoryId, productId, qty, variant? }]
 * role: string (e.g., 'retail')
 *
 * returns: { subtotal, breakdown: [{ categoryId, totalQty, unitPrice, items: [{...}] }]}
 */
export async function computeAggregateCartTotal(cartItems, role = "retail") {
  if (!cartItems || cartItems.length === 0) return { subtotal: 0, breakdown: [] };

  // sum qty per category
  const catTotals = {};
  for (const it of cartItems) {
    catTotals[it.categoryId] = (catTotals[it.categoryId] || 0) + it.qty;
  }

  const breakdown = [];
  let subtotal = 0;

  for (const categoryId of Object.keys(catTotals)) {
    const totalQty = catTotals[categoryId];
    // fetch rules via api (dummyService or firebaseService)
    const roleDoc = await api.getPriceRoleRules(categoryId, role);
    if (!roleDoc) throw new Error(`No pricing rules for role ${role} in ${categoryId}`);
    const rules = roleDoc.rules || [];
    let matched = null;
    for (const r of rules) {
      if (totalQty >= Number(r.min) && totalQty <= Number(r.max)) { matched = r; break; }
    }
    if (!matched) throw new Error(`No rule matches qty ${totalQty} for ${categoryId}`);
    const unitPrice = Number(matched.price);

    const itemsForCategory = cartItems.filter(i => i.categoryId === categoryId)
      .map(i => ({ ...i, unitPrice, lineTotal: unitPrice * i.qty }));
    const catTotal = itemsForCategory.reduce((s, it) => s + it.lineTotal, 0);

    breakdown.push({ categoryId, totalQty, unitPrice, items: itemsForCategory, catTotal });
    subtotal += catTotal;
  }

  return { subtotal, breakdown };
}
