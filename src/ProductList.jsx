// src/ProductList.jsx
import React from "react";
import { useResellerCatalog } from "./hooks/useResellerCatalog";
import { useCartDispatch } from "./contexts/CartContext";
import { firebaseService } from "./api/firebaseService";
import './product-card.css'
export default function ProductList({ resellerId }) {
  const { categories, productsByCategory, loading, error } =
    useResellerCatalog(resellerId);
  const dispatch = useCartDispatch();

  if (loading) return <div>Loading products…</div>;
  if (error)
    return (
      <div style={{ color: "red" }}>
        Error loading products: {String(error.message || error)}
      </div>
    );
  if (!categories.length) return <div>No categories found.</div>;

  // Only categories that actually have visible products
  const visibleCategories = categories.filter(
    (cat) => (productsByCategory[cat.id] || []).length > 0
  );

  if (!visibleCategories.length) {
    return (
      <div>
        <h2>Products</h2>
        <p style={{ color: "#666", fontSize: 14 }}>
          No products are currently available for this store.
          <br />
          If you are the reseller, enable products in your{" "}
          <strong>Reseller &gt; Products Manager</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="catalog">
      {visibleCategories.map((cat) => (
        <section key={cat.id} className="category-section" style={{ marginBottom: 24 }}>
          <h2 className="category-title">{cat.name}</h2>
          <div
            className="product-grid"
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {(productsByCategory[cat.id] || []).map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                categoryId={cat.id}
                resellerId={resellerId}
                dispatch={dispatch}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ProductCard({ product, categoryId, resellerId, dispatch }) {
  const [qty, setQty] = React.useState(1);
  const [variant, setVariant] = React.useState(null);

  const [unitPrice, setUnitPrice] = React.useState(null);
  const [priceLoading, setPriceLoading] = React.useState(false);
  const [priceError, setPriceError] = React.useState(null);

  // for tier + savings
  const [rules, setRules] = React.useState([]);

  // derive variant options (colors OR sizes) if present
  const variantType = product?.variants
    ? Object.keys(product.variants)[0]
    : null;
  const variantOptions = variantType
    ? Object.keys(product.variants[variantType] || {})
    : [];

  // ---- Load price rules once (for tier/savings UI) ----
  React.useEffect(() => {
    let cancelled = false;

    async function loadRules() {
      try {
        let resolvedRules = null;

        // 1) Try reseller-specific category roles (Option B)
        if (resellerId) {
          const resellerRoles =
            (await firebaseService.getResellerCategoryRoles(
              resellerId,
              categoryId
            )) || null;
          const retailRole = resellerRoles?.retail;
          if (retailRole && Array.isArray(retailRole.rules)) {
            resolvedRules = retailRole.rules;
          }
        }

        // 2) Fallback to admin category roles
        if (!resolvedRules) {
          const adminRole = await firebaseService.getPriceRoleRules(
            categoryId,
            "retail"
          );
          if (adminRole && Array.isArray(adminRole.rules)) {
            resolvedRules = adminRole.rules;
          }
        }

        if (!cancelled) {
          setRules(resolvedRules || []);
        }
      } catch (e) {
        console.error("loadRules error", e);
        if (!cancelled) setRules([]);
      }
    }

    if (categoryId) loadRules();
    return () => {
      cancelled = true;
    };
  }, [categoryId, resellerId]);

  // --- Pricing logic ---
  // Priority:
  // 1) product.resellerSelection.sellingPrice (fixed)
  // 2) category tiers via computeUnitPriceForRole (role="retail", qty, resellerId)
  React.useEffect(() => {
    let cancelled = false;

    async function refreshPrice() {
      try {
        setPriceError(null);

        // 1) Fixed per-product selling price set by reseller
        const sel = product.resellerSelection;
        if (sel && sel.sellingPrice != null && sel.sellingPrice !== "") {
          const sp = Number(sel.sellingPrice);
          if (!cancelled) {
            setUnitPrice(isNaN(sp) ? null : sp);
            setPriceLoading(false);
          }
          return;
        }

        // 2) Use tiered pricing (retail role) based on qty
        if (!categoryId) {
          if (!cancelled) {
            setUnitPrice(null);
            setPriceError("No category for pricing");
          }
          return;
        }

        setPriceLoading(true);

        try {
          const price = await firebaseService.computeUnitPriceForRole(
            categoryId,
            "retail", // role used for customer-facing price
            Number(qty) || 1,
            resellerId || null
          );
          if (!cancelled) {
            setUnitPrice(Number(price));
            setPriceError(null);
          }
        } catch (err) {
          console.error("computeUnitPriceForRole error:", err);
          if (!cancelled) {
            setUnitPrice(null);
            setPriceError("Price not available");
          }
        } finally {
          if (!cancelled) setPriceLoading(false);
        }
      } catch (err) {
        console.error("refreshPrice error:", err);
        if (!cancelled) {
          setUnitPrice(null);
          setPriceError("Price not available");
          setPriceLoading(false);
        }
      }
    }

    refreshPrice();

    return () => {
      cancelled = true;
    };
  }, [categoryId, resellerId, qty, product]);

  const addToCart = () => {
    const item = { categoryId, productId: product.id, qty: Number(qty) };
    if (variantType && variant)
      item.variant = { type: variantType, value: variant };
    // We don't send price here — backend will recompute based on tiers for safety
    dispatch({ type: "ADD_ITEM", item });
  };

  const lineTotal =
    unitPrice != null ? (Number(unitPrice) || 0) * (Number(qty) || 1) : null;

  // ---- Tier & savings UI (computed from rules) ----
  let tierLabel = null;
  let savingsLabel = null;

  // only show tier info if we're using category tiers (i.e. NOT fixed sellingPrice)
  if (unitPrice != null && rules && rules.length > 0 && !(product.resellerSelection?.sellingPrice)) {
    const baseTier = rules[0];
    const activeTier =
      rules.find((r) => {
        const min = Number(r.min || 0);
        const max = Number(r.max || 9999999);
        return qty >= min && qty <= max;
      }) || baseTier;

    if (activeTier) {
      tierLabel = `Tier: ${activeTier.min}–${activeTier.max}`;

      const savingsPerUnit = Math.max(
        0,
        Number(baseTier.price) - Number(activeTier.price)
      );
      const totalSavings = savingsPerUnit * (Number(qty) || 1);

      if (totalSavings > 0) {
        savingsLabel = `You’re saving ₹ ${totalSavings}`;
      }
    }
  }

  return (
    <div
      className="product-card"
      style={{
        width: 240,
        padding: 12,
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* image placeholder */}
      <div
        className="product-image"
        style={{ height: 120, background: "#eee", marginBottom: 8 }}
      />

      {/* name: e.g. "Men's T-Shirt Classic" */}
      <div className="product-title" style={{ fontWeight: 700 }}>
        {product.productName || product.productCode || product.id}
      </div>

      {/* code: e.g. "Code: A-TS1" */}
      <div className="product-code" style={{ color: "#666", fontSize: 13 }}>
        Code: {product.productCode || product.id}
      </div>

      {/* stock: e.g. "Stock: 388" */}
      <div
        className="product-stock"
        style={{ marginTop: 4, fontSize: 13, color: "#475569" }}
      >
        Stock: {product.stock ?? (product.variants ? "varied" : "—")}
      </div>

      {/* Price display: 
          Price: ₹ 900 / unit
          Qty 1 total: ₹ 900
          + optional Tier / Savings
      */}
      <div className="price-block" style={{ marginTop: 6, fontSize: 13 }}>
        {priceLoading ? (
          <span>Price: calculating…</span>
        ) : unitPrice != null ? (
          <>
            <div className="unit-price">
              Price: <strong>₹ {unitPrice}</strong> / unit
            </div>
            <div
              className="line-total"
              style={{ fontSize: 12, color: "#64748b" }}
            >
              Qty {qty} total:{" "}
              <strong>₹ {lineTotal != null ? lineTotal : "—"}</strong>
            </div>

            {tierLabel && (
              <div
                className="tier-label"
                style={{ fontSize: 12, color: "#1d4ed8", marginTop: 4 }}
              >
                {tierLabel}
              </div>
            )}

            {savingsLabel && (
              <div
                className="savings-label"
                style={{
                  fontSize: 12,
                  color: "#047857",
                  marginTop: 2,
                  fontWeight: 600,
                }}
              >
                {savingsLabel}
              </div>
            )}
          </>
        ) : priceError ? (
          <span style={{ color: "#b91c1c" }}>{priceError}</span>
        ) : (
          <span>Price not set</span>
        )}
      </div>

      {/* variants: e.g. "Choose sizes:" */}
      {variantType && variantOptions.length > 0 && (
        <div
          className="variant-block"
          style={{ marginTop: 8, fontSize: 13 }}
        >
          <label>Choose {variantType}:</label>
          <select
            className="variant-select"
            value={variant || ""}
            onChange={(e) => setVariant(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            <option value="">—</option>
            {variantOptions.map((v) => (
              <option key={v} value={v}>
                {v} ({product.variants[variantType][v]})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* qty + add button */}
      <div
        className="product-actions"
        style={{
          marginTop: 8,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <input
          className="qty-input"
          type="number"
          value={qty}
          min="1"
          onChange={(e) =>
            setQty(Math.max(1, Number(e.target.value || 1)))
          }
          style={{ width: 64, padding: 6 }}
        />
        <button
          className="add-button"
          onClick={addToCart}
          style={{ padding: "6px 10px" }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
