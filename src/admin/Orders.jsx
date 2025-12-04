// src/admin/Orders.jsx
import React, { useEffect, useMemo, useState } from "react";
import { firebaseService } from "../api/firebaseService";
import "./orders.css";

function formatDate(ts) {
  if (!ts) return "-";
  // Firestore Timestamp dp
  if (typeof ts?.toDate === "function") return ts.toDate().toLocaleString();
  if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleString();
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [query, setQuery] = useState("");
  const [resellerFilter, setResellerFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;
  const [expanded, setExpanded] = useState({}); // map orderId -> bool

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [rList, oList] = await Promise.all([
          firebaseService.listResellers(),
          firebaseService.listAllOrders()
        ]);
        if (!mounted) return;
        setResellers(rList || []);
        // Ensure createdAt sorting (desc)
        const sorted = (oList || []).slice().sort((a,b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tb - ta;
        });
        setOrders(sorted);
      } catch (err) {
        console.error("load orders error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Filtering & search
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter(o => {
      if (resellerFilter !== "all" && o.resellerId !== resellerFilter) return false;
      if (!q) return true;
      // search in id, resellerId, product ids, and item productCode if present
      if ((o.id || "").toLowerCase().includes(q)) return true;
      if ((o.resellerId || "").toLowerCase().includes(q)) return true;
      if (Array.isArray(o.items)) {
        for (const it of o.items) {
          if ((it.productId || "").toLowerCase().includes(q)) return true;
          if ((it.productCode || "").toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [orders, query, resellerFilter]);

  // Pagination
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  useEffect(() => {
    // reset page if filter changes
    setPage(1);
  }, [query, resellerFilter]);

  if (loading) return <div className="orders-loading">Loading orders…</div>;
  if (!orders.length) return <div className="orders-empty">No orders yet.</div>;

  return (
    <div className="orders-root">

      <div className="orders-controls">
        <div className="orders-controls-left">
          <input
            className="orders-search"
            placeholder="Search order id, reseller, product id..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />

          <select
            className="orders-select"
            value={resellerFilter}
            onChange={e => setResellerFilter(e.target.value)}
          >
            <option value="all">All resellers</option>
            {resellers.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
          </select>
        </div>

        <div className="orders-controls-right">
          <div className="orders-stats">
            <div className="stat">
              <div className="stat-num">{filtered.length}</div>
              <div className="stat-label">Orders</div>
            </div>
            <div className="stat">
              <div className="stat-num">{resellers.length}</div>
              <div className="stat-label">Resellers</div>
            </div>
          </div>
        </div>
      </div>

      <div className="orders-list">
        {pageItems.map(o => (
          <div key={o.id} className="order-card">
            <div className="order-card-row">
              <div className="order-meta">
                <div className="order-id">#{o.id}</div>
                <div className="order-reseller">Reseller: <span>{o.resellerId}</span></div>
                <div className="order-date">{formatDate(o.createdAt)}</div>
              </div>

              <div className="order-summary">
                <div className="order-total">₹ {o.total ?? o.subtotal ?? 0}</div>
                <div className="order-actions">
                  <button
                    className="btn-outline"
                    onClick={() => setExpanded(prev => ({ ...prev, [o.id]: !prev[o.id] }))}
                  >
                    {expanded[o.id] ? "Hide" : "Details"}
                  </button>
                </div>
              </div>
            </div>

            {expanded[o.id] && (
              <div className="order-details">
                <div className="order-items">
                  {Array.isArray(o.items) && o.items.length ? (
                    <table className="order-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>Unit</th>
                          <th>Line total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="td-product">{it.productId}{it.variant ? ` • ${it.variant.type}:${it.variant.value}` : ""}</td>
                            <td>{it.qty}</td>
                            <td>₹ {it.unitPrice}</td>
                            <td>₹ {it.lineTotal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-items">No items data</div>
                  )}
                </div>

                <div className="order-meta-bottom">
                  <div><strong>Subtotal:</strong> ₹ {o.subtotal}</div>
                  <div><strong>Total:</strong> ₹ {o.total ?? o.subtotal}</div>
                  <div><strong>Pricing model:</strong> {o.pricingModel || "—"}</div>
                  <div><strong>Role:</strong> {o.roleUsed || "-"}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="orders-pagination">
        <button className="page-btn" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>Prev</button>
        <div className="page-info">Page {page} of {pageCount}</div>
        <button className="page-btn" onClick={() => setPage(p => Math.min(pageCount, p+1))} disabled={page===pageCount}>Next</button>
      </div>

    </div>
  );
}
