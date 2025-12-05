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
 * (All previous methods preserved)
 *
 * New helper:
 * - getAdminByEmail(email) => returns admin doc data or null
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

// inside your firebaseService export (src/api/firebaseService.js)

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
      // prefer server timestamp but client-side we use JS Date()
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
  }
};
