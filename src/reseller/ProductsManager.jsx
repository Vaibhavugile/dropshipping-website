// src/reseller/ProductsManager.jsx
import React, { useEffect, useState } from "react";
import { useResellerAuth } from "../hooks/useResellerAuth";
import { firebaseService } from "../api/firebaseService";
import "./products-manager.css";

/**
 * Products Manager (Option B — category subcollections)
 *
 * Data model used:
 * - resellersMeta/{resellerId}/categories/{categoryId}/priceRoles/{roleId}
 * - resellersMeta/{resellerId}/categories/{categoryId}/products/{productId}
 *
 * UI summary:
 * - Left: quick categories + edit retail tiers per category (form)
 * - Grid: products (from admin) with per-product toggles / sellingPrice
 * - Use purchase cost (admin/reseller reseller tier) and pick retail tier from reseller/admin templates
 */

function blankRule() {
  return { min: 1, max: 999999, price: 0 };
}
function blankRetailRole() {
  return { roleName: "Retail", rules: [blankRule()] };
}

// NEW: helper to derive docId from roleName
function makeRoleIdFromName(name, fallbackId) {
  const raw = String(name || "").trim().toLowerCase();
  const slug = raw
    .replace(/\s+/g, "-")      // spaces -> dash
    .replace(/[^a-z0-9_-]/g, ""); // remove weird chars
  return slug || fallbackId;   // if name is empty or all weird, keep old key
}

