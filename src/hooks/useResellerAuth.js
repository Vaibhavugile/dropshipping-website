// src/hooks/useResellerAuth.js
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export function useResellerAuth() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [resellerId, setResellerId] = useState(null);
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) { setResellerId(null); setLoading(false); return; }
      // prefer reading users/{uid} doc
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          setResellerId(snap.data().resellerId || null);
        } else {
          // fallback to token claims - may not be immediately available
          const token = await u.getIdTokenResult();
          setResellerId(token.claims?.resellerId || null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);
  return { loading, user, resellerId };
}
