// src/admin/Categories.jsx
import React, { useEffect, useState } from "react";
import { firebaseService } from "../api/firebaseService";
import "./categories.css";

function newEmptyRule() {
  return { min: 1, max: 999999, price: 0 };
}

export default function Categories() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState(null);

  // priceRolesUI is a local structured copy used for editing (object: roleId -> { roleName, rules: [...] })
  const [priceRolesUI, setPriceRolesUI] = useState({});
  const [rolesSaving, setRolesSaving] = useState(false);

  // meta: products count + images count for selected category
  const [meta, setMeta] = useState({ productCount: 0, imagesCount: 0 });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const c = await firebaseService.listCategories();
        if (mounted) setCats(c);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  async function addCategory() {
    const name = newName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "-");
    await firebaseService.addCategory({ id, name });
    setNewName("");
    setCats(await firebaseService.listCategories());
  }

  async function selectCat(cat) {
    setSelected(cat);
    setPriceRolesUI({}); // clear until loaded
    setMeta({ productCount: 0, imagesCount: (cat.images || []).length });

    // load price roles and compute product count:
    try {
      const roles = await firebaseService.getCategoryPriceRoles(cat.id);
      // convert Firestore roles data -> UI copy
      // roles is expected to be object { retail: { roleName, rules: [...] }, ... }
      setPriceRolesUI(roles || {});
    } catch (e) {
      console.error("load roles", e);
      setPriceRolesUI({});
    }

    // try to obtain product count (best-effort)
    try {
      const prods = await firebaseService.listProductsByCategory(cat.id);
      setMeta(prev => ({ ...prev, productCount: prods.length }));
    } catch (e) {
      // ignore
    }
  }

  async function deleteCategory(catId) {
    if (!confirm("Delete category & its subcollections? This cannot be undone.")) return;
    await firebaseService.deleteCategory(catId);
    setCats(await firebaseService.listCategories());
    setSelected(null);
    setPriceRolesUI({});
  }

  // --- Price roles helpers (edit UI) ---
  function addRole(roleId) {
    if (!roleId || !roleId.trim()) return alert("Role id required (e.g. retail)");
    const id = roleId.trim();
    if (priceRolesUI[id]) return alert("Role already exists");
    setPriceRolesUI(prev => ({ ...prev, [id]: { roleName: id, rules: [newEmptyRule()] } }));
  }

  function removeRole(roleId) {
    if (!confirm(`Remove role "${roleId}"?`)) return;
    const copy = { ...priceRolesUI };
    delete copy[roleId];
    setPriceRolesUI(copy);
  }

  function addRuleToRole(roleId) {
    setPriceRolesUI(prev => {
      const next = { ...prev };
      next[roleId] = { ...(next[roleId] || { roleName: roleId, rules: [] }) };
      next[roleId].rules = [...(next[roleId].rules || []), newEmptyRule()];
      return next;
    });
  }

  function removeRuleFromRole(roleId, idx) {
    setPriceRolesUI(prev => {
      const next = { ...prev };
      next[roleId] = { ...(next[roleId] || { roleName: roleId, rules: [] }) };
      next[roleId].rules = next[roleId].rules.filter((_, i) => i !== idx);
      return next;
    });
  }

  function updateRule(roleId, idx, field, value) {
    setPriceRolesUI(prev => {
      const next = { ...prev };
      const role = { ...(next[roleId] || { roleName: roleId, rules: [] }) };
      role.rules = (role.rules || []).map((r, i) => (i === idx ? { ...r, [field]: value } : r));
      next[roleId] = role;
      return next;
    });
  }

  async function saveRoles() {
    if (!selected) return;
    setRolesSaving(true);
    try {
      // basic validation: ensure min <= max, price numeric
      for (const [rid, rdoc] of Object.entries(priceRolesUI)) {
        for (const rr of (rdoc.rules || [])) {
          const min = Number(rr.min);
          const max = Number(rr.max);
          const price = Number(rr.price);
          if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(price)) {
            throw new Error(`Invalid rule values in role ${rid}`);
          }
          if (min > max) throw new Error(`min > max in role ${rid}`);
        }
      }

      // call firebaseService to write roles object for this category
      await firebaseService.setCategoryPriceRoles(selected.id, priceRolesUI);
      alert("Price roles saved.");
    } catch (err) {
      console.error("saveRoles error", err);
      alert("Save failed: " + (err.message || String(err)));
    } finally {
      setRolesSaving(false);
    }
  }

  return (
    <div className="cat-wrapper">
      {/* LEFT: categories list */}
      <div className="cat-panel">
        <div className="panel-head">
          <div>
            <h2>Categories</h2>
            <p className="panel-sub">Manage your product groups and pricing roles.</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-box">Loading categories…</div>
        ) : (
          <ul className="cat-list">
            {cats.map((c) => (
              <li key={c.id} className={`cat-item ${selected?.id === c.id ? "active" : ""}`}>
                <button
                  type="button"
                  className="cat-info"
                  onClick={() => selectCat(c)}
                >
                  <div className="cat-circle">{c.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="cat-name">{c.name}</div>
                    <div className="cat-id">{c.id}</div>
                  </div>
                </button>

                <button className="btn-icon-delete" onClick={() => deleteCategory(c.id)} title="Delete category">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="add-box">
          <input
            placeholder="New category name"
            className="input-text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn-add" onClick={addCategory}>
            Add
          </button>
        </div>
      </div>

      {/* RIGHT: editor with tabs */}
      <div className="cat-editor">
        {!selected ? (
          <div className="editor-empty">
            <h3>Select a category</h3>
            <p>Choose a category on the left to configure pricing rules and view basic stats.</p>
          </div>
        ) : (
          <div className="editor-card">
            <div className="editor-top">
              <div>
                <h2>{selected.name}</h2>
                <div className="cat-id-badge">{selected.id}</div>
                <div className="meta-row">
                  <div className="meta-pill">Products: {meta.productCount}</div>
                  <div className="meta-pill">Images: {(selected.images || []).length}</div>
                </div>
              </div>
            </div>

            <section className="roles-section">
              <div className="roles-header">
                <div>
                  <h3>Price Roles</h3>
                  <p className="roles-sub">
                    Define quantity-based pricing tiers for each role (e.g. <span className="inline-code">retail</span>, <span className="inline-code">wholesale</span>).
                  </p>
                </div>
                <div className="roles-actions">
                  <RoleAdd onAdd={addRole} />
                  <button className="btn-save small" disabled={rolesSaving} onClick={saveRoles}>
                    {rolesSaving ? "Saving..." : "Save roles"}
                  </button>
                </div>
              </div>

              <div className="roles-list">
                {Object.keys(priceRolesUI || {}).length === 0 && (
                  <div className="roles-empty">No price roles defined yet. Add one to start.</div>
                )}

                {Object.entries(priceRolesUI).map(([roleId, roleDoc]) => (
                  <div className="role-card" key={roleId}>
                    <div className="role-header">
                      <div className="role-title">
                        <strong>{roleDoc.roleName || roleId}</strong>
                        <div className="role-id">{roleId}</div>
                      </div>

                      <div className="role-controls">
                        <button
                          type="button"
                          className="btn-ghost small"
                          onClick={() => addRuleToRole(roleId)}
                        >
                          + Rule
                        </button>
                        <button
                          type="button"
                          className="btn-danger small"
                          onClick={() => removeRole(roleId)}
                        >
                          Remove role
                        </button>
                      </div>
                    </div>

                    <div className="role-rules">
                      {(roleDoc.rules || []).map((r, idx) => (
                        <div className="rule-row" key={idx}>
                          <div className="rule-inputs">
                            <div className="rule-group">
                              <label className="rule-label">Min qty</label>
                              <input
                                type="number"
                                min="0"
                                value={r.min}
                                onChange={(e) => updateRule(roleId, idx, "min", Number(e.target.value))}
                                className="rule-field"
                              />
                            </div>

                            <div className="rule-sep">–</div>

                            <div className="rule-group">
                              <label className="rule-label">Max qty</label>
                              <input
                                type="number"
                                min="0"
                                value={r.max}
                                onChange={(e) => updateRule(roleId, idx, "max", Number(e.target.value))}
                                className="rule-field"
                              />
                            </div>

                            <div className="rule-group">
                              <label className="rule-label">Unit price</label>
                              <input
                                type="number"
                                min="0"
                                value={r.price}
                                onChange={(e) => updateRule(roleId, idx, "price", Number(e.target.value))}
                                className="rule-price"
                                placeholder="price"
                              />
                            </div>
                          </div>

                          <div className="rule-actions">
                            <button
                              type="button"
                              className="btn-ghost small"
                              onClick={() => removeRuleFromRole(roleId, idx)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/** small add-role inline control */
function RoleAdd({ onAdd = () => {} }) {
  const [val, setVal] = useState("");
  return (
    <div className="role-add-inline">
      <input
        className="input-text small"
        placeholder="role id (e.g. retail)"
        value={val}
        onChange={e => setVal(e.target.value)}
      />
      <button
        className="btn-add small"
        onClick={() => {
          onAdd(val);
          setVal("");
        }}
      >
        Add role
      </button>
    </div>
  );
}
