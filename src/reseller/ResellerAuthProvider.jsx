// src/reseller/ResellerAuthProvider.jsx
import React, { createContext, useContext } from "react";
// import the hook from ../hooks but rename it to avoid name collision
import { useResellerAuth as useResellerAuthHook } from "../hooks/useResellerAuth";

const ResellerCtx = createContext(null);

/**
 * ResellerAuthProvider
 * Wraps the app and provides the reseller auth state (from the hook)
 */
export function ResellerAuthProvider({ children }) {
  const value = useResellerAuthHook(); // gets { loading, user, resellerId, logout, ... }
  return <ResellerCtx.Provider value={value}>{children}</ResellerCtx.Provider>;
}

/**
 * useResellerAuth
 * Hook consumers use this to access reseller auth state from context.
 * (This is the exported name your components expect.)
 */
export function useResellerAuth() {
  const ctx = useContext(ResellerCtx);
  if (!ctx) {
    throw new Error("useResellerAuth must be used within ResellerAuthProvider");
  }
  return ctx;
}
