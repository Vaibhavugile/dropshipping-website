// src/hooks/useResellerCatalog.js
import { useEffect, useState } from "react";
import { api } from "../api/api";

/**
 * Loads categories + products for the *storefront*.
 *
 * Behaviour:
 * - Always loads all admin categories (from /categories).
 * - For each category:
 *    - Loads admin products from /categories/{catId}/products.
 *    - If resellerId is provided:
 *        - Loads reseller selections from
 *          resellersMeta/{resellerId}/categories/{catId}/products/{productId}
 *        - Shows ONLY products that have a reseller doc AND
 *          (enabled === true OR enabled is missing).
 *        - Attaches reseller selection under `resellerSelection` field.
 *    - If resellerId is not provided:
 *        - Shows all admin products (no filtering).
 *
 * Returns:
 *  { categories, productsByCategory, loading, error }
 *
 * productsByCategory[catId] is an array of *visible* products for that reseller.
 */
export function useResellerCatalog(resellerId) {
  const [categories, setCategories] = useState([]);
  const [productsByCategory, setProductsByCategory] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 1) load categories
        const cats = await api.listCategories();
        if (!mounted) return;

        const normalizedCats = Array.isArray(cats)
          ? cats.map((c) => ({
              id: c.id || c.name,
              name: c.name || c.id,
              ...c,
            }))
          : [];

        setCategories(normalizedCats);

        // 2) load products per category, with reseller filter if resellerId present
        const prodMap = {};

        await Promise.all(
          normalizedCats.map(async (cat) => {
            try {
              // admin products (global)
              const rawProds = await api.listProductsByCategory(cat.id);
              let finalProds = Array.isArray(rawProds)
                ? rawProds.map((p) => ({
                    id: p.id || p.productCode || p.productName,
                    ...p,
                  }))
                : [];

              // If we have a resellerId, apply per-reseller filter (Step 1)
              if (resellerId) {
                try {
                  // Map: productId -> { enabled, sellingPrice, useDefaultResellerPrice, ... }
                  const selectionMap =
                    (await api.getResellerCategoryProducts(
                      resellerId,
                      cat.id
                    )) || {};

                  // If no selections for this category, hide all products in that category
                  if (
                    !selectionMap ||
                    Object.keys(selectionMap).length === 0
                  ) {
                    finalProds = [];
                  } else {
                    finalProds = finalProds
                      .filter((p) => {
                        const sel = selectionMap[p.id];
                        if (!sel) return false; // no doc -> not selected
                        // If enabled is undefined, treat as enabled=true
                        if (sel.enabled === undefined) return true;
                        return !!sel.enabled;
                      })
                      .map((p) => ({
                        ...p,
                        resellerSelection: selectionMap[p.id] || null,
                      }));
                  }
                } catch (selErr) {
                  console.error(
                    `Failed loading reseller selections for category ${cat.id}:`,
                    selErr
                  );
                  // On error we *fallback* to showing admin products instead of breaking the store
                  // Remove this fallback if you want "fail closed" behaviour.
                }
              }

              prodMap[cat.id] = finalProds;
            } catch (innerErr) {
              console.error(
                `Failed loading products for category ${cat.id}:`,
                innerErr
              );
              prodMap[cat.id] = [];
            }
          })
        );

        if (!mounted) return;
        setProductsByCategory(prodMap);
        setLoading(false);
      } catch (err) {
        console.error("useResellerCatalog error:", err);
        if (!mounted) return;
        setError(err);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [resellerId]);

  return { categories, productsByCategory, loading, error };
}
