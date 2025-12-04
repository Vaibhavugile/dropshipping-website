// src/admin/AdminApp.jsx
import React, { useState } from "react";
import { Routes, Route, Navigate, NavLink, Outlet } from "react-router-dom";

import { AdminAuthProvider, useAdminAuth } from "./AuthProvider";
import Login from "./Login";
import Categories from "./Categories";
import Products from "./Products";
import Orders from "./Orders";
import Resellers from "./Resellers";

import "./AdminApp.css";

/**
 * Premium Admin Layout
 *
 * - Single BrowserRouter must wrap the app (this file does not create a router)
 * - Uses Outlet for inner pages
 * - Collapsible sidebar, topbar with search and user area
 */

function RequireAdmin() {
  const { loading, isAdmin, user } = useAdminAuth();
  if (loading) return <div className="admin-loading">Checking auth…</div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <div className="admin-card">Access denied. Not an admin.</div>;
  return <Outlet />;
}

function IconDashboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="13" y="3" width="8" height="4" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="13" y="9" width="8" height="12" rx="1" fill="currentColor" opacity="0.75" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function IconProducts() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2l8 4v8l-8 4-8-4V6l8-4z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12v8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconResellers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" fill="currentColor" />
      <path d="M2 20c1-3 6-5 7-5s6 2 7 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="14" y="6" width="8" height="12" rx="2" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

function IconOrders() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 7h18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Topbar({ onToggle, collapsed, storeTitle }) {
  const { logout, user } = useAdminAuth();
  return (
    <header className="admin-topbar">
      <div className="topbar-left">
        <button className="hamburger" onClick={onToggle} aria-label="Toggle sidebar">
          <span className={`hamburger-box ${collapsed ? "is-collapsed" : ""}`}>
            <span className="hamburger-inner" />
          </span>
        </button>
        <div className="brand">
          <div className="brand-mark" aria-hidden>MS</div>
          <div className="brand-text">
            <div className="brand-title">MultiStore</div>
            <div className="brand-sub">Admin</div>
          </div>
        </div>
        <div className="search-wrap">
          <input className="search-input" placeholder="Search products, orders, resellers..." />
        </div>
      </div>

      <div className="topbar-right">
        <div className="user-welcome">
          <div className="user-avatar" title={user?.email || "Admin"}>{(user?.email || "A").charAt(0).toUpperCase()}</div>
          <div className="user-meta">
            <div className="user-name">{user?.email?.split("@")[0] ?? "Admin"}</div>
            <div className="user-role">Super Admin</div>
          </div>
        </div>
        <button className="btn-ghost" onClick={() => logout()}>Sign out</button>
      </div>
    </header>
  );
}

function Sidebar({ collapsed }) {
  return (
    <aside className={`admin-sidebar ${collapsed ? "collapsed" : ""}`}>
      <nav className="sidebar-nav">
        <NavLink className="nav-item" to="/admin/categories">
          <span className="nav-icon"><IconDashboard /></span>
          <span className="nav-text">Categories</span>
        </NavLink>

        <NavLink className="nav-item" to="/admin/products">
          <span className="nav-icon"><IconProducts /></span>
          <span className="nav-text">Products</span>
        </NavLink>

        <NavLink className="nav-item" to="/admin/resellers">
          <span className="nav-icon"><IconResellers /></span>
          <span className="nav-text">Resellers</span>
        </NavLink>

        <NavLink className="nav-item" to="/admin/orders">
          <span className="nav-icon"><IconOrders /></span>
          <span className="nav-text">Orders</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="footer-note">v1.0 • MultiStore</div>
      </div>
    </aside>
  );
}

export default function AdminApp() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <AdminAuthProvider>
      <div className={`admin-root ${collapsed ? "sidebar-collapsed" : ""}`}>
        <Routes>
          <Route path="login" element={<Login />} />

          <Route element={<RequireAdmin />}>
            <Route
              path="*"
              element={
                <div className="admin-shell">
                  <Sidebar collapsed={collapsed} />
                  <div className="admin-content">
                    <Topbar onToggle={() => setCollapsed(s => !s)} collapsed={collapsed} />
                    <main className="admin-body">
                      <div className="admin-breadcrumbs">
                        <span className="crumb">Admin</span>
                        <span className="crumb">Dashboard</span>
                      </div>

                      <div className="admin-page">
                        {/* The inner routes render here */}
                        <Outlet />
                      </div>

                      <footer className="admin-footer">
                        <small>© {new Date().getFullYear()} MultiStore • Built with ❤️</small>
                      </footer>
                    </main>
                  </div>
                </div>
              }
            >
              <Route path="categories" element={<Categories />} />
              <Route path="products" element={<Products />} />
              <Route path="resellers" element={<Resellers />} />
              <Route path="orders" element={<Orders />} />
              <Route index element={<Navigate to="categories" replace />} />
            </Route>
          </Route>
        </Routes>
      </div>
    </AdminAuthProvider>
  );
}
