/**
 * OwnerChat — persists messages to KV with the same conversation ID
 * that WalkerChat builds: "{walkerId}-{ownerId}".
 * Loads the owner's most recent booking to resolve the walker's real user ID.
 * Polls every 5 s for new messages.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { W97, W97Button } from "../../components/Win97Window";
import { MOCK_MESSAGES_OWNER, WALKERS } from "../../data/mockData";
import { useAuth } from "../../context/AuthContext";
import { apiGet, apiPost } from "../../lib/api";

interface ChatMsg {
  id:          number;
  sender:      "owner" | "walker";
  senderName?: string;
  text:        string;
  time:        string;
  read:        boolean;
}

interface Booking {
  walkerId:    string;
  walkerName:  string;
  walkerAvatar?: string;
  dogName?:    string;
  date?:       string;
  status?:     string;
  ts?:         number;
}

// A walkerId is a real Supabase UUID if it contains hyphens
function isRealUserId(id: string) {
  return id.includes("-") && id.length > 20;
}

export function OwnerChat() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const ownerLabel = user?.name ?? "Owner";

  // ── Walker context from most recent booking ────────────────────────────
  const [walkerContext, setWalkerContext] = useState<Booking | null>(null);
  const [bookingLoaded, setBookingLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadBooking() {
      try {
        const data = await apiGet<{ walks: Booking[] }>("/walks");
        if (cancelled) return;
        // Most recent non-cancelled/declined booking
        const active = (data.walks ?? []).find(
          (w: any) => !["cancelled", "declined"].includes(w.status ?? ""),
        );
        if (active) setWalkerContext(active);
      } catch (e) { console.log("OwnerChat booking load:", e); }
      finally { if (!cancelled) setBookingLoaded(true); }
    }
    loadBooking();
    return () => { cancelled = true; };
  }, []);

  // Resolved walker info — prefer KV booking, fall back to first mock walker
  const mockWalker  = WALKERS[0];
  const walkerName  = walkerContext?.walkerName  ?? mockWalker.name;
  const walkerId    = walkerContext?.walkerId    ?? mockWalker.id;
  const walkerAvatar= walkerContext?.walkerAvatar ?? mockWalker.avatar;
  const dogName     = walkerContext?.dogName     ?? "your dog";

  // Conversation ID — must match WalkerChat: "{walkerId}-{ownerId}"
  const convId = user?.id && isRealUserId(walkerId)
    ? `${walkerId}-${user.id}`
    : `demo-${walkerId}-${user?.id ?? "guest"}`;

  const useKV = isRealUserId(walkerId);

  // ── Messages ───────────────────────────────────────────────────────────
  const [messages,   setMessages]   = useState<ChatMsg[]>([]);
  const [msgsLoaded, setMsgsLoaded] = useState(false);
  const [input,      setInput]      = useState("");
  const [sending,    setSending]    = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!bookingLoaded) return;
    try {
      if (useKV) {
        const data = await apiGet<{ messages: ChatMsg[] }>(`/messages/${convId}`);
        const msgs = data.messages ?? [];
        if (msgs.length > 0) {
          setMessages(msgs);
        } else if (!msgsLoaded) {
          setMessages(MOCK_MESSAGES_OWNER as ChatMsg[]);
        }
      } else if (!msgsLoaded) {
        setMessages(MOCK_MESSAGES_OWNER as ChatMsg[]);
      }
    } catch (e) {
      if (!msgsLoaded) setMessages(MOCK_MESSAGES_OWNER as ChatMsg[]);
      console.log("OwnerChat load messages:", e);
    }
    setMsgsLoaded(true);
  }, [convId, useKV, msgsLoaded, bookingLoaded]);

  useEffect(() => {
    loadMessages();
    if (!useKV) return;
    const poll = setInterval(loadMessages, 5000);
    return () => clearInterval(poll);
  }, [loadMessages, useKV]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send ───────────────────────────────────────────────────────────────
  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    const optimistic: ChatMsg = {
      id:         messages.length + 1,
      sender:     "owner",
      senderName: ownerLabel,
      text,
      time:       new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      read:       false,
    };
    setMessages(prev => [...prev, optimistic]);

    if (useKV) {
      try {
        await apiPost("/messages", {
          conversationId: convId,
          text,
          senderRole: "owner",
          senderName: ownerLabel,
        });
      } catch (e) { console.log("OwnerChat send:", e); }
    } else {
      // Demo auto-reply
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: prev.length + 1, sender: "walker", senderName: walkerName,
          text: "Got it! Will do 🐾", time: "Now", read: true,
        }]);
      }, 1400);
    }
    setSending(false);
  }

  const quickReplies = [
    "How's it going? 🐕",
    "On my way to meet you!",
    `How is ${dogName}?`,
    "Thank you so much! 🙏",
    "Any issues?",
  ];

  const isActiveWalk = walkerContext?.status === "in_progress";

  return (
    <div className="h-full flex flex-col" style={{ background: W97.gray, fontFamily: W97.font, color: "#000", fontSize: 12 }}>

      {/* Title Bar */}
      <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22, userSelect: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>💬</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>
          WinChat — {walkerName}{isActiveWalk ? " [On Walk Now]" : ""}
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
          <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }} onClick={() => navigate("/owner")}>✕</button>
        </div>
      </div>

      {/* Info bar */}
      <div style={{ background: "#000080", color: "#FFF", padding: "3px 8px", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span>
          {isActiveWalk
            ? `🔴 ${walkerName} is walking ${dogName} right now`
            : `💬 Chat with ${walkerName}`}
        </span>
        <div style={{ display: "flex", gap: 3 }}>
          {isActiveWalk && (
            <W97Button small onClick={() => navigate("/owner/live-walk")} style={{ fontSize: 10, padding: "1px 6px" }}>
              🗺️ Track
            </W97Button>
          )}
          <W97Button small onClick={() => navigate("/owner/report-card")} style={{ fontSize: 10, padding: "1px 6px" }}>
            📋 Report
          </W97Button>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto w97-scroll" style={{ ...W97.sunken, margin: "4px 4px 0 4px", padding: "6px", background: "#FFF" }}>
        <p style={{ textAlign: "center", color: W97.grayDark, fontSize: 11, marginBottom: 8 }}>── Today ──</p>

        {messages.map((msg) => {
          const isOwner = msg.sender === "owner";
          const name    = msg.senderName ?? (isOwner ? ownerLabel : walkerName);
          return (
            <div key={msg.id} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                {!isOwner && (
                  <img src={walkerAvatar} alt={walkerName}
                    style={{ width: 18, height: 18, objectFit: "cover", borderRadius: 0, ...W97.raised, flexShrink: 0 }} />
                )}
                <span style={{ fontWeight: "bold", color: isOwner ? "#000080" : "#800000", fontSize: 12 }}>{name}</span>
                <span style={{ color: W97.grayDark, fontSize: 10 }}>[{msg.time}]</span>
              </div>
              <div style={{
                marginLeft:  isOwner ? 8 : 26,
                marginRight: isOwner ? 0 : 8,
                background:  isOwner ? "#EEF4FF" : "#FFF4EE",
                padding:     "3px 6px",
                borderLeft:  isOwner ? "2px solid #000080" : "2px solid #800000",
                fontSize:    12,
                wordBreak:   "break-word",
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}

        {/* Inline photo from walk */}
        {!useKV && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 3 }}>
              <img src={walkerAvatar} alt={walkerName} style={{ width: 18, height: 18, objectFit: "cover", ...W97.raised, flexShrink: 0 }} />
              <span style={{ fontWeight: "bold", color: "#800000", fontSize: 12 }}>{walkerName}</span>
              <span style={{ color: W97.grayDark, fontSize: 10 }}>[2:15 PM]</span>
            </div>
            <div style={{ marginLeft: 26, background: "#FFF4EE", padding: "3px 6px", borderLeft: "2px solid #800000" }}>
              <p style={{ fontSize: 12, marginBottom: 4 }}>Your pup is loving it out here! 🐕</p>
              <img
                src="https://images.unsplash.com/photo-1714247084434-49bbc3ebf577?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=300"
                alt="Dog on walk"
                style={{ width: 140, height: 90, objectFit: "cover", ...W97.raised }}
              />
            </div>
          </div>
        )}

        {!msgsLoaded && (
          <p style={{ textAlign: "center", color: W97.grayDark, fontSize: 11 }}>Loading messages…</p>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick replies */}
      <div style={{ padding: "3px 4px 0", display: "flex", gap: 2, flexWrap: "wrap", background: W97.gray, flexShrink: 0 }}>
        {quickReplies.map(qr => (
          <button key={qr} className="w97-btn" style={{ fontSize: 10, padding: "1px 5px", minHeight: 18 }} onClick={() => setInput(qr)}>
            {qr}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "4px", flexShrink: 0, background: W97.gray }}>
        <div style={{ display: "flex", gap: 3 }}>
          <input
            className="w97-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder={`Message ${walkerName}…`}
            style={{ flex: 1 }}
            disabled={sending}
          />
          <W97Button isDefault onClick={send} disabled={sending} style={{ minWidth: 60 }}>
            {sending ? "…" : "Send"}
          </W97Button>
          <W97Button onClick={() => navigate("/owner")}>Close</W97Button>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", gap: 4, flexShrink: 0, minHeight: 20 }}>
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px" }}>
          {ownerLabel} ↔ {walkerName} · {useKV ? "Live KV Chat" : "Demo mode"} · {messages.length} msgs
        </span>
      </div>
    </div>
  );
}
