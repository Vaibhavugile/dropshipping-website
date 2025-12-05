// src/reseller/ResellerApp.jsx
import React from "react";
import { Routes, Route, Navigate, Link, Outlet } from "react-router-dom";
import { ResellerAuthProvider, useResellerAuth } from "./ResellerAuthProvider";

import ResellerLogin from "./ResellerLogin";
import ResellerProfile from "./Profile";

/* ============================================================
   AUTH GUARD PROTECTED COMPONENT
============================================================ */
function RequireReseller() {
  const { loading, user, resellerId } = useResellerAuth();

  if (loading) return <div>Loading…</div>;
  if (!user) return <Navigate to="/reseller/login" replace />;
  if (!resellerId) return <div>No reseller access assigned.</div>;

  return <Outlet />;
}

/* ============================================================
   NAVIGATION BAR
============================================================ */
function ResellerNav() {
  const { logout } = useResellerAuth();

  return (
    <nav className="reseller-nav">
      <Link to="/reseller/profile">Branding</Link>
      <button onClick={logout}>Logout</button>
    </nav>
  );
}

/* ============================================================
   MAIN APP
============================================================ */
export default function ResellerApp() {
  return (
    <ResellerAuthProvider>
      <Routes>

        {/* Public Route */}
        <Route path="login" element={<ResellerLogin />} />

        {/* Protected Routes */}
        <Route element={<RequireReseller />}>
          <Route
            path="*"
            element={
              <div style={{ padding: 20 }}>
                <ResellerNav />
                <div className="reseller-content">
                  <Outlet />
                </div>
              </div>
            }
          >
            <Route path="profile" element={<ResellerProfile />} />
            <Route index element={<Navigate to="profile" replace />} />
          </Route>
        </Route>

      </Routes>
    </ResellerAuthProvider>
  );
}
