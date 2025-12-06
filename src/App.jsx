// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import ProductList from "./ProductList";
import Cart from "./Cart";

// Admin Panel
import AdminApp from "./admin/AdminApp";

// Reseller Dashboard
import ResellerApp from "./reseller/ResellerApp";

import { firebaseService } from "./api/firebaseService";

/**
 * Hook: resolve reseller by current host (domain + optional port)
 *
 * - primary key: window.location.host  (e.g. "localhost:3000", "shop.mybrand.com")
 * - fallback:    window.location.hostname (e.g. "localhost", "shop.mybrand.com")
 * - final fallback: "default" (so old behavior still works)
 */
function useResolvedReseller() {
  const [state, setState] = useState({
    loading: true,
    resellerId: null,
    meta: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (typeof window === "undefined") {
          if (!cancelled) {
            setState({
              loading: false,
              resellerId: "default",
              meta: null,
              error: null,
            });
          }
          return;
        }

        const host = window.location.host.toLowerCase();       // "localhost:3000" or "shop.mybrand.com"
        const hostname = window.location.hostname.toLowerCase(); // "localhost" or "shop.mybrand.com"

        let reseller = null;

        // 1) try full host first (port-aware)
        if (host) {
          reseller = await firebaseService.getResellerByDomain(host);
        }

        // 2) fallback: try hostname (in case some resellers stored without port)
        if (!reseller && hostname && hostname !== host) {
          reseller = await firebaseService.getResellerByDomain(hostname);
        }

        if (!cancelled) {
          setState({
            loading: false,
            resellerId: reseller?.id || null,
            meta: reseller || null,
            error: null,
          });
        }
      } catch (err) {
        console.error("useResolvedReseller error", err);
        if (!cancelled) {
          setState({
            loading: false,
            resellerId: null,
            meta: null,
            error: err,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export default function App() {
  const { loading, resellerId, meta, error } = useResolvedReseller();

  // Final effective resellerId:
  // - use resolved one if found
  // - else "default" to preserve old behavior
  const effectiveResellerId = resellerId || "default";

  return (
    <BrowserRouter>
      <Routes>

        {/* ---- Public Storefront ---- */}
        <Route
          path="/"
          element={
            <div style={{ maxWidth: 1100, margin: "30px auto", padding: 20 }}>
              <header style={{ marginBottom: 20 }}>
                {loading ? (
                  <h1>Loading store…</h1>
                ) : error ? (
                  <div style={{ color: "red" }}>
                    Failed to resolve store for this host. Using fallback
                    reseller <strong>{effectiveResellerId}</strong>.
                  </div>
                ) : (
                  <>
                    <h1>{meta?.name || "Demo Store"}</h1>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      Host: <code>{typeof window !== "undefined" ? window.location.host : ""}</code>{" "}
                      · Reseller: <strong>{effectiveResellerId}</strong>
                    </div>
                  </>
                )}
              </header>

              <main style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  {/* Only block products UI while resolving */}
                  {loading && !resellerId ? (
                    <div>Resolving store for this host…</div>
                  ) : (
                    <ProductList resellerId={effectiveResellerId} />
                  )}
                </div>
                <aside style={{ width: 360 }}>
                  <Cart resellerId={effectiveResellerId} />
                </aside>
              </main>
            </div>
          }
        />

        {/* ---- Admin ---- */}
        <Route path="/admin/*" element={<AdminApp />} />

        {/* ---- Reseller Dashboard ---- */}
        <Route path="/reseller/*" element={<ResellerApp />} />

      </Routes>
    </BrowserRouter>
  );
}
