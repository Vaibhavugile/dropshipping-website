// src/admin/Resellers.jsx
import React, { useEffect, useState } from "react";
import { firebaseService } from "../api/firebaseService";
import "./resellers.css"; // 👉 premium CSS file

export default function Resellers() {
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newR, setNewR] = useState({
    id: "",
    name: "",
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await firebaseService.listResellers();
      setResellers(list);
      setLoading(false);
    })();
  }, []);

  async function addReseller() {
    if (!newR.id.trim() || !newR.name.trim()) {
      return alert("Please fill both ID and Name.");
    }

    await firebaseService.addReseller({
      id: newR.id.trim().toLowerCase(),
      name: newR.name.trim(),
    });

    const updated = await firebaseService.listResellers();
    setResellers(updated);

    setNewR({ id: "", name: "" });
  }

  return (
    <div className="res-wrapper">

      {/* LEFT SIDE: Reseller List */}
      <div className="res-list-panel">
        <h2>Resellers</h2>

        {loading ? (
          <div className="res-loading">Loading…</div>
        ) : (
          <ul className="res-list">
            {resellers.map((r) => (
              <li key={r.id} className="res-item">
                <div className="res-avatar">{r.name.charAt(0).toUpperCase()}</div>
                <div className="res-info">
                  <div className="res-name">{r.name}</div>
                  <div className="res-id">{r.id}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* RIGHT SIDE: Add Reseller */}
      <div className="res-form-panel">
        <h2>Add Reseller</h2>

        <div className="res-field">
          <label>Reseller ID</label>
          <input
            placeholder="unique-id"
            value={newR.id}
            onChange={(e) => setNewR({ ...newR, id: e.target.value })}
          />
        </div>

        <div className="res-field">
          <label>Name</label>
          <input
            placeholder="Store name"
            value={newR.name}
            onChange={(e) => setNewR({ ...newR, name: e.target.value })}
          />
        </div>

        <button className="res-add-btn" onClick={addReseller}>
          Add Reseller
        </button>
      </div>
    </div>
  );
}
