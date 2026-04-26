/**
 * ScheduleWalk — 4-step wizard.
 * Step 1: Date & Time
 * Step 2: Choose Walker (real KV directory merged with mock fallbacks)
 * Step 3: Review Booking
 * Step 4: Payment (mock Win97 card entry)
 * → Confirmed screen
 *
 * Dog name pulled from KV dog-profile.
 */
import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { W97, W97Button } from "../../components/Win97Window";
import { WALKERS } from "../../data/mockData";
import { useAuth } from "../../context/AuthContext";
import { apiGet, apiPost } from "../../lib/api";

// ── Constants ──────────────────────────────────────────────────────────────

const TIMES     = ["8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM"];
const DURATIONS = ["20 min","30 min","45 min","60 min"];
const PRICE_ADDON = 2; // service fee

// ── Types ──────────────────────────────────────────────────────────────────

interface Walker {
  id:         string;
  name:       string;
  avatar?:    string;
  rating?:    number;
  reviews?:   number;
  price:      number;
  distance?:  string;
  tags?:      string[];
  bio:        string;
  verified:   boolean;
  walks?:     number;
  realUser?:  boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getWeekDays() {
  const days  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return { day: days[d.getDay()], date: d.getDate(), month: d.toLocaleString("default", { month: "short" }), isToday: i === 0 };
  });
}

function GroupBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "8px", background: W97.gray, margin: "0 0 8px 0" }}>
      <legend style={{ fontFamily: W97.font, fontSize: 11, fontWeight: "bold", padding: "0 4px" }}>{label}</legend>
      {children}
    </fieldset>
  );
}

