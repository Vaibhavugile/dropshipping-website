// src/Cart.jsx
import React, { useEffect, useState } from "react";
import { useCartState, useCartDispatch } from "./contexts/CartContext";
import { computeAggregateCartTotal } from "./utils/aggregatePricing";
import { api } from "./api/api";
import { firebaseService } from "./api/firebaseService";
import "./cart.css";

function generateId() {
  return (
    "id-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 9)
  );
}

export default function Cart({ resellerId = "default" }) {
  const { items } = useCartState();
  const dispatch = useCartDispatch();

  const hasItems = items && items.length > 0;

  // 🔹 Dynamic roles from Firestore
  const [roleOptions, setRoleOptions] = useState(["retail"]);
  const [role, setRole] = useState("retail");
  const [roleLoading, setRoleLoading] = useState(false);

  // Pricing / totals
  const [totals, setTotals] = useState({ subtotal: 0, breakdown: [] });
  const [totalsLoading, setTotalsLoading] = useState(false);
  const [totalsError, setTotalsError] = useState(null);

  // Checkout state
  const [loading, setLoading] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [error, setError] = useState(null);

  // ---------------------------------------------------------------------------
  // 1) Load available roles for this reseller/category, to drive dropdown
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadRoles() {
      if (!hasItems) {
        if (!cancelled) {
          setRoleOptions(["retail"]);
          setRole("retail");
        }
        return;
      }

      // Pick first item’s category as representative
      const firstWithCat = items.find((it) => it.categoryId);
      if (!firstWithCat || !firstWithCat.categoryId) {
        if (!cancelled) {
          setRoleOptions(["retail"]);
          setRole("retail");
        }
        return;
      }

      const categoryId = firstWithCat.categoryId;

      setRoleLoading(true);
      try {
        let rolesObj = null;

        // 1) Try reseller-specific roles first
        if (resellerId) {
          try {
            rolesObj =
              (await firebaseService.getResellerCategoryRoles(
                resellerId,
                categoryId
              )) || null;
          } catch (e) {
            console.error("getResellerCategoryRoles error:", e);
          }
        }

        // 2) Fallback to admin category roles
        if (!rolesObj) {
          try {
            rolesObj =
              (await firebaseService.getCategoryPriceRoles(
                categoryId
              )) || null;
          } catch (e) {
            console.error("getCategoryPriceRoles error:", e);
          }
        }

        let ids = rolesObj ? Object.keys(rolesObj) : ["retail"];
        if (!ids.length) ids = ["retail"];

        if (!cancelled) {
          setRoleOptions(ids);
          setRole((prev) => {
            if (ids.includes(prev)) return prev;
            if (ids.includes("retail")) return "retail";
            return ids[0];
          });
        }
      } catch (err) {
        console.error("loadRoles error:", err);
        if (!cancelled) {
          setRoleOptions(["retail"]);
          setRole("retail");
        }
      } finally {
        if (!cancelled) setRoleLoading(false);
      }
    }

    loadRoles();
    return () => {
      cancelled = true;
    };
  }, [items, resellerId, hasItems]);

  // ---------------------------------------------------------------------------
  // 2) Recompute pricing summary whenever cart / role / reseller change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!hasItems) {
        if (!cancelled) {
          setTotals({ subtotal: 0, breakdown: [] });
          setTotalsError(null);
          setTotalsLoading(false);
        }
        return;
      }

      setTotalsLoading(true);
      setTotalsError(null);

      try {
        const res = await computeAggregateCartTotal(
          items,
          role,
          resellerId || null
        );
        if (!cancelled) {
          setTotals(res || { subtotal: 0, breakdown: [] });
        }
      } catch (err) {
        console.error("computeAggregateCartTotal error:", err);
        if (!cancelled) {
          setTotals({ subtotal: 0, breakdown: [] });
          setTotalsError(err);
        }
      } finally {
        if (!cancelled) setTotalsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [items, role, resellerId, hasItems]);

  // helper: find pricing for a given cart index
  function getItemPricing(index) {
    if (!totals || !Array.isArray(totals.breakdown)) return null;
    for (const cat of totals.breakdown) {
      const found = (cat.items || []).find((it) => it.index === index);
      if (found) {
        return {
          unitPrice: found.unitPrice,
          lineTotal: found.lineTotal,
          activeTier: found.activeTier,
          categoryId: cat.categoryId,
          totalQty: cat.totalQty,
        };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // 3) Checkout – still recompute on server; role is sent as selected
  // ---------------------------------------------------------------------------
  async function onCheckout() {
    setError(null);
    setOrderResult(null);

    if (!hasItems) {
      setError("Your cart is empty — add items before checkout.");
      return;
    }

    for (const it of items) {
      if (!it.categoryId || !it.productId || !it.qty || it.qty <= 0) {
        setError(
          "Cart contains an invalid item. Each item needs categoryId, productId and qty>0."
        );
        return;
      }
    }

    setLoading(true);
    try {
      const calc = await computeAggregateCartTotal(
        items,
        role,
        resellerId || null
      );
      console.log("Local cart pricing:", calc);

      const idempotencyKey = generateId();
      const payload = {
        resellerId: resellerId || "default",
        role, // 🔹 send the selected role
        items: items.map((i) => ({
          categoryId: i.categoryId,
          productId: i.productId,
          qty: Number(i.qty),
          ...(i.variant ? { variant: i.variant } : {}),
        })),
        idempotencyKey,
      };

      console.log(
        "Calling createOrderAggregate with payload:",
        JSON.stringify(payload, null, 2)
      );

      const res = await api.createOrderAggregate(payload);

      if (res && res.alreadyProcessed) {
        setOrderResult({
          orderId: res.orderId,
          message: "Order was already processed (idempotent).",
        });
      } else if (res && res.orderId) {
        setOrderResult({
          orderId: res.orderId,
          message: "Order created successfully.",
        });
      } else {
        setOrderResult({
          orderId: res?.orderId || res?.order?.id,
          message: JSON.stringify(res),
        });
      }

      dispatch({ type: "CLEAR_CART" });
    } catch (err) {
      console.error("createOrderAggregate error:", err);
      const msg =
        err?.message || (err?.code ? `${err.code}` : "Unknown error");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  return (
    <div className="cart">
      <h3 className="cart-title">Cart</h3>

      {!hasItems && <div className="cart-empty">Your cart is empty</div>}

      {hasItems &&
        items.map((it, idx) => {
          const pricing = getItemPricing(idx);
          return (
            <div key={idx} className="cart-item">
              <div className="cart-item-main">
                <div className="cart-item-name">{it.productId}</div>
                <div className="cart-item-meta">
                  Category: <code>{it.categoryId}</code>
                  {it.variant && (
                    <>
                      {" · "}
                      Variant:{" "}
                      <code>
                        {it.variant.type}:{it.variant.value}
                      </code>
                    </>
                  )}
                </div>
              </div>

              <div className="cart-item-pricing">
                <div>Qty: {it.qty}</div>
                {pricing ? (
                  <>
                    <div className="cart-item-unit">
                      ₹ {pricing.unitPrice} / unit
                    </div>
                    <div className="cart-item-line">
                      Line: ₹ {pricing.lineTotal}
                    </div>
                    {pricing.activeTier && (
                      <div className="cart-item-tier">
                        Tier: {pricing.activeTier.min}–
                        {pricing.activeTier.max ===
                        Number.MAX_SAFE_INTEGER
                          ? "∞"
                          : pricing.activeTier.max}
                      </div>
                    )}
                  </>
                ) : totalsLoading ? (
                  <div className="cart-item-calculating">
                    Calculating…
                  </div>
                ) : null}
              </div>

              <button
                className="cart-item-remove"
                onClick={() =>
                  dispatch({ type: "REMOVE_ITEM", index: idx })
                }
              >
                Remove
              </button>
            </div>
          );
        })}

      {/* 🔹 Dynamic role selector based on Firestore roles */}
      {hasItems && (
        <div className="cart-role">
          <label>
            Pricing role:
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {roleLoading && (
              <span className="cart-role-loading"> loading…</span>
            )}
          </label>
        </div>
      )}

      {/* Totals */}
      {hasItems && (
        <div className="cart-summary">
          {totalsLoading ? (
            <div>Calculating totals…</div>
          ) : totalsError ? (
            <div className="cart-error">
              Failed to compute totals:{" "}
              {totalsError.message || String(totalsError)}
            </div>
          ) : (
            <>
              <div className="cart-summary-row">
                <span>Subtotal</span>
                <strong>
                  ₹ {Number(totals.subtotal || 0).toFixed(2)}
                </strong>
              </div>
              <div className="cart-summary-note">
                Prices use the <strong>{role}</strong> tier for this
                reseller
                {resellerId ? ` (reseller: ${resellerId})` : ""}, same
                rules as the product cards.
              </div>
            </>
          )}
        </div>
      )}

      {/* Checkout */}
      <div className="cart-checkout">
        <button
          onClick={onCheckout}
          disabled={!hasItems || loading}
        >
          {loading ? "Processing..." : "Checkout"}
        </button>
      </div>

      {error && <div className="cart-error">{error}</div>}
      {orderResult && (
        <div className="cart-success">
          {orderResult.message}{" "}
          {orderResult.orderId
            ? `Order ID: ${orderResult.orderId}`
            : null}
        </div>
      )}
    </div>
  );
}
