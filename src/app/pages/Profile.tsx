import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { W97, W97Button } from "../components/Win97Window";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { projectId, publicAnonKey } from "/utils/supabase/info";

type ProfileTab = "account" | "pet" | "professional";

// ── API helper ────────────────────────────────────────────────────────────

async function apiCall(path: string, method = "GET", body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? publicAnonKey;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-f29bc816${path}`,
    {
      method,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────

export function Profile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // ── Tab state ─────────────────────────────────────────────────────────
  const isOwner  = user?.role === "owner";
  const [tab, setTab] = useState<ProfileTab>("account");

  // ── Account fields ────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [nameSaving,  setNameSaving]  = useState(false);
  const [nameSaved,   setNameSaved]   = useState(false);
  const [nameError,   setNameError]   = useState<string | null>(null);

  // ── Dog profile fields ────────────────────────────────────────────────
  const [dogName,    setDogName]    = useState("Max");
  const [dogBreed,   setDogBreed]   = useState("Golden Retriever");
  const [dogAge,     setDogAge]     = useState("3");
  const [dogWeight,  setDogWeight]  = useState("");
  const [dogNotes,   setDogNotes]   = useState("");
  const [dogLoading, setDogLoading] = useState(false);
  const [dogSaving,  setDogSaving]  = useState(false);
  const [dogSaved,   setDogSaved]   = useState(false);
  const [dogError,   setDogError]   = useState<string | null>(null);

  // ── Walker profile fields ─────────────────────────────────────────────
  const [walkerBio,   setWalkerBio]   = useState("");
  const [walkerRate,  setWalkerRate]  = useState("22");
  const [walkerSpecs, setWalkerSpecs] = useState<string[]>(["Drop-in", "Large Dogs"]);
  const [wLoading,    setWLoading]    = useState(false);
  const [wSaving,     setWSaving]     = useState(false);
  const [wSaved,      setWSaved]      = useState(false);
  const [wError,      setWError]      = useState<string | null>(null);

  // ── Load profiles on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (isOwner) {
      setDogLoading(true);
      apiCall("/dog-profile").then(({ profile }) => {
        if (profile) {
          setDogName(profile.dogName ?? "Max");
          setDogBreed(profile.breed ?? "Golden Retriever");
          setDogAge(String(profile.age ?? 3));
          setDogWeight(profile.weight ?? "");
          setDogNotes(profile.notes ?? "");
        }
      }).catch(console.error).finally(() => setDogLoading(false));
    } else {
      setWLoading(true);
      apiCall("/walker-profile").then(({ profile }) => {
        if (profile) {
          setWalkerBio(profile.bio ?? "");
          setWalkerRate(String(profile.rate ?? 22));
          setWalkerSpecs(profile.specialties ?? ["Drop-in", "Large Dogs"]);
        }
      }).catch(console.error).finally(() => setWLoading(false));
    }
    setDisplayName(user.name);
  }, [user]);

  // ── Handlers ──────────────────────────────────────────────────────────

  async function saveAccountName() {
    if (!displayName.trim()) { setNameError("Name cannot be empty"); return; }
    setNameSaving(true); setNameError(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { name: displayName.trim() } });
      if (error) throw error;
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } catch (e: any) {
      setNameError(e.message ?? "Failed to save name");
    } finally {
      setNameSaving(false);
    }
  }

  async function saveDogProfile() {
    setDogSaving(true); setDogError(null);
    try {
      await apiCall("/dog-profile", "POST", {
        dogName: dogName.trim(),
        breed:   dogBreed.trim(),
        age:     Number(dogAge) || 0,
        weight:  dogWeight.trim(),
        notes:   dogNotes.trim(),
      });
      setDogSaved(true);
      setTimeout(() => setDogSaved(false), 2500);
    } catch (e: any) {
      setDogError(e.message ?? "Failed to save dog profile");
    } finally {
      setDogSaving(false);
    }
  }

  async function saveWalkerProfile() {
    setWSaving(true); setWError(null);
    try {
      await apiCall("/walker-profile", "POST", {
        bio:         walkerBio.trim(),
        rate:        Number(walkerRate) || 22,
        specialties: walkerSpecs,
      });
      setWSaved(true);
      setTimeout(() => setWSaved(false), 2500);
    } catch (e: any) {
      setWError(e.message ?? "Failed to save profile");
    } finally {
      setWSaving(false);
    }
  }

  function toggleSpec(s: string) {
    setWalkerSpecs(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  const WALKER_SPEC_OPTIONS = ["Drop-in", "Overnight", "Puppy Specialist", "Large Dogs", "Cat Friendly", "Senior Dogs", "Multiple Dogs"];

  const tabs: Array<{ id: ProfileTab; label: string }> = [
    { id: "account",      label: "⚙️ Account"      },
    { id: isOwner ? "pet" : "professional", label: isOwner ? "🐕 Dog Profile" : "🦮 Walker Bio" },
  ];

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col" style={{ background: W97.gray, fontFamily: W97.font, color: "#000" }}>

      {/* Title Bar */}
      <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22, userSelect: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>⚙️</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>
          Account Properties — {user?.name ?? "User"}
        </span>
        <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
        <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
        <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }}
          onClick={() => navigate(user?.role === "walker" ? "/walker" : "/owner")}>✕</button>
      </div>

      {/* Menu bar */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, display: "flex", padding: "1px 2px", flexShrink: 0, minHeight: 20 }}>
        {["File", "Edit", "Help"].map(item => (
          <span key={item} className="w97-menuitem" style={{ padding: "2px 6px", fontSize: 11, cursor: "default" }}>
            <u>{item[0]}</u>{item.slice(1)}
          </span>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, display: "flex", padding: "3px 4px 0", gap: 2, flexShrink: 0 }}>
        {tabs.map(t => (
          <div
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding:           "3px 12px",
              fontSize:          11,
              fontWeight:        tab === t.id ? "bold" : "normal",
              background:        tab === t.id ? W97.gray : "#A0A0A0",
              border:            "2px solid",
              borderTopColor:    tab === t.id ? "#FFF" : "#808080",
              borderLeftColor:   tab === t.id ? "#FFF" : "#808080",
              borderBottomColor: tab === t.id ? W97.gray : "#404040",
              borderRightColor:  tab === t.id ? "#808080" : "#404040",
              marginBottom:      tab === t.id ? -2 : 0,
              cursor:            "default",
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto w97-scroll" style={{ padding: "10px 10px 0" }}>

        {/* ── ACCOUNT TAB ── */}
        {tab === "account" && (
          <>
            {/* Avatar + identity banner */}
            <div style={{ ...W97.raised, padding: "10px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 52, height: 52, background: user?.role === "walker" ? "#008080" : "#000080",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, ...W97.raised, flexShrink: 0,
              }}>
                {user?.role === "walker" ? "🦮" : "🐕"}
              </div>
              <div>
                <p style={{ fontFamily: "VT323, monospace", fontSize: 20, lineHeight: 1, color: "#000" }}>{user?.name}</p>
                <p style={{ fontSize: 11, color: W97.grayDark }}>{user?.email}</p>
                <span style={{ fontSize: 10, background: user?.role === "walker" ? "#008080" : "#000080", color: "#FFF", padding: "1px 6px", display: "inline-block", marginTop: 3 }}>
                  {user?.role === "walker" ? "DOG WALKER" : "DOG OWNER"}
                </span>
              </div>
            </div>

            {/* Name edit */}
            <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "8px 10px 12px", marginBottom: 10 }}>
              <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>Display Name</legend>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: nameError ? 4 : 0 }}>
                <input
                  className="w97-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  disabled={nameSaving}
                  style={{ flex: 1 }}
                />
                <W97Button onClick={saveAccountName} disabled={nameSaving} style={{ color: nameSaved ? "#006400" : undefined, whiteSpace: "nowrap" }}>
                  {nameSaving ? "⏳ Saving..." : nameSaved ? "✓ Saved!" : "Save Name"}
                </W97Button>
              </div>
              {nameError && <p style={{ fontSize: 11, color: "#800000", marginTop: 4 }}>⚠️ {nameError}</p>}
            </fieldset>

            {/* Email (read-only) */}
            <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "8px 10px 10px", marginBottom: 10 }}>
              <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>Email Address</legend>
              <input
                className="w97-input"
                value={user?.email ?? ""}
                readOnly
                style={{ background: "#DFDFDF", color: W97.grayDark }}
              />
              <p style={{ fontSize: 10, color: W97.grayDark, marginTop: 3 }}>Email cannot be changed in this version.</p>
            </fieldset>

            {/* Danger zone */}
            <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "8px 10px 10px", marginBottom: 10 }}>
              <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px", color: "#800000" }}>⚠️ Account Actions</legend>
              <W97Button
                danger
                onClick={async () => {
                  if (window.confirm("Sign out of Sit-Here?")) await signOut();
                }}
              >
                🚪 Sign Out of Sit-Here
              </W97Button>
            </fieldset>
          </>
        )}

        {/* ── DOG PROFILE TAB ── */}
        {tab === "pet" && isOwner && (
          dogLoading ? (
            <div style={{ padding: 20, textAlign: "center" }}>
              <div className="w97-progress-track" style={{ width: 160, margin: "0 auto 8px" }}>
                <div className="w97-progress-fill" style={{ width: "60%" }} />
              </div>
              <p style={{ fontFamily: "VT323, monospace", fontSize: 14 }}>Loading dog profile...</p>
            </div>
          ) : (
            <>
              {dogError && (
                <div style={{ ...W97.raised, padding: "6px 10px", marginBottom: 10, background: "#FFFFC0", display: "flex", gap: 8 }}>
                  <span>⚠️</span>
                  <p style={{ fontSize: 11, color: "#800000" }}>{dogError}</p>
                </div>
              )}

              <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "8px 10px 12px", marginBottom: 10 }}>
                <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>Dog Details</legend>

                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>Dog's Name:</label>
                  <input className="w97-input" value={dogName} onChange={e => setDogName(e.target.value)} placeholder="e.g. Max" />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>Breed:</label>
                  <input className="w97-input" value={dogBreed} onChange={e => setDogBreed(e.target.value)} placeholder="e.g. Golden Retriever" />
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>Age (years):</label>
                    <input className="w97-input" type="number" min="0" max="25" value={dogAge} onChange={e => setDogAge(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>Weight (lbs):</label>
                    <input className="w97-input" type="number" min="0" value={dogWeight} onChange={e => setDogWeight(e.target.value)} placeholder="optional" />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>Notes for Walker:</label>
                  <textarea
                    className="w97-input"
                    value={dogNotes}
                    onChange={e => setDogNotes(e.target.value)}
                    rows={3}
                    placeholder="Allergies, quirks, commands, favourite toys..."
                    style={{ width: "100%", resize: "vertical", fontFamily: W97.font, fontSize: 12 }}
                  />
                </div>
              </fieldset>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                <W97Button
                  isDefault
                  onClick={saveDogProfile}
                  disabled={dogSaving}
                  style={{ color: dogSaved ? "#006400" : undefined, fontWeight: "bold" }}
                >
                  {dogSaving ? "⏳ Saving..." : dogSaved ? "✓ Profile Saved!" : "💾 Save Dog Profile"}
                </W97Button>
              </div>
            </>
          )
        )}

        {/* ── WALKER BIO TAB ── */}
        {tab === "professional" && !isOwner && (
          wLoading ? (
            <div style={{ padding: 20, textAlign: "center" }}>
              <div className="w97-progress-track" style={{ width: 160, margin: "0 auto 8px" }}>
                <div className="w97-progress-fill" style={{ width: "60%" }} />
              </div>
              <p style={{ fontFamily: "VT323, monospace", fontSize: 14 }}>Loading profile...</p>
            </div>
          ) : (
            <>
              {wError && (
                <div style={{ ...W97.raised, padding: "6px 10px", marginBottom: 10, background: "#FFFFC0", display: "flex", gap: 8 }}>
                  <span>⚠️</span>
                  <p style={{ fontSize: 11, color: "#800000" }}>{wError}</p>
                </div>
              )}

              <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "8px 10px 12px", marginBottom: 10 }}>
                <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>Professional Details</legend>

                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>Bio (shown to owners):</label>
                  <textarea
                    className="w97-input"
                    value={walkerBio}
                    onChange={e => setWalkerBio(e.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="Tell dog owners about your experience..."
                    style={{ width: "100%", resize: "vertical", fontFamily: W97.font, fontSize: 12 }}
                  />
                  <p style={{ fontSize: 10, color: W97.grayDark, textAlign: "right" }}>{walkerBio.length}/300</p>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>Rate per walk ($):</label>
                  <input className="w97-input" type="number" min="10" max="200" value={walkerRate} onChange={e => setWalkerRate(e.target.value)} style={{ width: 100 }} />
                </div>

                <div>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 5 }}>Specialties:</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {WALKER_SPEC_OPTIONS.map(spec => (
                      <button
                        key={spec}
                        className="w97-btn"
                        onClick={() => toggleSpec(spec)}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          background: walkerSpecs.includes(spec) ? "#000080" : W97.gray,
                          color: walkerSpecs.includes(spec) ? "#FFF" : "#000",
                        }}
                      >
                        {spec}
                      </button>
                    ))}
                  </div>
                </div>
              </fieldset>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                <W97Button
                  isDefault
                  onClick={saveWalkerProfile}
                  disabled={wSaving}
                  style={{ color: wSaved ? "#006400" : undefined, fontWeight: "bold" }}
                >
                  {wSaving ? "⏳ Saving..." : wSaved ? "✓ Profile Saved!" : "💾 Save Profile"}
                </W97Button>
              </div>
            </>
          )
        )}

        <div style={{ height: 8 }} />
      </div>

      {/* Status bar */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", gap: 4, flexShrink: 0, minHeight: 20 }}>
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px" }}>
          {tab === "account" ? `Logged in as ${user?.email}` : tab === "pet" ? `Dog profile — changes saved to cloud` : "Walker profile — visible to pet owners"}
        </span>
        <span style={{ ...W97.inset, padding: "0 6px", fontSize: 11, lineHeight: "16px" }}>
          v1.0
        </span>
      </div>
    </div>
  );
}
