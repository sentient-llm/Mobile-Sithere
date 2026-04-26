import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { W97, W97Button } from "../../components/Win97Window";
import { MOCK_MESSAGES_WALKER } from "../../data/mockData";
import { useAuth } from "../../context/AuthContext";
import { walkStore } from "../../data/walkStore";
import { apiGet, apiPost } from "../../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMsg {
  id:         number;
  sender:     "walker" | "owner";
  senderName?: string;
  text:       string;
  time:       string;
  read:       boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export function WalkerChat() {
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const walkerLabel = user?.name ?? "Walker";

  // Pull context from walkStore (populated when coming from WalkerDashboard)
  const walk = walkStore.getSnapshot();
  const ownerName = walk.ownerName && walk.ownerName !== "Dog Owner"
    ? walk.ownerName
    : "Dog Owner";
  const dogName = walk.dogName || "your dog";

  // Conversation ID — stable across walker and owner views
  // Pattern: "{walkerId}-{ownerId}" or falls back to a public channel
  const convId = user?.id && walk.ownerId
    ? `${user.id}-${walk.ownerId}`
    : `demo-${user?.id ?? "guest"}`;

  // ── Messages state ────────────────────────────────────────────────────
  const [messages,   setMessages]   = useState<ChatMsg[]>([]);
  const [msgsLoaded, setMsgsLoaded] = useState(false);
  const [input,      setInput]      = useState("");
  const [sending,    setSending]    = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // ── Load messages from KV ────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    try {
      const data = await apiGet<{ messages: ChatMsg[] }>(`/messages/${convId}`);
      const msgs = data.messages ?? [];
      if (msgs.length > 0) {
        setMessages(msgs);
      } else if (!msgsLoaded) {
        // First load with no history → seed with mock messages for demo feel
        setMessages(MOCK_MESSAGES_WALKER as ChatMsg[]);
      }
    } catch (e) {
      if (!msgsLoaded) setMessages(MOCK_MESSAGES_WALKER as ChatMsg[]);
      console.log("Load messages:", e);
    }
    setMsgsLoaded(true);
  }, [convId, msgsLoaded]);

  // On mount: load messages, then poll every 5s
  useEffect(() => {
    loadMessages();
    const poll = setInterval(loadMessages, 5000);
    return () => clearInterval(poll);
  }, [loadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────
  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    // Optimistic update
    const optimistic: ChatMsg = {
      id:     messages.length + 1,
      sender: "walker",
      senderName: walkerLabel,
      text,
      time:   new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      read:   false,
    };
    setMessages(prev => [...prev, optimistic]);

    // Persist to KV
    try {
      await apiPost("/messages", {
        conversationId: convId,
        text,
        senderRole: "walker",
        senderName: walkerLabel,
      });
    } catch (e) {
      console.log("Send message:", e);
      // Keep optimistic — message is visible locally
    } finally {
      setSending(false);
    }
  }

  const quickReplies = [
    "On my way! 🏃",
    `${dogName} is doing great 🐕`,
    "Walk complete! Check report 📋",
    "Just arrived 🔑",
    "Small issue — calling now ☎️",
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: W97.gray, fontFamily: W97.font, color: "#000", fontSize: 12 }}>

      {/* Title Bar */}
      <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22, userSelect: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>💬</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>
          WinChat — {ownerName}{walk.dogName ? ` [Walking ${walk.dogName}]` : ""}
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
          <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }} onClick={() => navigate("/walker")}>✕</button>
        </div>
      </div>

      {/* Info bar */}
      <div style={{ background: "#000080", color: "#FFF", padding: "3px 8px", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span>🐕 {walk.dogName ? `Walking ${walk.dogName}` : "Active booking"} · Send owner an update</span>
        <div style={{ display: "flex", gap: 3 }}>
          <W97Button small onClick={() => navigate("/walker/live-walk")} style={{ fontSize: 10, padding: "1px 6px" }}>🗺️ Map</W97Button>
          <W97Button small onClick={() => navigate("/walker/report-card")} style={{ fontSize: 10, padding: "1px 6px" }}>📋 Report</W97Button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto w97-scroll" style={{ ...W97.sunken, margin: "4px 4px 0 4px", padding: "4px 6px", background: "#FFF" }}>
        <p style={{ textAlign: "center", color: W97.grayDark, fontSize: 11, marginBottom: 6 }}>── Today ──</p>

        {messages.map((msg) => {
          const isWalker = msg.sender === "walker";
          const name = msg.senderName ?? (isWalker ? walkerLabel : ownerName);
          return (
            <div key={msg.id} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontWeight: "bold", color: isWalker ? "#000080" : "#800000", fontSize: 12 }}>
                  {name}
                </span>
                <span style={{ color: W97.grayDark, fontSize: 10 }}>[{msg.time}]</span>
              </div>
              <div style={{
                marginLeft: isWalker ? 8 : 0,
                marginRight: isWalker ? 0 : 8,
                background: isWalker ? "#EEF4FF" : "#FFF4EE",
                padding: "3px 6px",
                borderLeft: isWalker ? "2px solid #000080" : "2px solid #800000",
                fontSize: 12,
                wordBreak: "break-word",
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}

        {!msgsLoaded && (
          <p style={{ textAlign: "center", color: W97.grayDark, fontSize: 11 }}>Loading messages...</p>
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

      {/* Input area */}
      <div style={{ padding: "4px", flexShrink: 0, background: W97.gray }}>
        <div style={{ display: "flex", gap: 3 }}>
          <input
            className="w97-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder={`Message ${ownerName}...`}
            style={{ flex: 1 }}
            disabled={sending}
          />
          <W97Button isDefault onClick={send} disabled={sending} style={{ minWidth: 60 }}>
            {sending ? "…" : "Send"}
          </W97Button>
          <W97Button onClick={() => navigate("/walker")}>Close</W97Button>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", gap: 4, flexShrink: 0, minHeight: 20 }}>
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px" }}>
          {walkerLabel} ↔ {ownerName} · {walk.dogName ? `Walking ${walk.dogName}` : "No active walk"}
        </span>
        <span style={{ ...W97.inset, padding: "0 6px", fontSize: 11, lineHeight: "16px" }}>
          {messages.length} msgs
        </span>
      </div>
    </div>
  );
}
