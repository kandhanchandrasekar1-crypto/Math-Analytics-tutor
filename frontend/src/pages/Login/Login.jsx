import { useState } from "react";
import "./Login.css";

function SigmaIcon({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="16" cy="16" r="16" fill="#c8d5c0" />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="15"
        fontFamily="Georgia, serif"
        fill="#3b4a35"
        fontWeight="bold"
      >
        Σ
      </text>
    </svg>
  );
}

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);

  // ── Login state ──
  const [loginEmail,   setLoginEmail]   = useState("");
  const [loginPass,    setLoginPass]    = useState("");
  const [loginError,   setLoginError]   = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Register state ──
  const [regUsername, setRegUsername] = useState("");
  const [regEmail,    setRegEmail]    = useState("");
  const [regPass,     setRegPass]     = useState("");
  const [regError,    setRegError]    = useState("");
  const [regLoading,  setRegLoading]  = useState(false);
  const [regSuccess,  setRegSuccess]  = useState("");

  // ── Handle Login ──
  const handleLogin = async () => {
    setLoginError("");
    if (!loginEmail.trim() || !loginPass.trim()) {
      setLoginError("Please enter your email and password.");
      return;
    }
    setLoginLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", loginEmail.trim());
      formData.append("password", loginPass);

      const response = await fetch("http://127.0.0.1:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setLoginError(data.detail || "Invalid credentials. Please try again.");
        return;
      }

      localStorage.setItem("token", data.access_token);
      window.location.reload();
    } catch {
      setLoginError("Unable to connect to the backend. Make sure it is running.");
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Handle Register ──
  const handleRegister = async () => {
    setRegError("");
    setRegSuccess("");
    if (!regUsername.trim() || !regEmail.trim() || !regPass.trim()) {
      setRegError("Please fill in all fields.");
      return;
    }
    setRegLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername.trim(),
          email:    regEmail.trim(),
          password: regPass,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setRegError(data.detail || "Registration failed. Please try again.");
        return;
      }

      setRegSuccess("Account created! Redirecting to sign in…");
      setRegUsername("");
      setRegEmail("");
      setRegPass("");
      setTimeout(() => {
        setRegSuccess("");
        setIsLogin(true);
      }, 1500);
    } catch {
      setRegError("Unable to connect to the backend. Make sure it is running.");
    } finally {
      setRegLoading(false);
    }
  };

  const handleLoginKey = (e) => { if (e.key === "Enter") handleLogin(); };
  const handleRegKey   = (e) => { if (e.key === "Enter") handleRegister(); };

  return (
    <div className="auth-wrapper">
      <div className={`auth-card ${isLogin ? "show-login" : "show-register"}`}>

        {/* ── LEFT: Login Form ── */}
        <div className="auth-panel form-panel login-form-panel">
          <SigmaIcon size={44} />
          <h2 className="form-title">Sign In</h2>
          <p className="form-sub">Welcome back — let's keep learning.</p>

          <div className="input-group">
            <label className="input-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              onKeyDown={handleLoginKey}
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="login-pass">Password</label>
            <input
              id="login-pass"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              onKeyDown={handleLoginKey}
              autoComplete="current-password"
            />
          </div>

          {loginError && (
            <div className="auth-error" role="alert">
              <span className="auth-error-dot" />
              {loginError}
            </div>
          )}

          <button
            className="primary-btn"
            onClick={handleLogin}
            disabled={loginLoading}
          >
            {loginLoading ? "Signing in…" : "Sign In"}
          </button>
        </div>

        {/* ── RIGHT: Register Form ── */}
        <div className="auth-panel form-panel register-form-panel">
          <SigmaIcon size={44} />
          <h2 className="form-title">Create Account</h2>
          <p className="form-sub">Start your math journey today.</p>

          <div className="input-group">
            <label className="input-label" htmlFor="reg-username">Username</label>
            <input
              id="reg-username"
              type="text"
              className="auth-input"
              placeholder="e.g. mathwiz42"
              value={regUsername}
              onChange={(e) => setRegUsername(e.target.value)}
              onKeyDown={handleRegKey}
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              onKeyDown={handleRegKey}
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="reg-pass">Password</label>
            <input
              id="reg-pass"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={regPass}
              onChange={(e) => setRegPass(e.target.value)}
              onKeyDown={handleRegKey}
              autoComplete="new-password"
            />
          </div>

          {regError && (
            <div className="auth-error" role="alert">
              <span className="auth-error-dot" />
              {regError}
            </div>
          )}

          {regSuccess && (
            <div className="auth-success" role="status">
              <span className="auth-success-dot" />
              {regSuccess}
            </div>
          )}

          <button
            className="primary-btn"
            onClick={handleRegister}
            disabled={regLoading}
          >
            {regLoading ? "Creating account…" : "Register"}
          </button>
        </div>

        {/* ── SLIDING SAGE GREEN OVERLAY ── */}
        <div className="overlay-panel">
          <div className="overlay-brand">
            <SigmaIcon size={36} />
            <span className="overlay-brand-name">Math Tutor</span>
          </div>

          {/* Shown when LOGIN is active */}
          <div className="overlay-content overlay-left">
            <h2 className="overlay-title">Hello, Welcome!</h2>
            <p className="overlay-sub">
              New here? Create a free account and start solving problems at your own pace.
            </p>
            <button className="outline-btn" onClick={() => setIsLogin(false)}>
              Register
            </button>
          </div>

          {/* Shown when REGISTER is active */}
          <div className="overlay-content overlay-right">
            <h2 className="overlay-title">Welcome Back!</h2>
            <p className="overlay-sub">
              Already have an account? Sign in and pick up right where you left off.
            </p>
            <button className="outline-btn" onClick={() => setIsLogin(true)}>
              Sign In
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
