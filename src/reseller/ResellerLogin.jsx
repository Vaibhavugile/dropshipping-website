// src/reseller/ResellerLogin.jsx
import React, { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./reseller-login.css";


export default function ResellerLogin() {
  const nav = useNavigate();
  const auth = getAuth();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      nav("/reseller/profile");
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="reseller-login-wrapper">
      <form className="reseller-login-card" onSubmit={submit}>
        <h2>Reseller Login</h2>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />

        {err && <div className="error">{err}</div>}

        <button type="submit">Log In</button>
      </form>
    </div>
  );
}