export default function ProductsManager() {
  const { loading: authLoading, resellerId } = useResellerAuth();
  const [loading, setLoading] = useState(true);

  const [allProducts, setAllProducts] = useState([]); // [{categoryId, categoryName, product}]
  const [selectedMap, setSelectedMap] = useState({}); // productId -> selected doc

  const [adminCategoryRoles, setAdminCategoryRoles] = useState({}); // admin templates by cid
  const [resellerCategoryRoles, setResellerCategoryRoles] = useState({}); // reseller overrides by cid

  // category editor state
  const [editorOpenFor, setEditorOpenFor] = useState(null);
  const [editorRolesState, setEditorRolesState] = useState({}); // roleId -> { roleName, rules:[] }
  const [editorBusy, setEditorBusy] = useState(false);

  // picker
  const [pickerProduct, setPickerProduct] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, resellerId]);

  async function loadAll() {
    if (!resellerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // admin products (global)
      const products = await firebaseService.listAllAdminProducts();

      const selected = {};
      const catIds = [...new Set((products || []).map((p) => p.categoryId))];

      const adminRoles = {};
      const resellerRoles = {};

      await Promise.all(
        catIds.map(async (cid) => {
          // 1) Admin roles (category)
          adminRoles[cid] =
            (await firebaseService.getCategoryPriceRoles(cid)) || {};

          // 2) Ensure reseller has a 'reseller' (purchase) role cloned under their path
          try {
            await firebaseService.ensureResellerPurchaseRole(
              resellerId,
              cid
            );
          } catch (e) {
            console.warn(
              "ensureResellerPurchaseRole failed for",
              resellerId,
              cid,
              e
            );
          }

          // 3) Reseller roles for this category (per Option B)
          resellerRoles[cid] =
            (await firebaseService.getResellerCategoryRoles(
              resellerId,
              cid
            )) || {};

          // 4) Reseller selected products for this category (per Option B)
          const catProducts =
            await firebaseService.getResellerCategoryProducts(
              resellerId,
              cid
            );
          // catProducts is map productId -> doc
          Object.assign(selected, catProducts || {});
        })
      );

      setAllProducts(products || []);
      setSelectedMap(selected || {});
      setAdminCategoryRoles(adminRoles);
      setResellerCategoryRoles(resellerRoles);
    } catch (err) {
      console.error("ProductsManager.loadAll error", err);
      alert("Failed to load products/pricing data.");
    } finally {
      setLoading(false);
    }
  }

  // purchase cost (reseller-specific override if present, else admin 'reseller' role) qty=1
  function getPurchaseCostForCategory(cid) {
    // Prefer reseller-specific purchase tiers (stored as 'reseller' role under resellerCategoryRoles)
    const resellerRolesForCat = resellerCategoryRoles[cid] || {};
    const resellerOverride = resellerRolesForCat.reseller;

    const adminRolesForCat = adminCategoryRoles[cid] || {};
    const adminResellerRole = adminRolesForCat.reseller;

    const roleSource = resellerOverride || adminResellerRole;
    if (!roleSource || !Array.isArray(roleSource.rules)) return null;

    const rule = roleSource.rules.find((r) => {
      const min = Number(r.min || 0),
        max = Number(r.max || 999999);
      return 1 >= min && 1 <= max;
    });
    return rule ? Number(rule.price) : null;
  }

  function toggleProduct(pObj) {
    const pid = pObj.product.id;
    setSelectedMap((prev) => {
      const cur = prev[pid] || {};
      return { ...prev, [pid]: { ...cur, enabled: !cur.enabled } };
    });
  }

  async function saveProduct(pObj) {
    if (!resellerId) return alert("No resellerId");
    const pid = pObj.product.id;
    const cur = selectedMap[pid] || {};
    const payload = {
      productId: pid,
      enabled: !!cur.enabled,
      sellingPrice:
        cur.sellingPrice === undefined || cur.sellingPrice === ""
          ? null
          : Number(cur.sellingPrice),
      useDefaultResellerPrice: !!cur.useDefaultResellerPrice,
      updatedAt: new Date(),
    };
    try {
      await firebaseService.setResellerCategoryProduct(
        resellerId,
        pObj.categoryId,
        pid,
        payload
      );
      alert("Saved");
      await loadAll();
    } catch (err) {
      console.error("saveProduct", err);
      alert("Save failed");
    }
  }

  async function usePurchaseCost(pObj) {
    try {
      const price = await firebaseService.computeUnitPriceForRole(
        pObj.categoryId,
        "reseller",
        1,
        resellerId
      );
      setSelectedMap((prev) => ({
        ...prev,
        [pObj.product.id]: {
          ...(prev[pObj.product.id] || {}),
          sellingPrice: price,
          useDefaultResellerPrice: true,
        },
      }));
    } catch (err) {
      console.error("usePurchaseCost", err);
      alert("No reseller purchase rule found for this category.");
    }
  }

  // ---------------- Category editor (form UI) ----------------

  async function openCategoryEditor(categoryId) {
    setEditorOpenFor(categoryId);
    setEditorRolesState({});
    try {
      // load reseller category roles (Option B)
      const resRoles =
        (await firebaseService.getResellerCategoryRoles(
          resellerId,
          categoryId
        )) || {};
      // normalize: ensure structure roleId -> { roleName, rules: [ {min,max,price} ] }
      const normalized = {};
      Object.entries(resRoles).forEach(([rid, rdoc]) => {
        normalized[rid] = {
          roleName: rdoc.roleName || rid,
          rules: Array.isArray(rdoc.rules)
            ? rdoc.rules.map((r) => ({
                min: Number(r.min || 0),
                max: Number(r.max || 0),
                price: Number(r.price || 0),
              }))
            : [],
        };
      });

      // if reseller has none, bootstrap from admin retail
      if (Object.keys(normalized).length === 0) {
        const adminRetail =
          (adminCategoryRoles[categoryId] || {}).retail;
        if (adminRetail) {
          normalized["retail"] = {
            roleName: adminRetail.roleName || "Retail",
            rules: Array.isArray(adminRetail.rules)
              ? adminRetail.rules.map((r) => ({
                  min: Number(r.min || 0),
                  max: Number(r.max || 0),
                  price: Number(r.price || 0),
                }))
              : [blankRule()],
          };
        }
      }

      if (Object.keys(normalized).length === 0) {
        normalized["retail"] = blankRetailRole();
      }

      setEditorRolesState(normalized);
    } catch (err) {
      console.error("openCategoryEditor", err);
      alert("Failed to open editor");
      setEditorRolesState({});
    }
  }

  function addEditorRole() {
    const id = `role-${Date.now()}`; // temp key; will be converted to slug of roleName on save
    setEditorRolesState((prev) => ({ ...prev, [id]: blankRetailRole() }));
  }

  function removeEditorRole(roleId) {
    if (!confirm("Delete this role?")) return;
    setEditorRolesState((prev) => {
      const c = { ...prev };
      delete c[roleId];
      return c;
    });
  }

  function changeEditorRoleName(roleId, name) {
    setEditorRolesState((prev) => ({
      ...prev,
      [roleId]: {
        ...(prev[roleId] || blankRetailRole()),
        roleName: name,
      },
    }));
  }

  function addEditorRule(roleId) {
    setEditorRolesState((prev) => {
      const r = prev[roleId] || blankRetailRole();
      return {
        ...prev,
        [roleId]: { ...r, rules: [...(r.rules || []), blankRule()] },
      };
    });
  }

  function removeEditorRule(roleId, idx) {
    setEditorRolesState((prev) => {
      const r = prev[roleId] || blankRetailRole();
      const rules = [...(r.rules || [])];
      rules.splice(idx, 1);
      return { ...prev, [roleId]: { ...r, rules } };
    });
  }

  function changeEditorRuleField(roleId, idx, field, value) {
    setEditorRolesState((prev) => {
      const r = prev[roleId] || blankRetailRole();
      const rules = [...(r.rules || [])];
      const item = { ...(rules[idx] || blankRule()) };
      if (field === "min" || field === "max")
        item[field] = Math.max(0, Number(value || 0));
      else if (field === "price") item.price = Number(value || 0);
      rules[idx] = item;
      return { ...prev, [roleId]: { ...r, rules } };
    });
  }

  async function saveEditorRoles() {
    if (!editorOpenFor) return;
    // basic validation
    for (const [rid, rdoc] of Object.entries(editorRolesState)) {
      const name = String(rdoc.roleName || "").trim();
      if (!name)
        return alert("Each role must have a name.");
      if (!Array.isArray(rdoc.rules) || rdoc.rules.length === 0)
        return alert(
          `Role ${rdoc.roleName || rid} must have at least one rule.`
        );
      for (const rule of rdoc.rules) {
        const min = Number(rule.min || 0),
          max = Number(rule.max || 0),
          price = Number(rule.price || 0);
        if (min > max)
          return alert(
            `In role ${rdoc.roleName || rid}, a rule has min > max.`
          );
        if (price < 0) return alert("Price cannot be negative.");
      }
    }

    setEditorBusy(true);
    try {
      // build toSave object with docId = normalized roleName
      const toSave = {};
      Object.entries(editorRolesState).forEach(([rid, rdoc]) => {
        const name = String(rdoc.roleName || "").trim();
        if (!name) return; // already validated above, just in case
        const roleId = makeRoleIdFromName(name, rid); // e.g. "Retail Tier A" -> "retail-tier-a"
        toSave[roleId] = {
          roleName: rdoc.roleName,
          rules: rdoc.rules,
        };
      });

      // Save to Option B path (this will write priceRoles/{roleId})
      await firebaseService.setResellerCategoryRoles(
        resellerId,
        editorOpenFor,
        toSave
      );
      alert("Saved retail pricing for category.");
      const updated =
        (await firebaseService.getResellerCategoryRoles(
          resellerId,
          editorOpenFor
        )) || {};
      setResellerCategoryRoles((prev) => ({
        ...prev,
        [editorOpenFor]: updated || {},
      }));
      setEditorOpenFor(null);
    } catch (err) {
      console.error("saveEditorRoles", err);
      alert("Failed to save roles.");
    } finally {
      setEditorBusy(false);
    }
  }

  // Picker
  function openPicker(pObj) {
    setPickerProduct(pObj);
  }

  async function applyRoleToProduct(pObj, roleId, qty = 1) {
    try {
      const cid = pObj.categoryId;
      // prefer reseller roles
      let sourceRoles = resellerCategoryRoles[cid] || {};
      let roleDoc = sourceRoles[roleId];
      if (!roleDoc) {
        const admin = adminCategoryRoles[cid] || {};
        roleDoc = admin[roleId] || admin.retail || null;
      }
      if (!roleDoc) return alert("Role not found");
      const rule = (roleDoc.rules || []).find((r) => {
        const min = Number(r.min || 0),
          max = Number(r.max || 999999);
        return qty >= min && qty <= max;
      });
      if (!rule) return alert("No tier matches qty");
      setSelectedMap((prev) => ({
        ...prev,
        [pObj.product.id]: {
          ...(prev[pObj.product.id] || {}),
          sellingPrice: rule.price,
          useDefaultResellerPrice: false,
        },
      }));
      setPickerProduct(null);
    } catch (err) {
      console.error("applyRoleToProduct", err);
      alert("Failed to apply tier");
    }
  }

  if (authLoading)
    return <div className="pm-loading">Checking auth…</div>;
  if (!resellerId)
    return (
      <div className="pm-loading">No reseller access assigned.</div>
    );

  const categoryIds = [...new Set(allProducts.map((x) => x.categoryId))];

  return (
    <div className="pm-wrapper">
      <header className="pm-header">
        <div>
          <h2>Products Manager</h2>
          <div className="pm-sub">
            Manage which admin products appear on your store and set
            retail tiers/ prices per category.
          </div>
        </div>
        <div>
          <button
            className="btn secondary"
            onClick={loadAll}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <div className="pm-categories" aria-hidden={loading}>
        {categoryIds.map((cid) => {
          const cat = allProducts.find((x) => x.categoryId === cid);
          const catName = cat?.categoryName || cid;
          const baseCost = getPurchaseCostForCategory(cid);
          return (
            <div key={cid} className="pm-cat-pill">
              <button
                className="pm-cat-btn"
                onClick={() => {
                  const el = document.getElementById(`cat-${cid}`);
                  if (el)
                    el.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                }}
              >
                {catName}
                {baseCost != null && (
                  <span className="pm-cat-cost">
                    Base cost: {baseCost}
                  </span>
                )}
              </button>
              <button
                className="pm-edit-roles"
                onClick={() => openCategoryEditor(cid)}
              >
                Edit Retail Pricing
              </button>
            </div>
          );
        })}
      </div>

      <div className="pm-grid">
        {allProducts.map((pObj) => {
          const p = pObj.product;
          const sel = selectedMap[p.id] || {};
          const cost = getPurchaseCostForCategory(pObj.categoryId);

          return (
            <article
              key={p.id}
              id={`cat-${pObj.categoryId}`}
              className="pm-card"
            >
              <div className="pm-card-media">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.productName} />
                ) : (
                  <div className="pm-noimg">No image</div>
                )}
              </div>
              <div className="pm-card-body">
                <div className="pm-title">{p.productName}</div>
                <div className="pm-code">Code: {p.productCode}</div>
                <div className="pm-stock">
                  Stock: {p.stock ?? "-"}
                </div>
                {cost != null && (
                  <div className="pm-cost-line">
                    Purchase cost (qty 1): <strong>{cost}</strong>
                  </div>
                )}

                <div className="pm-actions-row">
                  <label className="pm-toggle">
                    <input
                      type="checkbox"
                      checked={!!sel.enabled}
                      onChange={() => toggleProduct(pObj)}
                    />{" "}
                    <span>Show on site</span>
                  </label>
                  <div className="pm-quick-actions">
                    <button
                      className="btn small"
                      onClick={() => usePurchaseCost(pObj)}
                    >
                      Use purchase cost
                    </button>
                    <button
                      className="btn small ghost"
                      onClick={() => openPicker(pObj)}
                    >
                      Pick retail tier
                    </button>
                  </div>
                </div>

                <div className="pm-price-row">
                  <input
                    className="pm-price-input"
                    type="number"
                    placeholder="Selling price"
                    value={sel.sellingPrice ?? ""}
                    onChange={(e) =>
                      setSelectedMap((prev) => ({
                        ...prev,
                        [p.id]: {
                          ...(prev[p.id] || {}),
                          sellingPrice: e.target.value,
                          useDefaultResellerPrice: false,
                        },
                      }))
                    }
                  />
                  <button
                    className="btn small primary"
                    onClick={() => saveProduct(pObj)}
                  >
                    Save
                  </button>
                </div>

                {sel.useDefaultResellerPrice && (
                  <div className="pm-tag">
                    Using category purchase cost
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Editor Modal */}
      {editorOpenFor && (
        <div className="pm-modal" role="dialog" aria-modal="true">
          <div className="pm-modal-card large">
            <header className="modal-head">
              <h3>Category Pricing — {editorOpenFor}</h3>
              <div className="modal-actions">
                <button
                  className="btn ghost"
                  onClick={() => setEditorOpenFor(null)}
                  disabled={editorBusy}
                >
                  Close
                </button>
                <button
                  className="btn primary"
                  onClick={saveEditorRoles}
                  disabled={editorBusy}
                >
                  Save
                </button>
              </div>
            </header>

            <div className="editor-grid">
              <div className="editor-roles-list">
                <div className="roles-head">
                  <h4>Your retail tiers</h4>
                  <button
                    className="btn small"
                    onClick={addEditorRole}
                  >
                    + Role
                  </button>
                </div>
                {Object.keys(editorRolesState).length === 0 && (
                  <div className="muted">No retail roles — add one.</div>
                )}

                {Object.entries(editorRolesState).map(
                  ([rid, rdoc]) => (
                    <div key={rid} className="role-edit-card">
                      <div className="role-edit-head">
                        <input
                          value={rdoc.roleName}
                          onChange={(e) =>
                            changeEditorRoleName(rid, e.target.value)
                          }
                          className="role-edit-name"
                          placeholder="Role name"
                        />
                        <div>
                          <button
                            className="btn small"
                            onClick={() => addEditorRule(rid)}
                          >
                            + Rule
                          </button>
                          <button
                            className="btn small danger"
                            onClick={() =>
                              removeEditorRole(rid)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="role-rules">
                        <div className="rules-row header">
                          <div>Min qty</div>
                          <div>Max qty</div>
                          <div>Price</div>
                          <div />
                        </div>
                        {(rdoc.rules || []).map((rule, idx) => (
                          <div
                            className="rules-row"
                            key={idx}
                          >
                            <div>
                              <input
                                type="number"
                                value={rule.min}
                                onChange={(e) =>
                                  changeEditorRuleField(
                                    rid,
                                    idx,
                                    "min",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div>
                              <input
                                type="number"
                                value={rule.max}
                                onChange={(e) =>
                                  changeEditorRuleField(
                                    rid,
                                    idx,
                                    "max",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div>
                              <input
                                type="number"
                                value={rule.price}
                                onChange={(e) =>
                                  changeEditorRuleField(
                                    rid,
                                    idx,
                                    "price",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div>
                              <button
                                className="btn small ghost"
                                onClick={() =>
                                  removeEditorRule(rid, idx)
                                }
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>

              <aside className="editor-preview">
                <h4>Admin purchase tiers (reseller)</h4>
                <div className="admin-preview">
                  {(() => {
                    const roles =
                      adminCategoryRoles[editorOpenFor] || {};
                    const resellerRole = roles.reseller;
                    if (
                      !resellerRole ||
                      !Array.isArray(resellerRole.rules)
                    )
                      return (
                        <div className="muted">
                          No reseller purchase tiers found.
                        </div>
                      );
                    return (
                      <div className="admin-role">
                        <strong>
                          {resellerRole.roleName || "reseller"}
                        </strong>
                        <div className="muted">
                          {resellerRole.rules.map((r, i) => (
                            <div key={i}>
                              {r.min}–{r.max}: {r.price}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <h4 style={{ marginTop: 12 }}>
                  Admin retail template
                </h4>
                <div className="admin-preview">
                  {(() => {
                    const roles =
                      adminCategoryRoles[editorOpenFor] || {};
                    const retailRole = roles.retail;
                    if (
                      !retailRole ||
                      !Array.isArray(retailRole.rules)
                    )
                      return (
                        <div className="muted">
                          No admin retail tiers found.
                        </div>
                      );
                    return (
                      <div className="admin-role">
                        <strong>
                          {retailRole.roleName || "retail"}
                        </strong>
                        <div className="muted">
                          {retailRole.rules.map((r, i) => (
                            <div key={i}>
                              {r.min}–{r.max}: {r.price}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div
                  style={{ marginTop: 12 }}
                  className="muted"
                >
                  Admin tiers are read-only. Your edits on the left
                  control selling prices for all products in this
                  category.
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {/* Picker modal */}
      {pickerProduct && (
        <div className="pm-modal" role="dialog" aria-modal="true">
          <div className="pm-modal-card">
            <header className="modal-head">
              <h3>
                Apply Retail Tier —{" "}
                {pickerProduct.product.productName}
              </h3>
              <div className="modal-actions">
                <button
                  className="btn ghost"
                  onClick={() => setPickerProduct(null)}
                >
                  Close
                </button>
              </div>
            </header>

            <div className="picker-grid">
              <section>
                <h4>Your retail tiers</h4>
                {Object.keys(
                  resellerCategoryRoles[pickerProduct.categoryId] ||
                    {}
                ).length === 0 && (
                  <div className="muted">
                    No custom retail tiers yet. Use "Edit Retail
                    Pricing".
                  </div>
                )}
                {Object.entries(
                  resellerCategoryRoles[
                    pickerProduct.categoryId
                  ] || {}
                ).map(([rid, rd]) => (
                  <div key={rid} className="picker-role">
                    <strong>{rd.roleName || rid}</strong>
                    {(rd.rules || []).map((rule, i) => (
                      <div key={i} className="picker-rule">
                        {rule.min}–{rule.max}:{" "}
                        <strong>{rule.price}</strong>
                        <button
                          className="btn small ghost"
                          onClick={() =>
                            applyRoleToProduct(
                              pickerProduct,
                              rid,
                              Number(rule.min || 1)
                            )
                          }
                        >
                          Apply
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </section>

              <section>
                <h4>Admin retail template</h4>
                {(() => {
                  const roles =
                    adminCategoryRoles[
                      pickerProduct.categoryId
                    ] || {};
                  const retailRole = roles.retail;
                  if (
                    !retailRole ||
                    !Array.isArray(retailRole.rules)
                  )
                    return (
                      <div className="muted">
                        No admin retail tiers.
                      </div>
                    );
                  return (
                    <div className="picker-role">
                      <strong>
                        {retailRole.roleName || "retail"}
                      </strong>
                      {retailRole.rules.map((rule, i) => (
                        <div
                          key={i}
                          className="picker-rule"
                        >
                          {rule.min}–{rule.max}:{" "}
                          <strong>{rule.price}</strong>
                          <button
                            className="btn small ghost"
                            onClick={() =>
                              applyRoleToProduct(
                                pickerProduct,
                                "retail",
                                Number(rule.min || 1)
                              )
                            }
                          >
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </section>
            </div>

            <footer
              style={{ marginTop: 12, textAlign: "right" }}
            >
              <button
                className="btn ghost"
                onClick={() => setPickerProduct(null)}
              >
                Done
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
