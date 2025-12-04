// src/admin/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const AuthContext = createContext(null);

/**
 * AdminAuthProvider - wraps admin UI and provides:
 *  - user
 *  - isAdmin
 *  - loading
 *  - login(email,password)
 *  - logout()
 */
export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const adminDoc = await getDoc(doc(db, "admins", u.uid));
          setIsAdmin(Boolean(adminDoc.exists()));
        } catch (err) {
          console.error("admin check failed", err);
          setIsAdmin(false);
        }
      } else {
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
    <AuthContext.Provider value={{ user, loading, isAdmin, login, logout }}>
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
