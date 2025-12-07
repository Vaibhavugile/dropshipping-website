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
      <div className="res-header">
        <h1>Resellers</h1>
        <p className="res-subtitle">
          Manage partner stores and optionally create login accounts for them.
        </p>
      </div>

      <div className="res-grid">
        {/* LEFT LIST */}
        <div className="res-list-panel">
          <div className="res-panel-head">
            <h2>Existing Resellers</h2>
            <p className="res-panel-sub">
              Overview of all partner stores synced with your catalog.
            </p>
          </div>

          {loading ? (
            <div className="res-loading">Loading resellers…</div>
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
                        <span className="res-tag">Login: {r.email}</span>
                      ) : (
                        <span className="res-tag muted">No login configured</span>
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
          <div className="res-panel-head">
            <h2>Add New Reseller</h2>
            <p className="res-panel-sub">
              Create a reseller profile and optionally provision a login account.
            </p>
          </div>

          <div className="res-field">
            <label htmlFor="res-id">Reseller ID</label>
            <input
              id="res-id"
              className="res-input"
              value={newR.id}
              onChange={(e) => setNewR({ ...newR, id: e.target.value })}
              placeholder="unique-id (used in URLs & lookups)"
            />
          </div>

          <div className="res-field">
            <label htmlFor="res-name">Store name</label>
            <input
              id="res-name"
              className="res-input"
              value={newR.name}
              onChange={(e) => setNewR({ ...newR, name: e.target.value })}
              placeholder="Store display name"
            />
          </div>

          <div className="res-field res-field-divider">
            <span className="res-section-label">Login (optional)</span>
            <p className="res-field-help">
              If you provide credentials, a Firebase Auth user will be created and linked
              to this reseller.
            </p>
          </div>

          <div className="res-field">
            <label htmlFor="res-email">Login email</label>
            <input
              id="res-email"
              className="res-input"
              value={newR.email}
              onChange={(e) => setNewR({ ...newR, email: e.target.value })}
              placeholder="owner@store.com"
            />
          </div>

          <div className="res-field">
            <label htmlFor="res-password">Password</label>
            <input
              id="res-password"
              type="password"
              className="res-input"
              value={newR.password}
              onChange={(e) => setNewR({ ...newR, password: e.target.value })}
              placeholder="temporary password"
            />
          </div>

          <div className="res-actions">
            <button
              className="res-add-btn"
              disabled={busy}
              onClick={addReseller}
            >
              {busy ? "Working…" : "Add Reseller"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