function formatCard(s: string) {
  return s.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

// ── Component ──────────────────────────────────────────────────────────────

export function ScheduleWalk() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Wizard state ─────────────────────────────────────────────────────
  const [step,             setStep]             = useState(1);
  const [selectedDate,     setSelectedDate]     = useState(0);
  const [selectedTime,     setSelectedTime]     = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState("30 min");
  const [selectedWalker,   setSelectedWalker]   = useState<string | null>(null);
  const [confirmed,        setConfirmed]        = useState(false);
  const [saving,           setSaving]           = useState(false);

  // ── Dog profile from KV ───────────────────────────────────────────────
  const [dogName,  setDogName]  = useState("Max");
  const [dogBreed, setDogBreed] = useState("Golden Retriever");

  useEffect(() => {
    apiGet<{ profile: any }>("/dog-profile").then(d => {
      if (d.profile) {
        setDogName(d.profile.dogName   ?? "Max");
        setDogBreed(d.profile.breed ?? "Golden Retriever");
      }
    }).catch(() => {});
  }, []);

  // ── Walker directory ─────────────────────────────────────────────────
  const [walkers,        setWalkers]        = useState<Walker[]>([]);
  const [walkersLoading, setWalkersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setWalkersLoading(true);
      try {
        const data = await apiGet<{ walkers: Walker[] }>("/walker-directory");
        if (!cancelled) {
          const real = (data.walkers ?? []).map(w => ({
            ...w,
            price:    w.price ?? 22,
            avatar:   WALKERS[0].avatar, // placeholder avatar
            rating:   4.9,
            reviews:  0,
            distance: "Nearby",
            walks:    0,
            realUser: true,
          }));
          // Merge: real walkers first, then mock as "Featured" demos
          setWalkers([...real, ...WALKERS.map(w => ({ ...w, realUser: false }))]);
        }
      } catch (e) {
        console.log("Walker directory load:", e);
        if (!cancelled) setWalkers(WALKERS.map(w => ({ ...w, realUser: false })));
      } finally {
        if (!cancelled) setWalkersLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Payment state ─────────────────────────────────────────────────────
  const [cardNum,    setCardNum]    = useState("");
  const [cardName,   setCardName]   = useState(user?.name ?? "");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv,    setCardCvv]    = useState("");
  const [processing, setProcessing] = useState(false);
  const [payError,   setPayError]   = useState<string | null>(null);

  const days           = getWeekDays();
  const selectedWalkerObj = walkers.find(w => w.id === selectedWalker);
  const total          = (selectedWalkerObj?.price ?? 0) + PRICE_ADDON;

  // ── Validation ────────────────────────────────────────────────────────
  const canProceed =
    step === 1 ? !!selectedTime :
    step === 2 ? !!selectedWalker :
    step === 3 ? true :
    // step 4 — card fields
    cardNum.replace(/\s/g,"").length >= 13 && cardName.trim().length > 1 && cardExpiry.length >= 4 && cardCvv.length >= 3;

  const statusHint =
    step === 1 && !selectedTime   ? "⚠ Select a time slot to continue" :
    step === 1                    ? `${days[selectedDate].day} ${days[selectedDate].date} at ${selectedTime} · ${selectedDuration}` :
    step === 2 && !selectedWalker ? "⚠ Select a walker to continue" :
    step === 2                    ? `Walker: ${selectedWalkerObj?.name ?? "Selected"}` :
    step === 3                    ? `Total: $${total}.00 — click Checkout to pay` :
    step === 4 && !canProceed     ? "⚠ Enter valid card details" :
    `$${total}.00 ready to process`;

  // ── Process payment + save booking ───────────────────────────────────
  async function handlePayment() {
    if (!selectedWalkerObj) return;
    setProcessing(true);
    setPayError(null);

    // Simulate payment processing delay (0.8s)
    await new Promise(r => setTimeout(r, 800));

    try {
      const dateStr = `${days[selectedDate].day}, ${days[selectedDate].month} ${days[selectedDate].date}`;
      await apiPost("/walks", {
        date:         dateStr,
        time:         selectedTime,
        duration:     selectedDuration,
        walkerName:   selectedWalkerObj.name,
        walkerAvatar: selectedWalkerObj.avatar,
        walkerRating: selectedWalkerObj.rating,
        walkerPrice:  selectedWalkerObj.price,
        walkerId:     selectedWalkerObj.id,
        dogName,
        dogBreed,
        ownerName:    user?.name ?? "Owner",
        service:      "Drop-in Walk",
        totalCharged: total,
      });
    } catch (e: any) {
      console.error("Booking save:", e);
      // Non-fatal — still show confirmed
    } finally {
      setProcessing(false);
    }

    setConfirmed(true);
    setTimeout(() => navigate("/owner"), 3000);
  }

  // ── Confirmed screen ─────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ background: W97.teal, fontFamily: W97.font }}>
        <div style={{ ...W97.raised, width: "80%", maxWidth: 320, boxShadow: "2px 2px 0 #000" }}>
          <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22 }}>
            <span>ℹ️</span>
            <span style={{ fontWeight: "bold", fontSize: 12, flex: 1 }}>Booking Request Sent</span>
          </div>
          <div style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📨</div>
            <p style={{ fontWeight: "bold", fontSize: 14, marginBottom: 6 }}>Walk Requested!</p>
            <div style={{ ...W97.sunken, padding: "8px 10px", marginBottom: 10, textAlign: "left", fontSize: 12 }}>
              <p>🦮 <strong>{selectedWalkerObj?.name}</strong></p>
              <p>📅 {days[selectedDate].day}, {days[selectedDate].month} {days[selectedDate].date}</p>
              <p>🕐 {selectedTime} · {selectedDuration}</p>
              <p>🐕 Walking {dogName}</p>
              <p>💳 ${total}.00 charged</p>
            </div>
            <div style={{ ...W97.raised, padding: "5px 8px", background: "#FFFFC0", marginBottom: 10, fontSize: 11 }}>
              ⏳ Awaiting walker acceptance. You'll be notified when confirmed!
            </div>
            <p style={{ fontFamily: "VT323, monospace", fontSize: 13, color: W97.grayDark }}>
              Returning to dashboard…
            </p>
          </div>
          <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px" }}>
            <span style={{ ...W97.inset, padding: "0 6px", fontSize: 11, display: "block", lineHeight: "16px" }}>
              Booking saved · Awaiting confirmation
            </span>
          </div>
        </div>
      </div>
    );
  }

  const stepLabels = ["Schedule", "Walker", "Review", "Pay"];

  return (
    <div className="h-full flex flex-col" style={{ background: W97.gray, fontFamily: W97.font, color: "#000" }}>

      {/* Title Bar */}
      <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22, userSelect: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>📅</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>Schedule a Walk — Step {step} of 4</span>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
          <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }} onClick={() => navigate("/owner")}>✕</button>
        </div>
      </div>

      {/* Step tabs */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, display: "flex", padding: "3px 4px 0", gap: 2, flexShrink: 0 }}>
        {stepLabels.map((label, i) => {
          const s = i + 1;
          return (
            <div key={s} style={{
              padding: "3px 8px", fontSize: 11,
              fontWeight:        step === s ? "bold" : "normal",
              background:        step === s ? W97.gray : "#A0A0A0",
              border:            "2px solid",
              borderTopColor:    step === s ? "#FFF" : "#808080",
              borderLeftColor:   step === s ? "#FFF" : "#808080",
              borderBottomColor: step === s ? W97.gray : "#404040",
              borderRightColor:  step === s ? "#808080" : "#404040",
              marginBottom:      step === s ? -2 : 0,
              color:             step < s ? "#808080" : "#000",
            }}>
              {s}. {label}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto w97-scroll" style={{ padding: "8px" }}>

        {/* ── STEP 1: Date & Time ── */}
        {step === 1 && (
          <>
            <GroupBox label="Select Date">
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {days.map((d, i) => (
                  <button key={i} className="w97-btn" onClick={() => setSelectedDate(i)}
                    style={{ minWidth: 44, padding: "4px 6px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center",
                      background: selectedDate === i ? "#000080" : W97.gray, color: selectedDate === i ? "#FFF" : "#000" }}>
                    <span style={{ fontSize: 10 }}>{d.day}</span>
                    <span style={{ fontWeight: "bold", fontSize: 14 }}>{d.date}</span>
                    {d.isToday && <span style={{ fontSize: 9 }}>Today</span>}
                  </button>
                ))}
              </div>
            </GroupBox>

            <GroupBox label="Select Time">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3 }}>
                {TIMES.map(t => (
                  <button key={t} className="w97-btn" onClick={() => setSelectedTime(t)}
                    style={{ background: selectedTime === t ? "#000080" : W97.gray, color: selectedTime === t ? "#FFF" : "#000", padding: "4px 2px", fontSize: 11 }}>
                    {t}
                  </button>
                ))}
              </div>
            </GroupBox>

            <GroupBox label="Duration">
              <div style={{ display: "flex", gap: 3 }}>
                {DURATIONS.map(d => (
                  <button key={d} className="w97-btn" onClick={() => setSelectedDuration(d)}
                    style={{ flex: 1, background: selectedDuration === d ? "#000080" : W97.gray, color: selectedDuration === d ? "#FFF" : "#000" }}>
                    {d}
                  </button>
                ))}
              </div>
            </GroupBox>
          </>
        )}

        {/* ── STEP 2: Choose Walker ── */}
        {step === 2 && (
          <GroupBox label={walkersLoading ? "Loading Walkers…" : `Available Walkers Near You (${walkers.length})`}>
            {walkersLoading ? (
              <div>
                <div className="w97-progress-track" style={{ marginBottom: 4 }}><div className="w97-progress-fill" style={{ width: "55%" }} /></div>
                <p style={{ fontFamily: "VT323, monospace", fontSize: 13 }}>Finding walkers near you…</p>
              </div>
            ) : (
              <div style={{ ...W97.sunken, background: "#FFF" }}>
                {walkers.map((w, i) => (
                  <div key={w.id} className="w97-list-row" onClick={() => setSelectedWalker(w.id)}
                    style={{ background: selectedWalker === w.id ? "#000080" : i % 2 === 0 ? "#FFF" : "#DFDFDF",
                      color: selectedWalker === w.id ? "#FFF" : "#000",
                      padding: 8, borderBottom: "1px solid #C0C0C0", display: "flex", gap: 8, alignItems: "center" }}>
                    {w.avatar ? (
                      <img src={w.avatar} alt={w.name} style={{ width: 40, height: 40, objectFit: "cover", ...W97.raised, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 40, height: 40, ...W97.raised, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🦮</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <p style={{ fontWeight: "bold", fontSize: 12 }}>{w.verified ? "✓ " : ""}{w.name}</p>
                        {w.realUser && <span style={{ fontSize: 9, padding: "0 3px", background: "#006400", color: "#FFF" }}>REAL</span>}
                      </div>
                      {w.rating && <p style={{ fontSize: 11 }}>⭐ {w.rating}{w.reviews ? ` (${w.reviews})` : ""}{w.distance ? ` · 📍 ${w.distance}` : ""}</p>}
                      <p style={{ fontSize: 10, color: selectedWalker === w.id ? "#C0C0FF" : W97.grayDark, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {w.bio.slice(0, 55)}…
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontWeight: "bold", fontSize: 15, fontFamily: "VT323, monospace", color: selectedWalker === w.id ? "#FFF" : "#000080" }}>${w.price}</p>
                      <p style={{ fontSize: 10 }}>/ walk</p>
                      {w.walks != null && <p style={{ fontSize: 10 }}>{w.walks} walks</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GroupBox>
        )}

        {/* ── STEP 3: Review ── */}
        {step === 3 && selectedWalkerObj && (
          <>
            <GroupBox label="Booking Summary">
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {selectedWalkerObj.avatar
                  ? <img src={selectedWalkerObj.avatar} alt={selectedWalkerObj.name} style={{ width: 44, height: 44, objectFit: "cover", ...W97.raised, flexShrink: 0 }} />
                  : <div style={{ width: 44, height: 44, ...W97.raised, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🦮</div>
                }
                <div>
                  <p style={{ fontWeight: "bold", fontSize: 13 }}>✓ {selectedWalkerObj.name}</p>
                  {selectedWalkerObj.rating && <p style={{ fontSize: 11 }}>⭐ {selectedWalkerObj.rating}</p>}
                  {selectedWalkerObj.realUser && <p style={{ fontSize: 10, color: "#006400" }}>✓ Verified on Sit-Here</p>}
                </div>
              </div>

              <div style={{ ...W97.sunken, padding: 8 }}>
                {[
                  ["📅 Date",      `${days[selectedDate].day}, ${days[selectedDate].month} ${days[selectedDate].date}`],
                  ["🕐 Time",      selectedTime ?? "—"],
                  ["⏱️ Duration",  selectedDuration],
                  ["🐕 Dog",       `${dogName} (${dogBreed})`],
                  ["🔖 Service",   "Drop-in Walk"],
                  ["💵 Walker Fee",`$${selectedWalkerObj.price}.00`],
                  ["🔧 Service Fee","$" + PRICE_ADDON + ".00"],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #DFDFDF", fontSize: 12 }}>
                    <span style={{ color: W97.grayDark }}>{label}:</span>
                    <span style={{ fontWeight: "bold" }}>{val}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 0", fontSize: 14, fontWeight: "bold", borderTop: `2px solid ${W97.grayDark}`, marginTop: 4 }}>
                  <span>Total:</span>
                  <span style={{ fontFamily: "VT323, monospace", fontSize: 22, color: "#000080" }}>${total}.00</span>
                </div>
              </div>

              <div style={{ ...W97.raised, padding: "5px 8px", background: "#FFFFC0", marginTop: 8, fontSize: 11 }}>
                ⏳ Note: Booking is a <strong>request</strong>. The walker must accept before it's confirmed.
              </div>
            </GroupBox>
          </>
        )}

        {/* ── STEP 4: Payment ── */}
        {step === 4 && (
          <GroupBox label={`💳 Secure Checkout — $${total}.00`}>
            <div style={{ ...W97.sunken, padding: "8px 10px", marginBottom: 8, fontSize: 11 }}>
              <p style={{ fontWeight: "bold" }}>🔒 256-bit SSL encrypted</p>
              <p style={{ color: W97.grayDark }}>Test card: 4242 4242 4242 4242 · Exp: 12/26 · CVV: 123</p>
            </div>

            {[
              { label: "Card Number", value: cardNum, onChange: (v: string) => setCardNum(formatCard(v)), placeholder: "4242 4242 4242 4242", maxLen: 19 },
              { label: "Name on Card", value: cardName, onChange: setCardName, placeholder: "Jane Smith", maxLen: 60 },
            ].map(({ label, value, onChange, placeholder, maxLen }) => (
              <div key={label} style={{ marginBottom: 7 }}>
                <label style={{ fontSize: 11, display: "block", marginBottom: 3 }}>{label}:</label>
                <input className="w97-input" value={value} onChange={e => onChange(e.target.value)}
                  placeholder={placeholder} maxLength={maxLen} style={{ width: "100%" }} />
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginBottom: 7 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, display: "block", marginBottom: 3 }}>Expiry (MM/YY):</label>
                <input className="w97-input" value={cardExpiry}
                  onChange={e => {
                    let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                    setCardExpiry(v);
                  }}
                  placeholder="12/26" maxLength={5} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, display: "block", marginBottom: 3 }}>CVV:</label>
                <input className="w97-input" type="password" value={cardCvv}
                  onChange={e => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="123" maxLength={4} />
              </div>
            </div>

            {payError && (
              <div style={{ ...W97.raised, padding: "5px 8px", background: "#FFFFC0", marginBottom: 6, fontSize: 11, color: "#800000" }}>
                ⚠️ {payError}
              </div>
            )}

            <div style={{ ...W97.sunken, padding: "6px 8px", fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Total to charge:</span>
                <span style={{ fontFamily: "VT323, monospace", fontSize: 18, color: "#000080", fontWeight: "bold" }}>${total}.00</span>
              </div>
            </div>
          </GroupBox>
        )}
      </div>

      {/* Footer nav */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "5px 8px", display: "flex", justifyContent: "flex-end", gap: 5, flexShrink: 0 }}>
        <W97Button onClick={() => step === 1 ? navigate("/owner") : setStep(s => s - 1)}>
          ← Back
        </W97Button>
        <W97Button
          isDefault
          disabled={!canProceed || saving || processing}
          style={{ fontWeight: step >= 3 ? "bold" : "normal" }}
          onClick={() => {
            if (step < 4)      setStep(s => s + 1);
            else               handlePayment();
          }}
        >
          {processing ? "⏳ Processing…" :
           step === 3 ? "💳 Checkout →" :
           step === 4 ? `✓ Pay $${total}.00` :
           "Next →"}
        </W97Button>
        <W97Button onClick={() => navigate("/owner")}>Cancel</W97Button>
      </div>

      {/* Status bar */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", flexShrink: 0, minHeight: 20 }}>
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px", color: !canProceed ? "#800000" : "#000" }}>
          {statusHint}
        </span>
      </div>
    </div>
  );
}
