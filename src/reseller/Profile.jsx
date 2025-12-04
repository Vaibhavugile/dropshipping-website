// src/reseller/Profile.jsx
import React, { useEffect, useState } from "react";
import { firebaseService } from "../api/firebaseService";
import { getAuth } from "firebase/auth";

export default function ResellerProfile() {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logoFile, setLogoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const auth = getAuth();
  const user = auth.currentUser;
  const [resellerId, setResellerId] = useState(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      // read users/{uid} for resellerId
      const uDoc = (await firebaseService.getUserDoc(user.uid));
      const rid = uDoc?.resellerId;
      setResellerId(rid);
      if (rid) {
        const snaps = await firebaseService.getResellerMeta(rid);
        setMeta(snaps);
      }
      setLoading(false);
    })();
  }, [user]);

  async function onFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setLogoFile(f);
  }

  async function uploadLogo() {
    if (!logoFile || !resellerId) return;
    setUploading(true);
    try {
      const results = await firebaseService.uploadFiles(resellerId, 'branding', [logoFile], (p) => {
        // optional progress UI
      });
      const r = results[0];
      // save URL to resellersMeta/resellerId.branding.logoUrl
      await firebaseService.updateResellerMeta(resellerId, { "branding.logoUrl": r.url });
      setMeta(await firebaseService.getResellerMeta(resellerId));
      setLogoFile(null);
      alert("Logo uploaded");
    } catch (err) {
      console.error(err); alert("Upload failed");
    } finally { setUploading(false); }
  }

  if (loading) return <div>Loading…</div>;
  if (!resellerId) return <div>No reseller account found for this user.</div>;

  return (
    <div>
      <h3>Reseller Profile — {resellerId}</h3>
      <div>
        <div>Current logo:</div>
        {meta?.branding?.logoUrl ? <img src={meta.branding.logoUrl} style={{width:120}} /> : <div>No logo</div>}
      </div>

      <div style={{ marginTop: 12 }}>
        <input type="file" accept="image/*" onChange={onFileChange} />
        <button onClick={uploadLogo} disabled={!logoFile || uploading}>{uploading ? "Uploading…" : "Upload Logo"}</button>
      </div>
    </div>
  );
}
