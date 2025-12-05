// src/admin/Resellers.jsx
import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { firebaseService } from "../api/firebaseService";
import "./resellers.css";

export default function Resellers() {
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [newR, setNewR] = useState({
    id: "",
    name: "",
    email: "",
    password: ""
  });

  const auth = getAuth();
  const API_KEY = "AIzaSyC0Zz1pLewzfFf88oCYLmWvE1YPBkbIwbA"; // your firebase API key

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    const list = await firebaseService.listResellers();
    setResellers(list);
    setLoading(false);
  }

  // -------------------------------
  // CREATE FIREBASE USER USING REST API (NO CLOUD FUNCTION)
  // -------------------------------
  async function createFirebaseUser(email, password) {
    const url =
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || "Failed to create user");
    }

    return data.localId; // Firebase UID
  }

  async function addReseller() {
    if (!newR.id.trim() || !newR.name.trim()) {
      alert("ID & name required");
      return;
    }

    const id = newR.id.trim().toLowerCase();
    const name = newR.name.trim();

    setBusy(true);

    try {
      // STEP 1 — create reseller meta
      await firebaseService.addReseller({
        id,
        name,
        domains: [],
        branding: {}
      });

      // STEP 2 — if admin entered login credentials
      if (newR.email && newR.password) {
        const email = newR.email.trim();
        const password = newR.password.trim();

        // Create firebase user via REST API
        const uid = await createFirebaseUser(email, password);

        // Add user metadata in Firestore
        await firebaseService.createUserDoc(uid, {
          uid,
          email,
          resellerId: id,
          role: "reseller",
          createdAt: new Date()
        });

        // Save email for admin visibility
        await firebaseService.updateResellerMeta(id, { email });
      }

      alert("Reseller created!");
      setNewR({ id: "", name: "", email: "", password: "" });
      refresh();

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }

    setBusy(false);
  }

  return (
    <div className="res-wrapper">
      <h1>Resellers</h1>

      <div className="res-grid">

        {/* LEFT LIST */}
        <div className="res-list-panel">
          <h2>Existing Resellers</h2>

          {loading ? (
            <div>Loading…</div>
          ) : (
            <ul className="res-list">
              {resellers.map(r => (
                <li key={r.id} className="res-item">
                  <div className="res-avatar">
                    {r.name?.charAt(0).toUpperCase()}
                  </div>

                  <div className="res-info">
                    <div className="res-name">{r.name}</div>
                    <div className="res-id">{r.id}</div>
                    <div className="res-meta">
                      {r.email ? (
                        <span className="tag">Login: {r.email}</span>
                      ) : (
                        <span className="tag muted">No login</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* RIGHT FORM */}
        <div className="res-form-panel">
          <h2>Add New Reseller</h2>

          <label>ID</label>
          <input
            value={newR.id}
            onChange={(e) => setNewR({ ...newR, id: e.target.value })}
            placeholder="unique-id"
          />

          <label>Name</label>
          <input
            value={newR.name}
            onChange={(e) => setNewR({ ...newR, name: e.target.value })}
            placeholder="Store name"
          />

          <hr />

          <label>Login Email (optional)</label>
          <input
            value={newR.email}
            onChange={(e) => setNewR({ ...newR, email: e.target.value })}
            placeholder="owner@store.com"
          />

          <label>Password (optional)</label>
          <input
            type="password"
            value={newR.password}
            onChange={(e) => setNewR({ ...newR, password: e.target.value })}
            placeholder="temporary password"
          />

          <button disabled={busy} onClick={addReseller}>
            {busy ? "Working…" : "Add Reseller"}
          </button>
        </div>

      </div>
    </div>
  );
}
