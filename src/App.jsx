import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import ProductList from "./ProductList";
import Cart from "./Cart";

// Admin Panel
import AdminApp from "./admin/AdminApp";

export default function App() {
  const resellerId = "default"; // later auto-detect from domain

  return (
    <BrowserRouter>
      <Routes>

        {/* --------- Storefront (Public Site) --------- */}
        <Route
          path="/"
          element={
            <div style={{ maxWidth: 1100, margin: "30px auto", padding: 20 }}>
              <header style={{ marginBottom: 20 }}>
                <h1>Demo Store</h1>
              </header>

              <main style={{ display: "flex", gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <ProductList resellerId={resellerId} />
                </div>

                <aside style={{ width: 360 }}>
                  <Cart />
                </aside>
              </main>
            </div>
          }
        />

        {/* --------- Admin App Routes --------- */}
        <Route path="/admin/*" element={<AdminApp />} />

      </Routes>
    </BrowserRouter>
  );
}
