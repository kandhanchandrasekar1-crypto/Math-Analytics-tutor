import { useState, useRef, useEffect } from "react";
import "./Home.css";

const SUGGESTIONS = [
  "Solve 2x² + 5x − 3 = 0",
  "Explain the chain rule",
  "What is a derivative, intuitively?",
  "Integrate sin(x)·cos(x) dx",
];

// ── Icons ──────────────────────────────────────────────
function SigmaIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#c8d5c0" />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle"
        fontSize="15" fontFamily="Georgia, serif" fill="#3b4a35" fontWeight="bold">Σ</text>
    </svg>
  );
}

function IconHistory() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="8" y1="4.5" x2="8" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="8" y1="8" x2="10.5" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M5 3.5l.5 7M9 3.5l-.5 7"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M6 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M10 10l3-2.5L10 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="13" y1="7.5" x2="6" y2="7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M1.5 13.5c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

// ── History helpers ──────────────────────────────────────
const HISTORY_KEY = "math_tutor_history";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function saveHistory(sessions) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
}

// ── Component ────────────────────────────────────────────
export default function Home({ onNavigate }) {
  const [question,      setQuestion]      = useState("");
  const [messages,      setMessages]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [showHistory,   setShowHistory]   = useState(false);
  const [history,       setHistory]       = useState(loadHistory);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const sessionId      = useRef(`s_${Date.now()}`);

  // Load profile for avatar in sidebar
  const profile   = (() => { try { return JSON.parse(localStorage.getItem("math_tutor_profile") || "null"); } catch { return null; } })();
  const avatarImg = localStorage.getItem("math_tutor_avatar") || "";
  const initials  = (profile?.displayName || "Me").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const avatarColor = profile?.avatarColor || "#7a9870";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSend = async (text) => {
    const q = (text ?? question).trim();
    if (!q) return;

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: q }),
      });
      const data = await response.json();
      const botMsg = { role: "bot", content: data.answer };

      setMessages((prev) => {
        const updated = [...prev, botMsg];
        const firstQ  = updated.find(m => m.role === "user")?.content || q;
        const sessions = loadHistory();
        const idx = sessions.findIndex(s => s.id === sessionId.current);
        const entry = {
          id: sessionId.current,
          title: firstQ.length > 50 ? firstQ.slice(0, 50) + "…" : firstQ,
          time: new Date().toLocaleString(),
          messages: updated,
        };
        if (idx >= 0) sessions[idx] = entry; else sessions.unshift(entry);
        saveHistory(sessions.slice(0, 30));
        setHistory(sessions.slice(0, 30));
        return updated;
      });
    } catch {
      setMessages(prev => [...prev, { role: "bot", content: "Error connecting to backend." }]);
    } finally {
      setLoading(false);
    }
  };

  const loadSession = (session) => {
    setMessages(session.messages);
    sessionId.current = session.id;
    setShowHistory(false);
  };

  const deleteSession = (id, e) => {
    e.stopPropagation();
    const updated = history.filter(s => s.id !== id);
    setHistory(updated);
    saveHistory(updated);
  };

  const clearHistory = () => { setHistory([]); saveHistory([]); };

  const newConversation = () => {
    setMessages([]);
    sessionId.current = `s_${Date.now()}`;
    setQuestion("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleLogout = () => { localStorage.removeItem("token"); window.location.reload(); };

  return (
    <div className="layout">

      {/* ── Sidebar ── */}
      <aside className="sidebar">

        {/* Brand */}
        <div className="brand">
          <SigmaIcon size={40} />
          <div className="brand-text">
            <span className="brand-eyebrow">LOVABLE</span>
            <span className="brand-name">Math Tutor</span>
          </div>
        </div>

        {/* Hero */}
        <div className="hero-copy">
          <h1>A calmer way to <em>think in numbers.</em></h1>
          <p className="hero-sub">
            Ask anything from arithmetic to calculus. Your tutor explains
            the reasoning, not just the result — at your pace.
          </p>
        </div>

        {/* Features */}
        <ul className="feature-list">
          <li>
            <span className="feat-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="16" height="16" rx="3" stroke="#7a9870" strokeWidth="1.5"/>
                <line x1="4" y1="6" x2="14" y2="6" stroke="#7a9870" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="4" y1="9" x2="14" y2="9" stroke="#7a9870" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="4" y1="12" x2="10" y2="12" stroke="#7a9870" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <div><strong>Step-by-step</strong><p>Every solution is broken down into clear, ordered steps.</p></div>
          </li>
          <li>
            <span className="feat-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="16" height="16" rx="3" stroke="#7a9870" strokeWidth="1.5"/>
                <text x="9" y="13" textAnchor="middle" fontSize="9" fontFamily="serif" fill="#7a9870">∑</text>
              </svg>
            </span>
            <div><strong>Any topic</strong><p>Algebra, geometry, calculus, probability — bring it on.</p></div>
          </li>
          <li>
            <span className="feat-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7.5" stroke="#7a9870" strokeWidth="1.5"/>
                <line x1="9" y1="5" x2="9" y2="9" stroke="#7a9870" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="9" y1="9" x2="12" y2="12" stroke="#7a9870" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <div><strong>Patient by design</strong><p>No judgment. Ask the same question twice if you need to.</p></div>
          </li>
        </ul>

        {/* Sidebar actions */}
        <div className="sidebar-actions">
          <button className="sidebar-btn" onClick={newConversation}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            New conversation
          </button>

          <button className="sidebar-btn" onClick={() => setShowHistory(true)}>
            <IconHistory />
            View history
            {history.length > 0 && <span className="history-badge">{history.length}</span>}
          </button>
        </div>

        {/* ── Profile card + footer ── */}
        <div className="sidebar-footer">

          {/* Profile mini card */}
          <button className="profile-mini-card" onClick={() => onNavigate("profile")}>
            <div
              className="profile-mini-avatar"
              style={{ background: avatarImg ? "transparent" : avatarColor }}
            >
              {avatarImg
                ? <img src={avatarImg} alt="avatar" className="profile-mini-avatar-img" />
                : <span className="profile-mini-initials">{initials}</span>
              }
            </div>
            <div className="profile-mini-text">
              <span className="profile-mini-name">{profile?.displayName || "My Profile"}</span>
              <span className="profile-mini-hint">View &amp; edit profile →</span>
            </div>
            <IconUser />
          </button>

          <p style={{ fontSize: "11.5px", color: "#9a9890" }}>
            Connected to <code>127.0.0.1:8000</code>
          </p>

          {/* Logout */}
          {!logoutConfirm ? (
            <button className="logout-btn" onClick={() => setLogoutConfirm(true)}>
              <IconLogout />
              Sign out
            </button>
          ) : (
            <div className="logout-confirm">
              <span>Sure?</span>
              <button className="logout-confirm-yes" onClick={handleLogout}>Yes</button>
              <button className="logout-confirm-no"  onClick={() => setLogoutConfirm(false)}>Cancel</button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        <div className="main-header">
          <h2 className="section-title">Conversation</h2>
        </div>

        <div className="chat-panel">
          {messages.length === 0 && !loading ? (
            <div className="empty-state">
              <SigmaIcon size={52} />
              <h3>What shall we work on?</h3>
              <p>Type a question below, or start from one of these.</p>
              <div className="suggestions">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="suggestion-chip" onClick={() => handleSend(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((msg, i) => (
                <div key={i} className={`message message--${msg.role}`}>
                  {msg.role === "bot" && <span className="msg-avatar"><SigmaIcon size={22} /></span>}
                  <div className="msg-bubble">{msg.content}</div>
                  {msg.role === "user" && <span className="msg-avatar msg-avatar--user">You</span>}
                </div>
              ))}
              {loading && (
                <div className="message message--bot">
                  <span className="msg-avatar"><SigmaIcon size={22} /></span>
                  <div className="msg-bubble msg-bubble--loading"><span /><span /><span /></div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="input-row">
          <textarea
            ref={textareaRef}
            className="input-field"
            rows={1}
            placeholder="Ask a math question…  (Shift + Enter for a new line)"
            value={question}
            onChange={e => { setQuestion(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
          />
          <button className="send-btn" onClick={() => handleSend()}
            disabled={!question.trim() || loading} aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 9L16 2L9 16L8 10L2 9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <p className="input-hint">Press <kbd>Enter</kbd> to send</p>
      </main>

      {/* ── History Drawer ── */}
      {showHistory && (
        <div className="history-backdrop" onClick={() => setShowHistory(false)}>
          <div className="history-drawer" onClick={e => e.stopPropagation()}>
            <div className="history-header">
              <div className="history-header-left"><IconHistory /><span>Chat History</span></div>
              <div className="history-header-right">
                {history.length > 0 && (
                  <button className="history-clear-btn" onClick={clearHistory}>Clear all</button>
                )}
                <button className="history-close-btn" onClick={() => setShowHistory(false)}><IconClose /></button>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="history-empty">
                <IconHistory />
                <p>No history yet.</p>
                <span>Your conversations will appear here.</span>
              </div>
            ) : (
              <ul className="history-list">
                {history.map(session => (
                  <li key={session.id} className="history-item" onClick={() => loadSession(session)}>
                    <div className="history-item-text">
                      <span className="history-item-title">{session.title}</span>
                      <span className="history-item-time">{session.time}</span>
                    </div>
                    <button className="history-delete-btn"
                      onClick={e => deleteSession(session.id, e)} aria-label="Delete">
                      <IconTrash />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
