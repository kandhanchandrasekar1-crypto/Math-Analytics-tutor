import { useState, useRef, useEffect } from "react";
import "./Profile.css";

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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  );
}

function IconSave() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7.5l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="4" width="16" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="9" cy="10" r="3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M6 4l1.5-2h3L12 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

const PROFILE_KEY = "math_tutor_profile";

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
  } catch { return null; }
}

function saveProfile(data) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
}

const DEFAULT_PROFILE = {
  displayName: "Math Student",
  username:    "",
  email:       "",
  bio:         "",
  level:       "Beginner",
  avatarColor: "#7a9870",
  joinDate:    new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
};

const LEVELS   = ["Beginner", "Intermediate", "Advanced", "Expert"];
const AVATAR_COLORS = ["#7a9870","#3b4a35","#8b7355","#5b7fa6","#9b6b8a","#c17f3a"];

export default function Profile({ onNavigate }) {
  const [profile,  setProfile]  = useState(() => loadProfile() || DEFAULT_PROFILE);
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState(profile);
  const [saved,    setSaved]    = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileRef = useRef();

  // Load avatar image from localStorage
  const [avatarImg, setAvatarImg] = useState(() => localStorage.getItem("math_tutor_avatar") || "");

  const startEdit = () => {
    setDraft({ ...profile });
    setEditing(true);
    setSaved(false);
  };

  const cancelEdit = () => {
    setDraft({ ...profile });
    setEditing(false);
    setAvatarFile(null);
  };

  const handleSave = () => {
    const updated = { ...draft };
    setProfile(updated);
    saveProfile(updated);

    // Save avatar image
    if (avatarFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        localStorage.setItem("math_tutor_avatar", e.target.result);
        setAvatarImg(e.target.result);
      };
      reader.readAsDataURL(avatarFile);
    }

    setEditing(false);
    setAvatarFile(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAvatarPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarImg(ev.target.result);
    reader.readAsDataURL(file);
  };

  const initials = (profile.displayName || "?")
    .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  // Stats from history
  const history  = (() => { try { return JSON.parse(localStorage.getItem("math_tutor_history") || "[]"); } catch { return []; } })();
  const totalQ   = history.reduce((n, s) => n + (s.messages?.filter(m => m.role === "user").length || 0), 0);
  const sessions = history.length;

  return (
    <div className="profile-page">

      {/* ── Top bar ── */}
      <header className="profile-topbar">
        <button className="profile-back-btn" onClick={() => onNavigate("home")}>
          <IconBack />
          Back to Chat
        </button>

        <div className="profile-topbar-brand">
          <SigmaIcon size={28} />
          <span>Math Tutor</span>
        </div>

        <div className="profile-topbar-right">
          {!editing ? (
            <button className="profile-edit-btn" onClick={startEdit}>
              <IconEdit />
              Edit Profile
            </button>
          ) : (
            <div className="profile-edit-actions">
              <button className="profile-cancel-btn" onClick={cancelEdit}>Cancel</button>
              <button className="profile-save-btn"   onClick={handleSave}>
                <IconSave />
                Save changes
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="profile-content">

        {/* ── LEFT CARD: Avatar + stats ── */}
        <div className="profile-left">

          {/* Avatar */}
          <div className="profile-avatar-wrap">
            <div
              className="profile-avatar"
              style={{ background: avatarImg ? "transparent" : profile.avatarColor }}
            >
              {avatarImg
                ? <img src={avatarImg} alt="avatar" className="profile-avatar-img" />
                : <span className="profile-avatar-initials">{initials}</span>
              }
            </div>

            {editing && (
              <>
                <button
                  className="profile-avatar-change"
                  onClick={() => fileRef.current?.click()}
                  title="Change photo"
                >
                  <IconCamera />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleAvatarPick}
                />
              </>
            )}
          </div>

          {/* Name & level */}
          <div className="profile-identity">
            <h2 className="profile-display-name">{profile.displayName || "—"}</h2>
            {profile.username && (
              <span className="profile-username">@{profile.username}</span>
            )}
            <span className="profile-level-badge">{profile.level}</span>
          </div>

          {/* Bio */}
          {profile.bio && !editing && (
            <p className="profile-bio">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="profile-stats">
            <div className="stat-card">
              <span className="stat-number">{sessions}</span>
              <span className="stat-label">Sessions</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{totalQ}</span>
              <span className="stat-label">Questions</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{profile.level[0]}</span>
              <span className="stat-label">Level</span>
            </div>
          </div>

          <p className="profile-join-date">Member since {profile.joinDate}</p>
        </div>

        {/* ── RIGHT CARD: Details / Edit form ── */}
        <div className="profile-right">

          {saved && (
            <div className="profile-saved-banner">
              ✓ Profile saved successfully!
            </div>
          )}

          <h3 className="profile-section-heading">
            {editing ? "Edit your profile" : "Profile details"}
          </h3>

          {!editing ? (
            /* ── View mode ── */
            <div className="profile-details">
              <div className="profile-detail-row">
                <span className="detail-label">Display name</span>
                <span className="detail-value">{profile.displayName || "—"}</span>
              </div>
              <div className="profile-detail-row">
                <span className="detail-label">Username</span>
                <span className="detail-value">{profile.username ? `@${profile.username}` : "—"}</span>
              </div>
              <div className="profile-detail-row">
                <span className="detail-label">Email</span>
                <span className="detail-value">{profile.email || "—"}</span>
              </div>
              <div className="profile-detail-row">
                <span className="detail-label">Level</span>
                <span className="detail-value">{profile.level}</span>
              </div>
              <div className="profile-detail-row">
                <span className="detail-label">Bio</span>
                <span className="detail-value">{profile.bio || "—"}</span>
              </div>
            </div>

          ) : (
            /* ── Edit mode ── */
            <div className="profile-form">

              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-name">Display name</label>
                <input id="pf-name" className="pf-input" type="text"
                  placeholder="Your name"
                  value={draft.displayName}
                  onChange={e => setDraft(d => ({ ...d, displayName: e.target.value }))}
                />
              </div>

              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-username">Username</label>
                <div className="pf-input-prefix-wrap">
                  <span className="pf-input-prefix">@</span>
                  <input id="pf-username" className="pf-input pf-input--prefix" type="text"
                    placeholder="username"
                    value={draft.username}
                    onChange={e => setDraft(d => ({ ...d, username: e.target.value.replace(/\s/g,"") }))}
                  />
                </div>
              </div>

              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-email">Email</label>
                <input id="pf-email" className="pf-input" type="email"
                  placeholder="you@example.com"
                  value={draft.email}
                  onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                />
              </div>

              <div className="pf-field">
                <label className="pf-label">Math level</label>
                <div className="pf-level-row">
                  {LEVELS.map(l => (
                    <button
                      key={l}
                      className={`pf-level-btn ${draft.level === l ? "pf-level-btn--active" : ""}`}
                      onClick={() => setDraft(d => ({ ...d, level: l }))}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-bio">Bio</label>
                <textarea id="pf-bio" className="pf-input pf-textarea"
                  placeholder="Tell us a little about yourself…"
                  rows={3}
                  value={draft.bio}
                  onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))}
                />
              </div>

              <div className="pf-field">
                <label className="pf-label">Avatar colour</label>
                <div className="pf-color-row">
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c}
                      className={`pf-color-swatch ${draft.avatarColor === c ? "pf-color-swatch--active" : ""}`}
                      style={{ background: c }}
                      onClick={() => { setDraft(d => ({ ...d, avatarColor: c })); setAvatarImg(""); localStorage.removeItem("math_tutor_avatar"); }}
                      aria-label={c}
                    />
                  ))}
                </div>
                <span className="pf-hint">Or upload a photo above ↑</span>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
