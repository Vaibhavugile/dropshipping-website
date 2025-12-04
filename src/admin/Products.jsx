// src/admin/Products.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { firebaseService } from "../api/firebaseService";
import "./products.css";

/**
 * Admin Products UI
 * - Top: sticky category chips
 * - Dense grid: 8 cols, 2 rows visible
 * - Add Product: opens modal form
 * - Edit Product: open modal with fields prefilled
 * - Image upload: drag & drop + file picker -> uploads to Firebase Storage via firebaseService.uploadFiles
 * - Shows upload progress and previews
 */

export default function Products() {
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // ui/filter
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(16); // keep 16 so 8 per row × 2 rows visible
  const [selectedIds, setSelectedIds] = useState(new Set());

  // modal state
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null => add, object => edit

  // load categories
  useEffect(() => {
    (async () => {
      const c = await firebaseService.listCategories();
      setCategories(c || []);
      if (c && c.length) setSelectedCat(c[0]);
    })();
  }, []);

  // load products per category
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedCat) return setAllProducts([]);
      setLoading(true);
      try {
        const list = await firebaseService.listProductsByCategory(selectedCat.id);
        if (!mounted) return;
        setAllProducts(list || []);
        setPage(1);
        setSelectedIds(new Set());
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [selectedCat]);

  // derived
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = (allProducts || []).slice();
    if (q) {
      arr = arr.filter(p => (p.productName || "").toLowerCase().includes(q) || (p.productCode || "").toLowerCase().includes(q) || (p.id || "").toLowerCase().includes(q));
    }
    if (sortBy === "name") arr.sort((a,b)=> (a.productName||"").localeCompare(b.productName||""));
    else if (sortBy === "stock") arr.sort((a,b)=> Number(b.stock||0) - Number(a.stock||0));
    return arr;
  }, [allProducts, query, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page-1)*pageSize, page*pageSize);

  // selection
  function toggleSelect(id) {
    setSelectedIds(prev => {
      const c = new Set(prev);
      if (c.has(id)) c.delete(id); else c.add(id);
      return c;
    });
  }
  function selectAllOnPage() { setSelectedIds(prev=> { const c=new Set(prev); pageItems.forEach(it=>c.add(it.id)); return c; }); }
  function clearSelection() { setSelectedIds(new Set()); }

  // delete
  async function deleteProduct(id) {
    if (!confirm("Delete product? This is permanent.")) return;
    try {
      await firebaseService.deleteProduct(selectedCat.id, id);
      setAllProducts(await firebaseService.listProductsByCategory(selectedCat.id));
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return alert("No selection");
    if (!confirm(`Delete ${selectedIds.size} products?`)) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) await firebaseService.deleteProduct(selectedCat.id, id);
    setAllProducts(await firebaseService.listProductsByCategory(selectedCat.id));
    clearSelection();
  }

  // open add modal
  function openAdd() {
    setEditingProduct(null);
    setShowModal(true);
  }

  // open edit modal
  function openEdit(product) {
    setEditingProduct(product);
    setShowModal(true);
  }

  return (
    <div className="prod-fullpage">
      {/* Topbar */}
      <div className="prod-topbar">
        <div className="cat-chip-row">
          {categories.map(c => (
            <button key={c.id} className={`cat-chip ${selectedCat?.id === c.id ? "active": ""}`} onClick={()=>setSelectedCat(c)}>{c.name}</button>
          ))}
        </div>

        <div className="controls-row">
          <div className="left-controls">
            <input className="search-input" placeholder="Search product name/code/id" value={query} onChange={e=>setQuery(e.target.value)} />
            <select className="select" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
              <option value="name">Sort: Name A→Z</option>
              <option value="stock">Sort: Stock desc</option>
            </select>
            <button className="btn primary" onClick={openAdd}>Add Product</button>
          </div>

          <div className="right-controls">
            <button className="btn ghost" onClick={selectAllOnPage}>Select page</button>
            <button className="btn ghost" onClick={clearSelection}>Clear</button>
            <button className="btn danger" onClick={bulkDelete} disabled={selectedIds.size===0}>Delete ({selectedIds.size})</button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="prod-grid-wrap">
        {loading ? <div className="loading">Loading…</div> : (
          <>
            <div className="grid">
              {pageItems.map(p => (
                <div key={p.id} className={`card ${selectedIds.has(p.id) ? "selected" : ""}`}>
                  <div className="card-img">
                    {p.images && p.images.length ? <img src={p.images[0]} alt={p.productName} /> : <div className="placeholder">No image</div>}
                  </div>

                  <div className="card-body">
                    <div className="card-title">{p.productName}</div>
                    <div className="card-sub">{p.productCode || p.id}</div>
                    <div className="card-stock">Stock: <strong>{Number(p.stock||0)}</strong></div>
                    <div className="card-variants">
                      {p.variants && Object.keys(p.variants).length > 0 && Object.entries(p.variants).slice(0,2).map(([t, vals]) => (
                        <span key={t} className="variant-pill">{t}: {Object.keys(vals).length}</span>
                      ))}
                    </div>
                  </div>

                  <div className="card-actions">
                    <label className="select-checkbox"><input type="checkbox" checked={selectedIds.has(p.id)} onChange={()=>toggleSelect(p.id)} /></label>
                    <div style={{display:"flex", gap:8}}>
                      <button className="btn small" onClick={()=>openEdit(p)}>Edit</button>
                      <button className="btn small" onClick={()=>deleteProduct(p.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pager">
              <button className="page-btn" onClick={()=>setPage(s=>Math.max(1,s-1))} disabled={page===1}>Prev</button>
              <div className="page-info">Page {page} / {pageCount} — {filtered.length} products</div>
              <button className="page-btn" onClick={()=>setPage(s=>Math.min(pageCount,s+1))} disabled={page===pageCount}>Next</button>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit aside is hidden here — we use a modal */}
      {showModal && (
        <ProductModal
          key={editingProduct ? editingProduct.id : "new"}
          categoryId={selectedCat?.id}
          product={editingProduct}
          onClose={async (saved) => {
            setShowModal(false);
            setEditingProduct(null);
            if (saved) {
              // refresh list
              setAllProducts(await firebaseService.listProductsByCategory(selectedCat.id));
            }
          }}
        />
      )}
    </div>
  );
}

/* =========================
   ProductModal component
   - handles both Add and Edit
   - drag & drop + file picker uploads using firebaseService.uploadFiles
   ========================= */
function ProductModal({ categoryId, product, onClose }) {
  // product: if provided -> edit, else add
  const isEdit = Boolean(product);
  const initial = isEdit ? {
    id: product.id,
    productName: product.productName || "",
    productCode: product.productCode || "",
    stock: Number(product.stock || 0),
    images: product.images ? [...product.images] : [],
    variants: product.variants ? JSON.parse(JSON.stringify(product.variants)) : {}
  } : {
    id: "",
    productName: "",
    productCode: "",
    stock: 0,
    images: [],
    variants: {}
  };

  const [form, setForm] = useState(initial);
  const [uploadQueue, setUploadQueue] = useState([]); // {file, progress, status, path, url}
  const inputRef = useRef(null);

  useEffect(() => { setForm(initial); }, [product]);

  // drop handlers
  function onDrop(e) {
    e.preventDefault();
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length) handleFiles(files);
  }
  function onDragOver(e) { e.preventDefault(); }

  async function handleFiles(fileList) {
    const files = Array.from(fileList);
    // add to uploadQueue
    const queueItems = files.map(f => ({ file: f, progress: 0, status: "queued", path: null, url: null, name: f.name }));
    setUploadQueue(prev => [...prev, ...queueItems]);
    // Start uploading immediately (we need productId; create temporary id for new product)
    let productId = form.id;
    if (!productId) {
      // create ID from code/name
      productId = (form.productCode || form.productName || `tmp-${Date.now()}`).toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
      setForm(prev => ({ ...prev, id: productId }));
    }

    // upload via firebaseService.uploadFiles (it uploads sequentially here to allow progress)
    for (const f of files) {
      // find queue item and set status uploading
      setUploadQueue(prev => prev.map(q => q.file === f ? { ...q, status: "uploading" } : q));
      try {
        const results = await firebaseService.uploadFiles(categoryId, productId, [f], (prog) => {
          // prog: { name, path, percent, bytesTransferred, total }
          setUploadQueue(prev => prev.map(q => q.file === f ? { ...q, progress: prog.percent } : q));
        });
        // results is array with one item
        const r = results[0];
        // mark queue done and push url into form.images
        setUploadQueue(prev => prev.map(q => q.file === f ? { ...q, status: "done", path: r.path, url: r.url } : q));
        setForm(prev => ({ ...prev, images: [...(prev.images||[]), r.url] }));
      } catch (err) {
        console.error("upload failed", err);
        setUploadQueue(prev => prev.map(q => q.file === f ? { ...q, status: "error" } : q));
        alert("Upload failed for " + f.name);
      }
    }
  }

  // click file input
  function openFilePicker() {
    inputRef.current?.click();
  }

  function onFileChange(e) {
    const files = e.target.files;
    if (files && files.length) handleFiles(files);
    e.target.value = null;
  }

  // remove image both from form and optionally from storage (if it has a storage path)
  async function removeImageAt(index, urlOrPath) {
    // if urlOrPath is a storage path, can call firebaseService.deleteFile(path)
    const url = form.images[index];
    setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    // We do not auto-delete storage object unless you tracked path; upload results saved path in queue entries
    // Optionally prompt to remove storage object by path: skip for now to avoid accidental deletion.
  }

  // variant helpers
  function addVariantType(type) {
    if (!type) return;
    setForm(prev => ({ ...prev, variants: { ...(prev.variants||{}), [type]: prev.variants?.[type] || {} } }));
  }
  function addVariantOption(type) {
    const name = prompt(`Add ${type} option (e.g. black / M):`);
    if (!name) return;
    setForm(prev => ({ ...prev, variants: { ...(prev.variants||{}), [type]: { ...(prev.variants?.[type]||{}), [name]: 0 } } }));
  }
  function updateVariantQty(type, name, qty) {
    setForm(prev => ({ ...prev, variants: { ...(prev.variants||{}), [type]: { ...(prev.variants?.[type]||{}), [name]: Number(qty) } } }));
  }
  function removeVariant(type, name) {
    setForm(prev => {
      const copy = { ...(prev.variants||{}) };
      if (!copy[type]) return prev;
      const sub = { ...copy[type] }; delete sub[name]; copy[type] = sub;
      return { ...prev, variants: copy };
    });
  }

  // save (create or update)
  async function save() {
    if (!categoryId) return alert("Missing category");
    if (!form.productName || !form.productCode) return alert("Name and code required");
    try {
      if (isEdit) {
        // update product
        await firebaseService.updateProduct(categoryId, form.id, {
          productName: form.productName,
          productCode: form.productCode,
          stock: Number(form.stock || 0),
          images: form.images || [],
          variants: form.variants || {}
        });
      } else {
        // create new product (expects id in form)
        const id = form.id || (form.productCode || form.productName).toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
        const payload = { id, productName: form.productName, productCode: form.productCode, stock: Number(form.stock||0), images: form.images||[], variants: form.variants||{} };
        await firebaseService.addProduct(categoryId, payload);
      }
      onClose(true);
    } catch (err) {
      console.error(err);
      alert("Save failed: " + (err.message || err));
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => onClose(false)}>
      <div className="modal" onMouseDown={e=>e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isEdit ? `Edit: ${form.productName}` : "Add Product"}</h3>
          <button className="modal-close" onClick={() => onClose(false)}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-left">
            <label className="label">Name</label>
            <input value={form.productName} onChange={e=>setForm({...form, productName: e.target.value})} />

            <label className="label">Product code</label>
            <input value={form.productCode} onChange={e=>setForm({...form, productCode: e.target.value})} />

            <label className="label">Stock</label>
            <input type="number" value={form.stock} onChange={e=>setForm({...form, stock: Number(e.target.value)})} />

            <label className="label">Images</label>
            <div className="upload-drop" onDrop={onDrop} onDragOver={onDragOver}>
              <div className="upload-controls">
                <button className="btn small" onClick={openFilePicker}>Choose files</button>
                <div className="muted">or drag & drop images here</div>
                <input ref={inputRef} type="file" multiple accept="image/*" style={{display:"none"}} onChange={onFileChange} />
              </div>

              <div className="upload-previews">
                {form.images.map((url, i) => (
                  <div key={i} className="img-preview">
                    <img src={url} alt={`img-${i}`} />
                    <button className="thumb-remove" onClick={() => removeImageAt(i)}>✕</button>
                  </div>
                ))}
              </div>

              <div className="upload-queue">
                {uploadQueue.map((q, i) => (
                  <div className="upload-row" key={i}>
                    <div style={{flex:1}}>{q.name}</div>
                    <div style={{width:120}}>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{width: `${q.progress}%`}} />
                      </div>
                    </div>
                    <div style={{width:70, textAlign:"right"}}>{q.status}</div>
                  </div>
                ))}
              </div>
            </div>

            <label className="label" style={{marginTop:12}}>Variants</label>
            <div className="prod-variant-box">
              {Object.entries(form.variants || {}).map(([type, opts]) => (
                <div key={type} className="variant-card">
                  <div className="variant-header">
                    <strong>{type}</strong>
                    <div>
                      <button className="btn small" onClick={() => addVariantOption(type)}>+ Option</button>
                      <button className="btn small" onClick={() => {
                        const copy = {...form.variants}; delete copy[type]; setForm({...form, variants: copy});
                      }}>Remove Type</button>
                    </div>
                  </div>

                  {Object.entries(opts).map(([name, qty]) => (
                    <div key={name} className="variant-row">
                      <span style={{minWidth:80}}>{name}</span>
                      <input type="number" value={qty} onChange={e=>updateVariantQty(type, name, e.target.value)} />
                      <button className="btn small" onClick={()=>removeVariant(type, name)}>✕</button>
                    </div>
                  ))}
                </div>
              ))}

              <div style={{display:"flex", gap:8, marginTop:8}}>
                <button className="prod-small-btn" onClick={()=>addVariantType("colors")}>+ Color Variant</button>
                <button className="prod-small-btn" onClick={()=>addVariantType("sizes")}>+ Size Variant</button>
                <button className="prod-small-btn" onClick={()=>{ const t = prompt("Variant type (e.g. material)"); if (t) addVariantType(t.trim().toLowerCase()); }}>+ Custom</button>
              </div>
            </div>
          </div>

          <div className="modal-right">
            <h4>Preview</h4>
            <div className="preview-card">
              <div className="preview-img">{form.images[0] ? <img src={form.images[0]} alt="preview" /> : <div className="placeholder">No image</div>}</div>
              <div style={{padding:10}}>
                <div style={{fontWeight:700}}>{form.productName || "Product name"}</div>
                <div style={{color:"#9aa6b2"}}>{form.productCode || "code"}</div>
                <div style={{marginTop:8}}>Stock: {form.stock}</div>
                <div style={{marginTop:8}}>{Object.keys(form.variants || {}).length > 0 ? Object.entries(form.variants).map(([t, opts]) => <div key={t}>{t}: {Object.keys(opts).length} options</div>) : <div className="muted">No variants</div>}</div>
              </div>
            </div>

            <div style={{marginTop:18}}>
              <button className="btn primary" onClick={save}>{isEdit ? "Save Changes" : "Create Product"}</button>
              <button className="btn ghost" style={{marginLeft:8}} onClick={()=>onClose(false)}>Cancel</button>
            </div>

            <div style={{marginTop:24}}>
              <div style={{fontSize:12, color:"#98a6b8"}}>Tips</div>
              <ul style={{color:"#9aa6b2", fontSize:13}}>
                <li>Drag multiple images or click "Choose files" to upload.</li>
                <li>First uploaded image becomes thumbnail.</li>
                <li>Edits update product doc; deletions are permanent.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
