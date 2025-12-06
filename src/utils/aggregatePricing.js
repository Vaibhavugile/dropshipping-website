// src/utils/aggregatePricing.js
import { api } from "../api/api";
import { firebaseService } from "../api/firebaseService";

/**
 * cartItems: [{ categoryId, productId, qty, variant? }]
 * role: string (e.g. 'retail')
 * resellerId: string | null
 *
 * returns:
 *  {
 *    subtotal: number,
 *    breakdown: [
 *      {
 *        categoryId,
 *        totalQty,
 *        unitPrice,
 *        catTotal,
 *        activeTier: { min, max } | null,
 *        items: [
 *          {
 *            index,       // original index in cart
 *            categoryId,
 *            productId,
 *            qty,
 *            variant?,
 *            unitPrice,
 *            lineTotal,
 *            activeTier: { min, max } | null
 *          }
 *        ]
 *      }
 *    ]
 *  }
 *
 * Uses the same tier engine as the product cards:
 * - reseller overrides under resellersMeta/{resellerId}/categories/{categoryId}/priceRoles
 * - fallback to admin categories/{categoryId}/priceRoles
 */
export async function computeAggregateCartTotal(
  cartItems,
  role = "retail",
  resellerId = null
) {
  if (!cartItems || cartItems.length === 0) {
    return { subtotal: 0, breakdown: [] };
  }

  // 1) Sum qty per category
  const catTotals = {};
  cartItems.forEach((it) => {
    if (!it.categoryId) return;
    const qty = Number(it.qty || 0);
    if (!Number.isFinite(qty) || qty <= 0) return;
    catTotals[it.categoryId] =
      (catTotals[it.categoryId] || 0) + qty;
  });

  const breakdown = [];
  let subtotal = 0;

  // 2) For each category, compute effective unit price via tiers
  for (const categoryId of Object.keys(catTotals)) {
    const totalQty = catTotals[categoryId];

    // 2a) get unit price using same function as ProductCard
    const unitPrice = await api.computeUnitPriceForRole(
      categoryId,
      role,
      totalQty,
      resellerId || null
    );

    // 2b) load price rules so we can show active tier range
    let rules = null;

    // reseller override first
    if (resellerId) {
      try {
        const resellerRoles =
          (await firebaseService.getResellerCategoryRoles(
            resellerId,
            categoryId
          )) || null;
        const rDef = resellerRoles?.[role];
        if (rDef && Array.isArray(rDef.rules)) {
          rules = rDef.rules;
        }
      } catch (e) {
        console.error("getResellerCategoryRoles error:", e);
      }
    }

    // fallback to admin
    if (!rules) {
      try {
        const adminRole = await firebaseService.getPriceRoleRules(
          categoryId,
          role
        );
        if (adminRole && Array.isArray(adminRole.rules)) {
          rules = adminRole.rules;
        }
      } catch (e) {
        console.error("getPriceRoleRules error:", e);
      }
    }

    let activeTier = null;
    if (rules && rules.length > 0) {
      const base = rules[0];
      const found =
        rules.find((r) => {
          const min = Number(r.min || 0);
          const max = Number(
            r.max != null ? r.max : Number.MAX_SAFE_INTEGER
          );
          return totalQty >= min && totalQty <= max;
        }) || base;

      activeTier = {
        min: Number(found.min || 0),
        max:
          found.max != null
            ? Number(found.max)
            : Number.MAX_SAFE_INTEGER,
      };
    }

    // 3) Attach unitPrice + lineTotal + activeTier to each item in this category
    const itemsForCategory = cartItems
      .map((it, index) => ({ ...it, index }))
      .filter((it) => it.categoryId === categoryId)
      .map((it) => {
        const qty = Number(it.qty || 0);
        const lineTotal = unitPrice * qty;
        return {
          ...it,
          qty,
          unitPrice,
          lineTotal,
          activeTier,
        };
      });

    const catTotal = itemsForCategory.reduce(
      (sum, it) => sum + (Number(it.lineTotal) || 0),
      0
    );
    subtotal += catTotal;

    breakdown.push({
      categoryId,
      totalQty,
      unitPrice,
      catTotal,
      activeTier,
      items: itemsForCategory,
    });
  }

  return { subtotal, breakdown };
}
