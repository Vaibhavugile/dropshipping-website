// src/admin/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseService } from "../api/firebaseService";

const AuthContext = createContext(null);

/**
 * AdminAuthProvider - wraps admin UI and provides:
 *  - user (firebase user)
 *  - adminMeta (document from /admins if present)
 *  - isAdmin (bool)
 *  - loading (auth state)
 *  - login(email,password)
 *  - logout()
 *
 * Notes:
 * - This looks up /admins by email (query) — your /admins collection should have documents
 *   with an `email` field for admin accounts.
 */
export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [adminMeta, setAdminMeta] = useState(null); // admin firestore doc data
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAdminMeta(null);
      setIsAdmin(false);

      if (u) {
        // Prefer using email (your admins collection stores email)
        const email = u.email || "";

        try {
          // firebaseService.getAdminByEmail performs a query against /admins
          const adminDoc = await firebaseService.getAdminByEmail(email);
          if (adminDoc) {
            setAdminMeta(adminDoc);
            setIsAdmin(true);
          } else {
            setAdminMeta(null);
            setIsAdmin(false);
          }
        } catch (err) {
          console.error("admin check failed", err);
          setAdminMeta(null);
          setIsAdmin(false);
        }
      } else {
        setAdminMeta(null);
        setIsAdmin(false);
      }

      setLoading(false);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, adminMeta, loading, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAdminAuth - stable named export hook
 */
export function useAdminAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // helpful error in dev when used outside provider
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return ctx;
}
