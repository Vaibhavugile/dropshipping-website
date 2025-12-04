// src/admin/Login.jsx
import React, { useState } from "react";
import { useAdminAuth } from "./AuthProvider";
import { useNavigate } from "react-router-dom";
import "./login.css";   // 👉 NEW premium CSS file

export default function Login() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate("/admin/categories");
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <h1>Admin Portal</h1>
          <p>Sign in to continue</p>
        </div>

        <form onSubmit={onSubmit} className="login-form">
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>

          {err && <div className="login-error">{err}</div>}
        </form>
      </div>
    </div>
  );
}
