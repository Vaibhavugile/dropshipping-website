// src/reseller/Profile.jsx
import React, { useEffect, useState } from "react";
import { firebaseService } from "../api/firebaseService";
import { getAuth } from "firebase/auth";
import "./profile.css";

// We now keep the full host (hostname + optional port)
// Examples:
//  - "localhost:3000"
//  - "localhost:3001"
//  - "shop.mybrand.com"
function normalizeDomain(input) {
  if (!input) return "";
  let d = input.trim().toLowerCase();

  // Strip protocol if user pastes a full URL
  if (d.startsWith("http://")) d = d.slice(7);
  if (d.startsWith("https://")) d = d.slice(8);

  // Strip path (everything after first /)
  const slashIdx = d.indexOf("/");
  if (slashIdx !== -1) d = d.slice(0, slashIdx);

  // 🔥 IMPORTANT: DO NOT strip port now.
  // "localhost:3000" stays "localhost:3000"
  // "localhost:3001" stays "localhost:3001"
  // "shop.mybrand.com" stays as-is

  return d;
}

export default function ResellerProfile() {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  // logo upload state
  const [logoFile, setLogoFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // domains state
  const [newDomain, setNewDomain] = useState("");
  const [savingDomains, setSavingDomains] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;
  const [resellerId, setResellerId] = useState(null);

  useEffect(() => {
    (async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        // read users/{uid} for resellerId
        const uDoc = await firebaseService.getUserDoc(user.uid);
        const rid = uDoc?.resellerId;
        setResellerId(rid);

        if (rid) {
          const snaps = await firebaseService.getResellerMeta(rid);
          setMeta(snaps);
        }
      } catch (err) {
        console.error("ResellerProfile load error", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ---------------- Logo upload ----------------

  async function onFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setLogoFile(f);
  }

  async function uploadLogo() {
    if (!logoFile || !resellerId) return;
    setUploading(true);
    try {
      const results = await firebaseService.uploadFiles(
        resellerId,
        "branding",
        [logoFile],
        () => {
          // optional progress UI
        }
      );
      const r = results[0];
      // save URL to resellersMeta/{resellerId}.branding.logoUrl
      await firebaseService.updateResellerMeta(resellerId, {
        "branding.logoUrl": r.url,
      });
      setMeta(await firebaseService.getResellerMeta(resellerId));
      setLogoFile(null);
      alert("Logo uploaded");
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ---------------- Domains management ----------------

  const currentDomains = Array.isArray(meta?.domains) ? meta.domains : [];

  async function addDomain() {
    if (!resellerId) return;
    const norm = normalizeDomain(newDomain);
    if (!norm) {
      alert("Please enter a host (e.g. localhost:3000, mystore.com)");
      return;
    }
    if (currentDomains.includes(norm)) {
      alert("This host is already in the list.");
      return;
    }

    setSavingDomains(true);
    try {
      const updated = [...currentDomains, norm];
      await firebaseService.updateResellerMeta(resellerId, {
        domains: updated,
      });
      setMeta((prev) => ({
        ...(prev || {}),
        domains: updated,
      }));
      setNewDomain("");
    } catch (err) {
      console.error("addDomain error", err);
      alert("Failed to save host.");
    } finally {
      setSavingDomains(false);
    }
  }

  async function removeDomain(dom) {
    if (!resellerId) return;
    if (!confirm(`Remove host "${dom}" from this reseller?`)) return;

    setSavingDomains(true);
    try {
      const updated = currentDomains.filter((d) => d !== dom);
      await firebaseService.updateResellerMeta(resellerId, {
        domains: updated,
      });
      setMeta((prev) => ({
        ...(prev || {}),
        domains: updated,
      }));
    } catch (err) {
      console.error("removeDomain error", err);
      alert("Failed to remove host.");
    } finally {
      setSavingDomains(false);
    }
  }

  if (loading) return <div className="res-profile-loading">Loading…</div>;
  if (!resellerId)
    return (
      <div className="res-profile-loading">
        No reseller account found for this user.
      </div>
    );

  return (
    <div className="res-profile-page">
      <header className="res-profile-header">
        <div>
          <h2 className="res-profile-title">Reseller Profile</h2>
          <p className="res-profile-subtitle">
            Manage branding and connect your hosts/domains for auto-detected
            storefronts.
          </p>
        </div>
        <div className="res-profile-badge">ID: {resellerId}</div>
      </header>

      <div className="res-profile-grid">
        {/* Branding / Logo card */}
        <section className="res-profile-card">
          <div className="res-card-header">
            <h3>Branding</h3>
            <p>Upload your store logo to personalize your storefront.</p>
          </div>

          <div className="res-logo-block">
            <span className="res-label">Current logo</span>
            <div className="res-logo-preview">
              {meta?.branding?.logoUrl ? (
                <img
                  src={meta.branding.logoUrl}
                  className="res-logo-img"
                  alt="Store logo"
                />
              ) : (
                <div className="res-logo-placeholder">No logo</div>
              )}
            </div>
          </div>

          <div className="res-logo-upload">
            <label className="res-file-input">
              <input type="file" accept="image/*" onChange={onFileChange} />
              <span>Choose logo</span>
            </label>

            <button
              className="res-btn res-btn-primary"
              onClick={uploadLogo}
              disabled={!logoFile || uploading}
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>

          {logoFile && !uploading && (
            <div className="res-hint">
              Selected: <strong>{logoFile.name}</strong>
            </div>
          )}
        </section>

        {/* Domains / Hosts card */}
        <section className="res-profile-card">
          <div className="res-card-header">
            <h3>Store Hosts / Domains</h3>
            <p>
              These values are matched against <code>window.location.host</code>{" "}
              (hostname + optional port) to auto-detect your storefront.
            </p>
          </div>

          <div className="res-domains-list">
            {currentDomains.length === 0 ? (
              <div className="res-empty">
                No hosts added yet. For example:{" "}
                <code className="res-code-pill">localhost:3000</code> or{" "}
                <code className="res-code-pill">mystore.com</code>.
              </div>
            ) : (
              <ul>
                {currentDomains.map((dom) => (
                  <li key={dom} className="res-domain-item">
                    <span className="res-domain-pill">{dom}</span>
                    <button
                      type="button"
                      className="res-btn res-btn-ghost res-btn-xs"
                      onClick={() => removeDomain(dom)}
                      disabled={savingDomains}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="res-domains-add">
            <input
              type="text"
              placeholder="e.g. localhost:3000, localhost:3001, mystore.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
            />
            <button
              type="button"
              className="res-btn res-btn-primary"
              onClick={addDomain}
              disabled={savingDomains}
            >
              {savingDomains ? "Saving…" : "Add"}
            </button>
          </div>

          <div className="res-domains-tips">
            <div className="res-tips-title">Tips</div>
            <ul>
              <li>
                For port-specific testing, use{" "}
                <code>localhost:3000</code>, <code>localhost:3001</code>, etc.
              </li>
              <li>
                For production, add hosts like{" "}
                <code>shop.mybrand.com</code> or{" "}
                <code>partner-store.com</code> (no protocol, no path).
              </li>
              <li>
                We automatically strip <code>http://</code>,{" "}
                <code>https://</code> and everything after the first{" "}
                <code>/</code>, but we keep ports.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
