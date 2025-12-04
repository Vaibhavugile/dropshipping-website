// src/Cart.jsx
import React, { useMemo, useState } from "react";
import { useCartState, useCartDispatch } from "./contexts/CartContext";
import { computeAggregateCartTotal } from "./utils/aggregatePricing";
import { api } from "./api/api";
// small UUID generator (no dependency) — if you already use uuid, import that instead
function generateId() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
}

export default function Cart({ resellerId = "default" }) {
  const { items } = useCartState();
  const dispatch = useCartDispatch();
  const [role, setRole] = useState("retail");
  const [loading, setLoading] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [error, setError] = useState(null);

  // quick derived totals for UI (optional)
  const totalsMemo = useMemo(() => ({ subtotal: 0, breakdown: [] }), [items]);

  async function calculate() {
    return computeAggregateCartTotal(items, role);
  }

  async function onCheckout() {
    setError(null);

    // 1) Validate presence of items
    if (!items || items.length === 0) {
      setError("Your cart is empty — add items before checkout.");
      return;
    }

    // 2) Validate each item shape
    for (const it of items) {
      if (!it.categoryId || !it.productId || !it.qty || it.qty <= 0) {
        setError("Cart contains an invalid item. Each item needs categoryId, productId and qty>0.");
        return;
      }
    }

    setLoading(true);
    try {
      // 3) compute totals (optional, but helpful to show user)
      const calc = await computeAggregateCartTotal(items, role);

      // 4) create payload exactly matching Cloud Function expectation
      const idempotencyKey = generateId(); // or use paymentIntent.id when integrating payments
      const payload = {
        resellerId: resellerId || "default",
        role,
        items: items.map(i => ({
          categoryId: i.categoryId,
          productId: i.productId,
          qty: Number(i.qty),
          // include variant only if present
          ...(i.variant ? { variant: i.variant } : {})
        })),
        idempotencyKey
      };

      // DEBUG: log payload to console (inspect Network tab and Cloud Function logs too)
      console.log("Calling createOrderAggregate with payload:", JSON.stringify(payload, null, 2));

      // 5) call API (this will call the callable Cloud Function)
      const res = await api.createOrderAggregate(payload);

      // 6) handle response
      if (res && res.alreadyProcessed) {
        setOrderResult({ orderId: res.orderId, message: "Order was already processed (idempotent)." });
      } else if (res && res.orderId) {
        setOrderResult({ orderId: res.orderId, message: "Order created successfully." });
      } else {
        // some functions return { success: true, orderId } as well
        setOrderResult({ orderId: res?.orderId || res?.order?.id, message: JSON.stringify(res) });
      }

      // clear cart on success
      dispatch({ type: "CLEAR_CART" });
    } catch (err) {
      console.error("createOrderAggregate error:", err);
      // try to unwrap Firebase error message if present
      const msg = err?.message || (err?.code ? `${err.code}` : "Unknown error");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>Cart</h3>
      {!items.length && <div>Your cart is empty</div>}
      {items.map((it, idx) => (
        <div key={idx} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
          <div style={{ flex: 1 }}>{it.productId} (cat: {it.categoryId})</div>
          <div>Qty: {it.qty}</div>
          <button onClick={() => dispatch({ type: "REMOVE_ITEM", index: idx })}>Remove</button>
        </div>
      ))}

      <div style={{ marginTop: 12 }}>
        <label>
          Role:
          <select value={role} onChange={e => setRole(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
            <option value="reseller">Reseller</option>
            <option value="foreign">Foreign</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={onCheckout} disabled={!items.length || loading}>
          {loading ? "Processing..." : "Checkout"}
        </button>
      </div>

      {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}
      {orderResult && <div style={{ color: "green", marginTop: 10 }}>{orderResult.message} {orderResult.orderId ? `Order ID: ${orderResult.orderId}` : null}</div>}
    </div>
  );
}
