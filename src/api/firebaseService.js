// src/api/firebaseService.js
import { db, functions, storage } from "../firebase";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from "firebase/firestore";

import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "firebase/storage";

/**
 * Firestore + Storage implementation for admin & UI
 *
 * Note: ensure your src/firebase.js exports `db`, `functions`, and `storage`.
 */

export const firebaseService = {
  // ---------- Public reads (UI) ----------
  async listCategories() {
    try {
      const col = collection(db, "categories");
      const snap = await getDocs(col);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("listCategories error:", err);
      throw err;
    }
  },

  async listProductsByCategory(categoryId) {
    try {
      const col = collection(db, "categories", categoryId, "products");
      const snap = await getDocs(col);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("listProductsByCategory error:", err);
      throw err;
    }
  },

  async getPriceRoleRules(categoryId, role) {
    try {
      const roleRef = doc(db, "categories", categoryId, "priceRoles", role);
      const snap = await getDoc(roleRef);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.error("getPriceRoleRules error:", err);
      throw err;
    }
  },

  async listResellerOrders(resellerId) {
    try {
      const col = collection(db, "resellers", resellerId, "orders");
      const snap = await getDocs(col);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("listResellerOrders error:", err);
      throw err;
    }
  },

  // ---------- Server-side callable (orders) ----------
  async createOrderAggregate(payload) {
    try {
      const fn = httpsCallable(functions, "createOrderAggregate");
      const res = await fn(payload);
      return res.data;
    } catch (err) {
      console.error("createOrderAggregate error (client):", err);
      const msg = err?.message || err?.code || JSON.stringify(err);
      throw new Error(msg);
    }
  },

  // ---------- Admin helpers (used by Admin Panel) ----------
  async addCategory({ id, name, images = [] }) {
    try {
      await setDoc(doc(db, "categories", id), { id, name, images });
    } catch (err) {
      console.error("addCategory error:", err);
      throw err;
    }
  },

  async deleteCategory(categoryId) {
    try {
      await deleteDoc(doc(db, "categories", categoryId));
    } catch (err) {
      console.error("deleteCategory error:", err);
      throw err;
    }
  },

  async getCategoryPriceRoles(categoryId) {
    try {
      const col = collection(db, "categories", categoryId, "priceRoles");
      const snap = await getDocs(col);
      const out = {};
      snap.forEach(s => { out[s.id] = s.data(); });
      return out;
    } catch (err) {
      console.error("getCategoryPriceRoles error:", err);
      throw err;
    }
  },

  async setCategoryPriceRoles(categoryId, rolesObj) {
    try {
      const promises = Object.entries(rolesObj || {}).map(([roleId, roleDoc]) =>
        setDoc(doc(db, "categories", categoryId, "priceRoles", roleId), roleDoc)
      );
      await Promise.all(promises);
    } catch (err) {
      console.error("setCategoryPriceRoles error:", err);
      throw err;
    }
  },

  async addProduct(categoryId, product) {
    try {
      await setDoc(doc(db, "categories", categoryId, "products", product.id), product);
    } catch (err) {
      console.error("addProduct error:", err);
      throw err;
    }
  },

  async updateProduct(categoryId, productId, patchObj) {
    try {
      await updateDoc(doc(db, "categories", categoryId, "products", productId), patchObj);
    } catch (err) {
      console.error("updateProduct error:", err);
      throw err;
    }
  },

  async deleteProduct(categoryId, productId) {
    try {
      await deleteDoc(doc(db, "categories", categoryId, "products", productId));
    } catch (err) {
      console.error("deleteProduct error:", err);
      throw err;
    }
  },

  // ---------- Reseller meta helpers ----------
  async addReseller(rs) {
    try {
      await setDoc(doc(db, "resellersMeta", rs.id), rs);
    } catch (err) {
      console.error("addReseller error:", err);
      throw err;
    }
  },

  async listResellers() {
    try {
      const snaps = await getDocs(collection(db, "resellersMeta"));
      return snaps.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("listResellers error:", err);
      throw err;
    }
  },

  async listAllOrders() {
    try {
      const resellersSnap = await getDocs(collection(db, "resellersMeta"));
      const resellers = resellersSnap.docs.map(d => d.id);
      const allOrders = [];
      for (const r of resellers) {
        const ordersSnap = await getDocs(collection(db, "resellers", r, "orders"));
        ordersSnap.forEach(o => {
          const data = o.data();
          allOrders.push({
            id: o.id,
            resellerId: r,
            ...data
          });
        });
      }
      allOrders.sort((a, b) => {
        const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bt - at;
      });
      return allOrders;
    } catch (err) {
      console.error("listAllOrders error:", err);
      throw err;
    }
  },

  // ---------- Storage helpers ----------
  async uploadFiles(categoryId, productId, files, onProgress = null) {
    try {
      if (!categoryId || !productId) throw new Error("Missing categoryId or productId for upload");
      const results = [];

      for (const file of Array.from(files)) {
        const nameSafe = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        const path = `products/${categoryId}/${productId}/${nameSafe}`;
        const ref = storageRef(storage, path);
        const uploadTask = uploadBytesResumable(ref, file);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              if (onProgress && typeof onProgress === "function") {
                const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                onProgress({ name: file.name, path, percent, bytesTransferred: snapshot.bytesTransferred, total: snapshot.totalBytes });
              }
            },
            (err) => reject(err),
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              results.push({ url, path, name: file.name, size: file.size, contentType: file.type });
              resolve();
            }
          );
        });
      }

      return results;
    } catch (err) {
      console.error("uploadFiles error:", err);
      throw err;
    }
  },

  async deleteFile(storagePath) {
    try {
      if (!storagePath) throw new Error("Missing storagePath");
      const ref = storageRef(storage, storagePath);
      await deleteObject(ref);
      return { success: true };
    } catch (err) {
      console.error("deleteFile error:", err);
      throw err;
    }
  },

  // ---------- Convenience helpers ----------
  // Get admin doc by email (returns first match or null)
  async getAdminByEmail(email) {
    try {
      if (!email) return null;
      const qCol = collection(db, "admins");
      const q = query(qCol, where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { id: d.id, ...d.data() };
      }
      return null;
    } catch (err) {
      console.error("getAdminByEmail error:", err);
      throw err;
    }
  },

  // Get reseller metadata
  async getResellerMeta(resellerId) {
    try {
      const snap = await getDoc(doc(db, "resellersMeta", resellerId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch (err) {
      console.error("getResellerMeta error:", err);
      throw err;
    }
  },

  async getUserDoc(uid) {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.error("getUserDoc error:", err);
      throw err;
    }
  },

  /**
   * Create a user doc in /users/{uid}
   * Used after creating a Firebase Auth user from the client (REST) or server.
   * `userObj` should be a plain POJO. We will not write undefined values.
   */
  async createUserDoc(uid, userObj = {}) {
    try {
      if (!uid) throw new Error("Missing uid");
      // remove undefined values
      const clean = Object.fromEntries(
        Object.entries(userObj).filter(([k, v]) => v !== undefined)
      );
      // client-side timestamp
      if (!clean.createdAt) clean.createdAt = new Date();
      await setDoc(doc(db, "users", uid), clean);
      return { success: true };
    } catch (err) {
      console.error("createUserDoc error:", err);
      throw err;
    }
  },

  // Partial update of reseller metadata
  async updateResellerMeta(resellerId, patchObj) {
    try {
      await updateDoc(doc(db, "resellersMeta", resellerId), patchObj);
      return true;
    } catch (err) {
      console.error("updateResellerMeta error:", err);
      throw err;
    }
  },

  // Resolve reseller by domain/hostname (returns first match or null)
  async getResellerByDomain(hostname) {
    try {
      const qCol = collection(db, "resellersMeta");
      const q = query(qCol, where("domains", "array-contains", hostname));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { id: d.id, ...d.data() };
      }
      return null;
    } catch (err) {
      console.error("getResellerByDomain error:", err);
      throw err;
    }
  },

  // -------------------------------------------------------------------
  // Additions: Admin-wide product listing + reseller product & pricing (Option B)
  // -------------------------------------------------------------------

  /**
   * List all admin products across all categories.
   * Returns array of { categoryId, categoryName, product: { ... } }
   */
  async listAllAdminProducts() {
    try {
      const cats = await this.listCategories();
      const out = [];
      for (const c of cats) {
        const prods = await this.listProductsByCategory(c.id);
        for (const p of prods) {
          out.push({
            categoryId: c.id,
            categoryName: c.name,
            product: p
          });
        }
      }
      return out;
    } catch (err) {
      console.error("listAllAdminProducts error:", err);
      throw err;
    }
  },

  /**
   * Get reseller's currently selected products (map productId -> doc data)
   * Scans legacy selectedProducts plus Option B per-category products and merges into a flat map.
   */
  async getResellerSelectedProducts(resellerId) {
    try {
      const map = {};

      // legacy selectedProducts (back-compat)
      try {
        const legacyCol = collection(db, "resellersMeta", resellerId, "selectedProducts");
        const legacySnap = await getDocs(legacyCol);
        legacySnap.forEach(d => { map[d.id] = d.data(); });
      } catch (e) {
        // ignore legacy errors
      }

      // Option B: per-category products
      const catsCol = collection(db, "resellersMeta", resellerId, "categories");
      const catsSnap = await getDocs(catsCol);
      if (!catsSnap.empty) {
        for (const cDoc of catsSnap.docs) {
          const cid = cDoc.id;
          const prodCol = collection(db, "resellersMeta", resellerId, "categories", cid, "products");
          const prodSnap = await getDocs(prodCol);
          prodSnap.forEach(pDoc => {
            map[pDoc.id] = pDoc.data();
          });
        }
      }

      return map;
    } catch (err) {
      console.error("getResellerSelectedProducts error:", err);
      throw err;
    }
  },

  /**
   * Save (set) reseller product doc. Writes option-B and legacy location.
   * Option B target:
   * resellersMeta/{resellerId}/categories/{categoryId}/products/{productId}
   *
   * Legacy:
   * resellersMeta/{resellerId}/selectedProducts/{productId}
   */
  async setResellerProduct(resellerId, productId, data) {
    try {
      if (!resellerId || !productId) throw new Error("Missing resellerId or productId");

      const clean = Object.fromEntries(Object.entries(data).filter(([k, v]) => v !== undefined));
      if (!clean.updatedAt) clean.updatedAt = new Date();

      // Option B: if categoryId provided, write under the category products subcollection
      if (clean.categoryId) {
        await setDoc(doc(db, "resellersMeta", resellerId, "categories", clean.categoryId, "products", productId), clean, { merge: true });
      }

      // Legacy write for compatibility
      try {
        await setDoc(doc(db, "resellersMeta", resellerId, "selectedProducts", productId), clean, { merge: true });
      } catch (legacyErr) {
        console.warn("legacy selectedProducts write failed", legacyErr);
      }

      return { success: true };
    } catch (err) {
      console.error("setResellerProduct error:", err);
      throw err;
    }
  },

  /**
   * Get reseller price roles for a category (reseller-specific override)
   *
   * Primary (Option B): subcollection
   * resellersMeta/{resellerId}/categories/{categoryId}/priceRoles/{roleId}
   *
   * Secondary: category doc contains { roles: { ... } } at
   * resellersMeta/{resellerId}/categories/{categoryId}
   *
   * Fallback (legacy): resellersMeta/{resellerId}/priceRoles/{categoryId} (doc)
   *
   * Returns object of roleId => roleDoc  or null
   */
  async getResellerCategoryRoles(resellerId, categoryId) {
    try {
      if (!resellerId || !categoryId) return null;

      // 1) Primary: read subcollection priceRoles/{roleId}
      try {
        const rolesCol = collection(db, "resellersMeta", resellerId, "categories", categoryId, "priceRoles");
        const rolesSnap = await getDocs(rolesCol);
        if (!rolesSnap.empty) {
          const out = {};
          rolesSnap.forEach(r => { out[r.id] = r.data(); });
          return out;
        }
      } catch (e) {
        // continue to other fallbacks
      }

      // 2) Secondary: maybe the category doc stores roles as a field { roles: {...} }
      try {
        const catDocRef = doc(db, "resellersMeta", resellerId, "categories", categoryId);
        const catSnap = await getDoc(catDocRef);
        if (catSnap.exists()) {
          const data = catSnap.data();
          if (data && (data.roles || Object.keys(data).length > 0)) {
            // If there's explicit roles field return it; otherwise return null
            return data.roles || null;
          }
        }
      } catch (e) {
        // continue
      }

      // 3) Fallback legacy path: resellersMeta/{resellerId}/priceRoles/{categoryId}
      try {
        const fallbackRef = doc(db, "resellersMeta", resellerId, "priceRoles", categoryId);
        const fallbackSnap = await getDoc(fallbackRef);
        if (fallbackSnap.exists()) {
          const d = fallbackSnap.data();
          return d.roles || d;
        }
      } catch (e) {
        // final fallback
      }

      return null;
    } catch (err) {
      console.error("getResellerCategoryRoles error:", err);
      throw err;
    }
  },

  /**
   * Set reseller price roles for a category (Option B).
   * Writes role documents to:
   * resellersMeta/{resellerId}/categories/{categoryId}/priceRoles/{roleId}
   *
   * Also writes a summary field "roles" on the category doc for convenience/fast-read.
   */
  async setResellerCategoryRoles(resellerId, categoryId, rolesObj) {
    try {
      if (!resellerId || !categoryId) throw new Error("Missing resellerId or categoryId");

      // 1) write each role as a document in the subcollection
      const promises = [];
      for (const [roleId, roleDoc] of Object.entries(rolesObj || {})) {
        promises.push(
          setDoc(doc(db, "resellersMeta", resellerId, "categories", categoryId, "priceRoles", roleId), roleDoc)
        );
      }
      await Promise.all(promises);

      // 2) write a convenience summary on the category doc
      try {
        await setDoc(doc(db, "resellersMeta", resellerId, "categories", categoryId), { roles: rolesObj }, { merge: true });
      } catch (e) {
        // not fatal
        console.warn("writing category summary roles field failed", e);
      }

      // 3) also write to legacy location for compatibility (non-fatal)
      try {
        await setDoc(doc(db, "resellersMeta", resellerId, "priceRoles", categoryId), { roles: rolesObj }, { merge: true });
      } catch (e) {
        // ignore
      }

      return { success: true };
    } catch (err) {
      console.error("setResellerCategoryRoles error:", err);
      throw err;
    }
  },

  /**
   * Convenience: get all products saved under reseller/category products subcollections
   * returns: { categoryId: { productId: productDoc, ... }, ... }
   */
  async getResellerCategoryProducts(resellerId, categoryId) {
    try {
      const out = {};
      if (!resellerId || !categoryId) return out;
      const prodCol = collection(db, "resellersMeta", resellerId, "categories", categoryId, "products");
      const snap = await getDocs(prodCol);
      snap.forEach(d => { out[d.id] = d.data(); });
      return out;
    } catch (err) {
      console.error("getResellerCategoryProducts error:", err);
      throw err;
    }
  },

  /**
   * Set a single reseller category product doc (Option B)
   */
  async setResellerCategoryProduct(resellerId, categoryId, productId, data) {
    try {
      if (!resellerId || !categoryId || !productId) throw new Error("Missing identifiers");
      const clean = Object.fromEntries(Object.entries(data).filter(([k, v]) => v !== undefined));
      if (!clean.updatedAt) clean.updatedAt = new Date();
      await setDoc(doc(db, "resellersMeta", resellerId, "categories", categoryId, "products", productId), clean, { merge: true });
      // Also update legacy selectedProducts for compatibility
      try {
        await setDoc(doc(db, "resellersMeta", resellerId, "selectedProducts", productId), clean, { merge: true });
      } catch (legacyErr) {
        console.warn("legacy selectedProducts write failed", legacyErr);
      }
      return { success: true };
    } catch (err) {
      console.error("setResellerCategoryProduct error:", err);
      throw err;
    }
  },

  // ---------------------- Backwards-compatible wrappers ----------------------

  async getResellerPriceRoles(resellerId, categoryId) {
    try {
      return await this.getResellerCategoryRoles(resellerId, categoryId);
    } catch (err) {
      console.error("getResellerPriceRoles (shim) error:", err);
      throw err;
    }
  },

  async setResellerPriceRoles(resellerId, categoryId, rolesObj) {
    try {
      return await this.setResellerCategoryRoles(resellerId, categoryId, rolesObj);
    } catch (err) {
      console.error("setResellerPriceRoles (shim) error:", err);
      throw err;
    }
  },

  /**
   * Compute unit price for a role (tries reseller override first, then admin category)
   * role: 'reseller' by default. qty default 1.
   * Returns price number or throws if no rule found.
   */
  async computeUnitPriceForRole(categoryId, role = "reseller", qty = 1, resellerId = null) {
    try {
      // try reseller override (Option B)
      if (resellerId) {
        const resellerRoles = await this.getResellerPriceRoles(resellerId, categoryId);
        if (resellerRoles && resellerRoles[role] && Array.isArray(resellerRoles[role].rules)) {
          const rules = resellerRoles[role].rules;
          for (const r of rules) {
            const min = Number(r.min || 0);
            const max = Number(r.max || 9999999);
            if (qty >= min && qty <= max) return Number(r.price);
          }
        }
      }

      // fallback to admin category rules
      const roleDoc = await this.getPriceRoleRules(categoryId, role);
      if (roleDoc && Array.isArray(roleDoc.rules)) {
        for (const r of roleDoc.rules) {
          const min = Number(r.min || 0);
          const max = Number(r.max || 9999999);
          if (qty >= min && qty <= max) return Number(r.price);
        }
      }

      throw new Error(`No pricing rule matches qty ${qty} for role ${role} in category ${categoryId}`);
    } catch (err) {
      console.error("computeUnitPriceForRole error:", err);
      throw err;
    }
  },

  // -------------------------------------------------------------------
  // End of firebaseService
  // -------------------------------------------------------------------
};
