import { useState, useRef, useEffect } from "react";
import "./Home.css";

const SUGGESTIONS = [
  "Solve 2x² + 5x − 3 = 0",
  "Explain the chain rule",
  "What is a derivative, intuitively?",
  "Integrate sin(x)·cos(x) dx",
];

/* ── JWT decode ── */
function decodeToken(token) {
  try { return JSON.parse(atob(token.split(".")[1])); }
  catch { return null; }
}

/* ── Per-user history (keyed by user ID) ── */
function loadHistory(uid) {
  try { return JSON.parse(localStorage.getItem(`math_history_${uid}`) || "[]"); }
  catch { return []; }
}
function saveHistory(uid, sessions) {
  localStorage.setItem(`math_history_${uid}`, JSON.stringify(sessions));
}

/* ── Icons ── */
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
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="7.5" y1="4" x2="7.5" y2="7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="7.5" y1="7.5" x2="10" y2="9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 3h9M5 3V2h3v1M4.5 3l.5 6.5M8.5 3l-.5 6.5"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M5.5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M9.5 9.5l3-2.5-3-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="12.5" y1="7" x2="5.5" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <line x1="2" y1="2" x2="11" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="11" y1="2" x2="2" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <line x1="6.5" y1="1" x2="6.5" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="1" y1="6.5" x2="12" y2="6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════ */
export default function Home({ onNavigate }) {
  const token   = localStorage.getItem("token");
  const decoded = decodeToken(token);
  const userId  = String(decoded?.sub || decoded?.id || "guest");

  /* ── Fetch real user info from /me endpoint ── */
  const [userInfo, setUserInfo] = useState(() => {
    // Try cached user info first so name appears instantly
    try { return JSON.parse(localStorage.getItem(`user_info_${userId}`) || "null"); }
    catch { return null; }
  });

  useEffect(() => {
    if (!token) return;
    fetch("http://127.0.0.1:8000/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        // Cache it so next load is instant
        localStorage.setItem(`user_info_${userId}`, JSON.stringify(data));
        setUserInfo(data);
      })
      .catch(() => {});
  }, [token, userId]);

  /* ── Derive display values ── */
  // userInfo fields: adjust field names to match YOUR backend response
  const realUsername = userInfo?.username || userInfo?.name  || userInfo?.email || "";
  const realEmail    = userInfo?.email    || "";

  // Profile overrides (if user set a display name in profile page)
  const savedProfile  = (() => { try { return JSON.parse(localStorage.getItem("math_tutor_profile") || "null"); } catch { return null; } })();
  const avatarImg     = localStorage.getItem("math_tutor_avatar") || "";
  const displayName   = savedProfile?.displayName || realUsername || "You";
  const avatarColor   = savedProfile?.avatarColor || "#7a9870";
  const initials      = displayName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";

  // Save fetched info so Profile page can read it
  useEffect(() => {
    if (!userInfo) return;
    const existing = (() => { try { return JSON.parse(localStorage.getItem("math_tutor_profile") || "null"); } catch { return null; } })();
    if (!existing) {
      // Pre-fill profile with real data on first login
      const pre = {
        displayName:  userInfo.username || userInfo.name || "",
        username:     userInfo.username || "",
        email:        userInfo.email    || "",
        bio:          "",
        level:        "Beginner",
        avatarColor:  "#7a9870",
        joinDate:     new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      };
      localStorage.setItem("math_tutor_profile", JSON.stringify(pre));
    }
  }, [userInfo]);

  /* ── Greeting ── */
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  /* ── Chat state ── */
  const [question,      setQuestion]      = useState("");
  const [messages,      setMessages]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [showHistory,   setShowHistory]   = useState(false);
  const [history,       setHistory]       = useState(() => loadHistory(userId));
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const sessionId      = useRef(`s_${Date.now()}`);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  /* ── Send message ── */
  const handleSend = async (text) => {
    const q = (text ?? question).trim();
    if (!q) return;

    setMessages(prev => [...prev, { role: "user", content: q }]);
    setQuestion("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const response = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: q }),
      });

      const data = await response.json();

      // Handle different possible response shapes from backend
      // Try: data.answer, data.response, data.message, data.content, or the full string
      const botAnswer =
        data?.answer   ||
        data?.response ||
        data?.message  ||
        data?.content  ||
        data?.result   ||
        (typeof data === "string" ? data : null) ||
        "Sorry, I could not get a response.";

      const botMsg = { role: "bot", content: botAnswer };

      setMessages(prev => {
        const updated = [...prev, botMsg];

        // Save session to per-user history
        const firstQ   = updated.find(m => m.role === "user")?.content || q;
        const sessions = loadHistory(userId);
        const idx      = sessions.findIndex(s => s.id === sessionId.current);
        const entry = {
          id:       sessionId.current,
          title:    firstQ.length > 48 ? firstQ.slice(0, 48) + "…" : firstQ,
          time:     new Date().toLocaleString(),
          messages: updated,
        };
        if (idx >= 0) sessions[idx] = entry;
        else sessions.unshift(entry);
        const trimmed = sessions.slice(0, 30);
        saveHistory(userId, trimmed);
        setHistory(trimmed);
        return updated;
      });

    } catch {
      setMessages(prev => [
        ...prev,
        { role: "bot", content: "Error connecting to backend. Make sure it is running on port 8000." },
      ]);
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
    saveHistory(userId, updated);
  };

  const clearHistory    = () => { setHistory([]); saveHistory(userId, []); };
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

        <div className="brand">
          <SigmaIcon size={38} />
          <div className="brand-text">
            <span className="brand-eyebrow">LOVABLE</span>
            <span className="brand-name">Math Tutor</span>
          </div>
        </div>

        <div className="hero-copy">
          <h1>A calmer way to <em>think in numbers.</em></h1>
          <p className="hero-sub">
            Ask anything from arithmetic to calculus. Your tutor explains
            the reasoning, not just the result — at your pace.
          </p>
        </div>

        <ul className="feature-list">
          <li>
            <span className="feat-icon">
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="16" height="16" rx="3" stroke="#7a9870" strokeWidth="1.5"/>
                <line x1="4" y1="6" x2="14" y2="6" stroke="#7a9870" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="4" y1="9" x2="14" y2="9" stroke="#7a9870" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="4" y1="12" x2="10" y2="12" stroke="#7a9870" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <div><strong>Step-by-step</strong><p>Every solution broken into clear, ordered steps.</p></div>
          </li>
          <li>
            <span className="feat-icon">
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="16" height="16" rx="3" stroke="#7a9870" strokeWidth="1.5"/>
                <text x="9" y="13" textAnchor="middle" fontSize="9" fontFamily="serif" fill="#7a9870">∑</text>
              </svg>
            </span>
            <div><strong>Any topic</strong><p>Algebra, geometry, calculus, probability.</p></div>
          </li>
          <li>
            <span className="feat-icon">
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7.5" stroke="#7a9870" strokeWidth="1.5"/>
                <line x1="9" y1="5" x2="9" y2="9" stroke="#7a9870" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="9" y1="9" x2="12" y2="12" stroke="#7a9870" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <div><strong>Patient by design</strong><p>Ask the same question twice if you need to.</p></div>
          </li>
        </ul>

        <div className="sidebar-actions">
          <button className="sidebar-btn" onClick={newConversation}>
            <IconPlus /> New conversation
          </button>
          <button className="sidebar-btn" onClick={() => setShowHistory(true)}>
            <IconHistory /> View history
            {history.length > 0 && <span className="history-badge">{history.length}</span>}
          </button>
        </div>

        <div className="sidebar-footer">
          {/* Profile card */}
          <button className="profile-mini-card" onClick={() => onNavigate("profile")}>
            <div className="profile-mini-avatar"
              style={{ background: avatarImg ? "transparent" : avatarColor }}>
              {avatarImg
                ? <img src={avatarImg} alt="avatar" className="profile-mini-avatar-img" />
                : <span className="profile-mini-initials">{initials}</span>
              }
            </div>
            <div className="profile-mini-text">
              <span className="profile-mini-name">{displayName}</span>
              <span className="profile-mini-hint">
                {realEmail || "View & edit profile"}
              </span>
            </div>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
              style={{ flexShrink: 0, color: "#b0aca4" }}>
              <path d="M4.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <p className="sidebar-footer-note">Connected to <code>127.0.0.1:8000</code></p>

          {!logoutConfirm ? (
            <button className="logout-btn" onClick={() => setLogoutConfirm(true)}>
              <IconLogout /> Sign out
            </button>
          ) : (
            <div className="logout-confirm">
              <span>Sign out?</span>
              <button className="logout-confirm-yes" onClick={handleLogout}>Yes</button>
              <button className="logout-confirm-no" onClick={() => setLogoutConfirm(false)}>Cancel</button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main panel ── */}
      <main className="main">
        <div className="main-header">
          <h2 className="section-title">Conversation</h2>
          <div className="welcome-pill">
            <div className="welcome-avatar"
              style={{ background: avatarImg ? "transparent" : avatarColor }}>
              {avatarImg
                ? <img src={avatarImg} alt="" className="welcome-avatar-img" />
                : <span className="welcome-avatar-initials">{initials}</span>
              }
            </div>
            <span className="welcome-text">
              {greeting}, <strong>{displayName}</strong>
            </span>
          </div>
        </div>

        <div className="chat-panel">
          {messages.length === 0 && !loading ? (
            <div className="empty-state">
              <SigmaIcon size={48} />
              <h3>What shall we work on?</h3>
              <p>Type a question below, or pick one of these.</p>
              <div className="suggestions">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="suggestion-chip"
                    onClick={() => handleSend(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((msg, i) => (
                <div key={i} className={`message message--${msg.role}`}>
                  {msg.role === "bot" && (
                    <span className="msg-avatar"><SigmaIcon size={22} /></span>
                  )}
                  <div className="msg-bubble">{msg.content}</div>
                  {msg.role === "user" && (
                    <span className="msg-avatar msg-avatar--user">{initials}</span>
                  )}
                </div>
              ))}
              {loading && (
                <div className="message message--bot">
                  <span className="msg-avatar"><SigmaIcon size={22} /></span>
                  <div className="msg-bubble msg-bubble--loading">
                    <span /><span /><span />
                  </div>
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
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
              <path d="M2 9L16 2L9 16L8 10L2 9Z" stroke="currentColor"
                strokeWidth="1.6" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <p className="input-hint">
          Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line
        </p>
      </main>

      {/* ── History Drawer ── */}
      {showHistory && (
        <div className="history-backdrop" onClick={() => setShowHistory(false)}>
          <div className="history-drawer" onClick={e => e.stopPropagation()}>

            <div className="history-header">
              <div className="history-header-left">
                <IconHistory /><span>Your History</span>
              </div>
              <div className="history-header-right">
                {history.length > 0 && (
                  <button className="history-clear-btn" onClick={clearHistory}>
                    Clear all
                  </button>
                )}
                <button className="history-close-btn"
                  onClick={() => setShowHistory(false)}><IconClose /></button>
              </div>
            </div>

            <div className="history-user-tag">
              <span>Showing history for</span>
              <strong>{displayName}</strong>
            </div>

            {history.length === 0 ? (
              <div className="history-empty">
                <IconHistory />
                <p>No history yet</p>
                <span>Your conversations will appear here as you chat.</span>
              </div>
            ) : (
              <ul className="history-list">
                {history.map(session => (
                  <li key={session.id} className="history-item"
                    onClick={() => loadSession(session)}>
                    <div className="history-item-icon"><IconHistory /></div>
                    <div className="history-item-text">
                      <span className="history-item-title">{session.title}</span>
                      <span className="history-item-time">{session.time}</span>
                    </div>
                    <button className="history-delete-btn"
                      onClick={e => deleteSession(session.id, e)}
                      aria-label="Delete"><IconTrash /></button>
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
