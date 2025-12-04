// src/ProductList.jsx
import React from "react";
import { useResellerCatalog } from "./hooks/useResellerCatalog";
import { useCartDispatch } from "./contexts/CartContext";

export default function ProductList({ resellerId }) {
  const { categories, productsByCategory, loading, error } = useResellerCatalog(resellerId);
  const dispatch = useCartDispatch();

  if (loading) return <div>Loading products…</div>;
  if (error) return <div style={{ color: "red" }}>Error loading products: {String(error.message || error)}</div>;
  if (!categories.length) return <div>No categories found.</div>;

  return (
    <div>
      {categories.map(cat => (
        <section key={cat.id} style={{ marginBottom: 24 }}>
          <h2>{cat.name}</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {(productsByCategory[cat.id] || []).map(p => (
              <ProductCard key={p.id} product={p} categoryId={cat.id} dispatch={dispatch} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ProductCard({ product, categoryId, dispatch }) {
  const [qty, setQty] = React.useState(1);
  const [variant, setVariant] = React.useState(null);

  // derive variant options (colors OR sizes) if present
  const variantType = product?.variants ? Object.keys(product.variants)[0] : null;
  const variantOptions = variantType ? Object.keys(product.variants[variantType] || {}) : [];

  const addToCart = () => {
    const item = { categoryId, productId: product.id, qty: Number(qty) };
    if (variantType && variant) item.variant = { type: variantType, value: variant };
    dispatch({ type: "ADD_ITEM", item });
  };

  return (
    <div style={{ width: 240, padding: 12, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ height: 120, background: "#eee", marginBottom: 8 }} />
      <div style={{ fontWeight: 700 }}>{product.productName || product.productCode || product.id}</div>
      <div style={{ color: "#666", fontSize: 13 }}>Code: {product.productCode || product.id}</div>
      <div style={{ marginTop: 8 }}>Stock: {product.stock ?? (product.variants ? "varied" : "—")}</div>

      {variantType && variantOptions.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>Choose {variantType}:</label>
          <select value={variant || ""} onChange={e => setVariant(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="">—</option>
            {variantOptions.map(v => <option key={v} value={v}>{v} ({product.variants[variantType][v]})</option>)}
          </select>
        </div>
      )}

      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="number"
          value={qty}
          min="1"
          onChange={e => setQty(Math.max(1, Number(e.target.value || 1)))}
          style={{ width: 64, padding: 6 }}
        />
        <button onClick={addToCart} style={{ padding: "6px 10px" }}>Add</button>
      </div>
    </div>
  );
}
