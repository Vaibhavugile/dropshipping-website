// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import ProductList from "./ProductList";
import Cart from "./Cart";

// Admin Panel
import AdminApp from "./admin/AdminApp";

// Reseller Dashboard
import ResellerApp from "./reseller/ResellerApp";

export default function App() {
  const resellerId = "default";

  return (
    <BrowserRouter>
      <Routes>

        {/* ---- Public Storefront ---- */}
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

        {/* ---- Admin ---- */}
        <Route path="/admin/*" element={<AdminApp />} />

        {/* ---- Reseller Dashboard ---- */}
        <Route path="/reseller/*" element={<ResellerApp />} />

      </Routes>
    </BrowserRouter>
  );
}
