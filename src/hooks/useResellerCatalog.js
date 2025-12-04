// src/hooks/useResellerCatalog.js
import { useEffect, useState } from "react";
import { api } from "../api/api";

/**
 * Loads categories and products for the reseller.
 * - resellerId currently only used as an argument (future filtering).
 * - returns { categories, productsByCategory, loading, error }
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
        // normalize (ensure id + name)
        const normalizedCats = Array.isArray(cats)
          ? cats.map(c => ({ id: c.id || c.name, name: c.name || c.id, ...c }))
          : [];
        setCategories(normalizedCats);

        // 2) load products per category in parallel
        const prodMap = {};
        await Promise.all(
          normalizedCats.map(async (cat) => {
            try {
              const prods = await api.listProductsByCategory(cat.id);
              // ensure array and that each product has id field (firestore returns id)
              prodMap[cat.id] = Array.isArray(prods)
                ? prods.map(p => ({ id: p.id || p.productCode || p.productName, ...p }))
                : [];
            } catch (innerErr) {
              console.error(`Failed loading products for category ${cat.id}:`, innerErr);
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

    return () => { mounted = false; };
  }, [resellerId]);

  return { categories, productsByCategory, loading, error };
}
