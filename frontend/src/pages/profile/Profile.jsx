import { useState, useRef, useEffect } from "react";
import "./Profile.css";

function decodeToken(token) {
  try { return JSON.parse(atob(token.split(".")[1])); }
  catch { return null; }
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
function IconBack() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M9.5 3L4.5 7.5L9.5 12" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M9 1.5l2.5 2.5L4 11.5H1.5V9L9 1.5z" stroke="currentColor"
        strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  );
}
function IconSave() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 7l3.5 3.5L11 2.5" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconCamera() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="8" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M5.5 4l1.2-2h2.6L10.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  );
}

const PROFILE_KEY   = "math_tutor_profile";
const LEVELS        = ["Beginner", "Intermediate", "Advanced", "Expert"];
const AVATAR_COLORS = ["#7a9870","#3b4a35","#8b7355","#5b7fa6","#9b6b8a","#c17f3a"];

export default function Profile({ onNavigate }) {
  const token   = localStorage.getItem("token");
  const decoded = decodeToken(token);
  const userId  = String(decoded?.sub || "guest");

  /* ── Fetch real user from /me ── */
  const [userInfo, setUserInfo] = useState(() => {
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
        localStorage.setItem(`user_info_${userId}`, JSON.stringify(data));
        setUserInfo(data);
      })
      .catch(() => {});
  }, [token, userId]);

  /* Real fields from server */
  const serverUsername = userInfo?.username || userInfo?.name  || "";
  const serverEmail    = userInfo?.email    || "";

  /* ── Saved profile (editable overrides) ── */
  const [profile, setProfile] = useState(() => {
    const saved = (() => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch { return null; } })();
    return {
      displayName: saved?.displayName || serverUsername || "Math Student",
      bio:         saved?.bio         || "",
      level:       saved?.level       || "Beginner",
      avatarColor: saved?.avatarColor || "#7a9870",
      joinDate:    saved?.joinDate    || new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  });

  /* When userInfo loads, patch displayName if still empty */
  useEffect(() => {
    if (!userInfo) return;
    setProfile(p => ({
      ...p,
      displayName: p.displayName || userInfo.username || userInfo.name || "Math Student",
    }));
  }, [userInfo]);

  const [editing,    setEditing]    = useState(false);
  const [draft,      setDraft]      = useState(profile);
  const [savedOk,    setSavedOk]    = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarImg,  setAvatarImg]  = useState(() => localStorage.getItem("math_tutor_avatar") || "");
  const fileRef = useRef();

  /* Stats from per-user history */
  const history = (() => {
    try { return JSON.parse(localStorage.getItem(`math_history_${userId}`) || "[]"); }
    catch { return []; }
  })();
  const totalQ = history.reduce((n, s) => n + (s.messages?.filter(m => m.role === "user").length || 0), 0);

  const initials = (profile.displayName || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  const startEdit  = () => { setDraft({ ...profile }); setEditing(true); setSavedOk(false); };
  const cancelEdit = () => { setDraft({ ...profile }); setEditing(false); setAvatarFile(null); };

  const handleSave = () => {
    const updated = { ...draft };
    setProfile(updated);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    if (avatarFile) {
      const reader = new FileReader();
      reader.onload = e => { localStorage.setItem("math_tutor_avatar", e.target.result); setAvatarImg(e.target.result); };
      reader.readAsDataURL(avatarFile);
    }
    setEditing(false);
    setAvatarFile(null);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2500);
  };

  const handleAvatarPick = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = ev => setAvatarImg(ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="profile-page">

      {/* ── Top bar ── */}
      <header className="profile-topbar">
        <button className="profile-back-btn" onClick={() => onNavigate("home")}>
          <IconBack /> Back to Chat
        </button>
        <div className="profile-topbar-brand">
          <SigmaIcon size={26} /><span>Math Tutor</span>
        </div>
        <div className="profile-topbar-right">
          {!editing ? (
            <button className="profile-edit-btn" onClick={startEdit}>
              <IconEdit /> Edit Profile
            </button>
          ) : (
            <div className="profile-edit-actions">
              <button className="profile-cancel-btn" onClick={cancelEdit}>Cancel</button>
              <button className="profile-save-btn" onClick={handleSave}><IconSave /> Save</button>
            </div>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <div className="profile-content">

        {/* LEFT */}
        <div className="profile-left">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar"
              style={{ background: avatarImg ? "transparent" : profile.avatarColor }}>
              {avatarImg
                ? <img src={avatarImg} alt="avatar" className="profile-avatar-img" />
                : <span className="profile-avatar-initials">{initials}</span>
              }
            </div>
            {editing && (
              <>
                <button className="profile-avatar-change"
                  onClick={() => fileRef.current?.click()} title="Change photo">
                  <IconCamera />
                </button>
                <input ref={fileRef} type="file" accept="image/*"
                  style={{ display: "none" }} onChange={handleAvatarPick} />
              </>
            )}
          </div>

          <div className="profile-identity">
            <h2 className="profile-display-name">{profile.displayName}</h2>
            {serverUsername && (
              <span className="profile-username">@{serverUsername}</span>
            )}
            <span className="profile-level-badge">{profile.level}</span>
          </div>

          {profile.bio && !editing && (
            <p className="profile-bio">{profile.bio}</p>
          )}

          <div className="profile-stats">
            <div className="stat-card">
              <span className="stat-number">{history.length}</span>
              <span className="stat-label">Sessions</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{totalQ}</span>
              <span className="stat-label">Questions</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{profile.level.slice(0,3)}</span>
              <span className="stat-label">Level</span>
            </div>
          </div>

          <p className="profile-join-date">Member since {profile.joinDate}</p>
        </div>

        {/* RIGHT */}
        <div className="profile-right">

          {savedOk && (
            <div className="profile-saved-banner">✓ Profile saved successfully!</div>
          )}

          <h3 className="profile-section-heading">
            {editing ? "Edit your profile" : "Account details"}
          </h3>

          {!editing ? (
            /* ── View mode ── */
            <div className="profile-details">

              {/* Account info from server */}
              <div className="profile-detail-group">
                <p className="detail-group-label">Account info</p>
                <div className="profile-detail-row">
                  <span className="detail-label">Username</span>
                  <span className="detail-value">
                    {serverUsername ? `@${serverUsername}` : "—"}
                  </span>
                </div>
                <div className="profile-detail-row">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{serverEmail || "—"}</span>
                </div>
                <div className="profile-detail-row">
                  <span className="detail-label">User ID</span>
                  <span className="detail-value detail-value--muted">#{userId}</span>
                </div>
              </div>

              {/* Editable info */}
              <div className="profile-detail-group">
                <p className="detail-group-label">Profile info</p>
                <div className="profile-detail-row">
                  <span className="detail-label">Display name</span>
                  <span className="detail-value">{profile.displayName || "—"}</span>
                </div>
                <div className="profile-detail-row">
                  <span className="detail-label">Math level</span>
                  <span className="detail-value">{profile.level}</span>
                </div>
                <div className="profile-detail-row">
                  <span className="detail-label">Bio</span>
                  <span className="detail-value">{profile.bio || "—"}</span>
                </div>
              </div>
            </div>

          ) : (
            /* ── Edit mode ── */
            <div className="profile-form">

              {/* Readonly server info */}
              <div className="pf-readonly-group">
                <p className="pf-readonly-label">Account info — managed by the server</p>
                <div className="pf-readonly-row">
                  <span className="pf-readonly-key">Username</span>
                  <span className="pf-readonly-val">{serverUsername ? `@${serverUsername}` : "—"}</span>
                </div>
                <div className="pf-readonly-row">
                  <span className="pf-readonly-key">Email</span>
                  <span className="pf-readonly-val">{serverEmail || "—"}</span>
                </div>
              </div>

              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-name">Display name</label>
                <input id="pf-name" className="pf-input" type="text"
                  placeholder="Your name"
                  value={draft.displayName}
                  onChange={e => setDraft(d => ({ ...d, displayName: e.target.value }))} />
              </div>

              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-bio">Bio</label>
                <textarea id="pf-bio" className="pf-input pf-textarea"
                  placeholder="Tell us a little about yourself…" rows={3}
                  value={draft.bio}
                  onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))} />
              </div>

              <div className="pf-field">
                <label className="pf-label">Math level</label>
                <div className="pf-level-row">
                  {LEVELS.map(l => (
                    <button key={l}
                      className={`pf-level-btn ${draft.level === l ? "pf-level-btn--active" : ""}`}
                      onClick={() => setDraft(d => ({ ...d, level: l }))}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pf-field">
                <label className="pf-label">Avatar colour</label>
                <div className="pf-color-row">
                  {AVATAR_COLORS.map(c => (
                    <button key={c}
                      className={`pf-color-swatch ${draft.avatarColor === c ? "pf-color-swatch--active" : ""}`}
                      style={{ background: c }}
                      onClick={() => {
                        setDraft(d => ({ ...d, avatarColor: c }));
                        setAvatarImg("");
                        localStorage.removeItem("math_tutor_avatar");
                      }}
                      aria-label={c} />
                  ))}
                </div>
                <span className="pf-hint">Or upload a photo using the camera button above</span>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
