import React, { useState, useEffect, useRef, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const hdrs = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
});
const C = {
  bg:       "#F5F7FF",
  white:    "#FFFFFF",
  border:   "#E4E9F2",
  primary:  "#4A6CF7",
  pDark:    "#3451D1",
  pLight:   "#EEF2FF",
  text:     "#1A1F36",
  textSub:  "#4A5568",
  muted:    "#94A3B8",
  green:    "#10B981",
  red:      "#EF4444",
  amber:    "#F59E0B",
  purple:   "#7C3AED",
  shadow:   "0 4px 24px rgba(74,108,247,0.12)",
  shadowLg: "0 20px 60px rgba(10,20,60,0.22)",
};

/* ── Helpers ── */
function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  if (h < 24)  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d === 1) return "Yesterday";
  if (d < 7)   return `${d}d ago`;
  return new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" });
}

function initials(name = "") {
  const p = name.trim().split(" ").filter(Boolean);
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : (name.slice(0, 2) || "?").toUpperCase();
}

const AV_COLS = ["#4A6CF7","#7C3AED","#0891B2","#059669","#DB2777","#D97706"];
const avCol = (s = "") => AV_COLS[(s.charCodeAt(0) || 0) % AV_COLS.length];

/* ── Avatar ── */
const Av = ({ name = "?", size = 38, online = false }) => {
  const bg = avCol(name);
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: `linear-gradient(135deg, ${bg}, ${bg}bb)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: size * 0.35, color: "#fff",
        boxShadow: `0 2px 8px ${bg}44`,
      }}>
        {initials(name)}
      </div>
      {online && (
        <div style={{
          position: "absolute", bottom: 1, right: 1,
          width: size * 0.28, height: size * 0.28, borderRadius: "50%",
          background: C.green, border: "2px solid #fff",
        }} />
      )}
    </div>
  );
};

/* ── CSS ── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  .jsm * { box-sizing: border-box; }
  .jsm { font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif; }
  .jsm ::-webkit-scrollbar { width: 4px; }
  .jsm ::-webkit-scrollbar-track { background: transparent; }
  .jsm ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
  .jsm input { font-family: 'Plus Jakarta Sans', sans-serif; outline: none; }
  .thread-row:hover { background: #F0F4FF !important; }
  @keyframes jsm-in    { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  @keyframes jsm-pop   { from { opacity:0; transform:scale(0.96); }    to { opacity:1; transform:scale(1); } }
  @keyframes jsm-pulse { 0%,100%{opacity:.45} 50%{opacity:.9} }
`;

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function JobSeekerMessaging({ user, onClose }) {

  const [threads,       setThreads]  = useState([]);
  const [threadsLoading, setTL]      = useState(true);
  const [active,        setActive]   = useState(null);
  const [messages,      setMessages] = useState([]);
  const [msgsLoading,   setML]       = useState(false);
  const [toast,         setToast]    = useState(null);
  const bottomRef = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ══════════════
     FETCH THREADS
  ══════════════ */
  const fetchThreads = useCallback(async () => {
    setTL(true);
    try {
      const r = await fetch(`${API}/messages/conversations`, { headers: hdrs() });
      if (!r.ok) throw new Error(`${r.status}`);
      const data = await r.json();
      setThreads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("fetchThreads:", err.message);
      setThreads([]);
    } finally {
      setTL(false);
    }
  }, []);

  useEffect(() => {
    fetchThreads();
    const iv = setInterval(fetchThreads, 20000);
    return () => clearInterval(iv);
  }, [fetchThreads]);

  /* ══════════════════════
     FETCH THREAD MESSAGES
  ══════════════════════ */
  const fetchMessages = useCallback(async (otherId) => {
    if (!otherId) return;
    setML(true);
    setMessages([]);
    try {
      // Mark all as read
      await fetch(`${API}/messages/thread/${otherId}/read-all`, {
        method: "PATCH", headers: hdrs(),
      }).catch(() => {});

      const r = await fetch(`${API}/messages/thread/${otherId}`, { headers: hdrs() });
      if (!r.ok) throw new Error(`${r.status}`);
      const data = await r.json();
      setMessages(Array.isArray(data) ? data : []);

      // Clear unread badge
      setThreads(prev => prev.map(t =>
        t._id === otherId ? { ...t, unreadCount: 0 } : t
      ));
    } catch (err) {
      console.warn("fetchMessages:", err.message);
      setMessages([]);
    } finally {
      setML(false);
    }
  }, []);

  useEffect(() => {
    if (active?._id) fetchMessages(active._id);
  }, [active?._id, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const myId        = String(user?._id || "");
  const totalUnread = threads.reduce((s, t) => s + (t.unreadCount || 0), 0);

  /* ════════════════════════════════
     RENDER
  ════════════════════════════════ */
  return (
    <div
      className="jsm"
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(10,15,50,0.55)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <style>{CSS}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          zIndex: 20000, padding: "12px 24px", borderRadius: 12, fontWeight: 600,
          fontSize: 13.5, background: toast.type === "error" ? C.red : C.green,
          color: "#fff", boxShadow: "0 8px 28px rgba(0,0,0,0.2)",
          animation: "jsm-in 0.2s ease",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Main panel */}
      <div
        style={{
          width: "90vw", maxWidth: 1060, height: "86vh",
          borderRadius: 20, overflow: "hidden",
          display: "flex", boxShadow: C.shadowLg,
          border: `1px solid ${C.border}`,
          animation: "jsm-pop 0.28s cubic-bezier(0.34,1.4,0.64,1)",
          background: C.white,
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* ═══ LEFT SIDEBAR ═══ */}
        <div style={{
          width: 300, flexShrink: 0,
          borderRight: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column",
          background: C.white,
        }}>

          {/* Sidebar header */}
          <div style={{
            padding: "18px 16px 14px",
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: C.text }}>
                Inbox
                {totalUnread > 0 && (
                  <span style={{
                    marginLeft: 8, background: C.red, color: "#fff",
                    fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 99,
                  }}>{totalUnread}</span>
                )}
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 30, height: 30, borderRadius: "50%",
                  border: `1.5px solid ${C.border}`,
                  background: C.bg, color: C.muted, fontSize: 15,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            </div>

            {/* Search bar */}
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 10, top: "50%",
                transform: "translateY(-50%)", fontSize: 13, color: C.muted,
              }}>🔍</span>
              <input
                placeholder="Search conversations…"
                style={{
                  width: "100%", padding: "8px 10px 8px 30px",
                  borderRadius: 10, border: `1.5px solid ${C.border}`,
                  background: C.bg, color: C.text, fontSize: 12.5,
                }}
              />
            </div>
          </div>

          {/* Thread list */}
          <div style={{ flex: 1, overflowY: "auto" }}>

            {/* Loading skeletons */}
            {threadsLoading && (
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#E2E8F0", animation: "jsm-pulse 1.4s infinite", flexShrink: 0 }}/>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                      <div style={{ height: 12, borderRadius: 6, background: "#E2E8F0", width: "65%", animation: "jsm-pulse 1.4s infinite" }}/>
                      <div style={{ height: 10, borderRadius: 6, background: "#E2E8F0", width: "40%", animation: "jsm-pulse 1.4s infinite" }}/>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!threadsLoading && threads.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 20px", color: C.muted }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 6 }}>
                  No messages yet
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  When a recruiter contacts you, their message will appear here.
                </div>
              </div>
            )}

            {/* Thread rows */}
            {!threadsLoading && threads.map(t => {
              const isActive = active?._id === t._id;
              const name    = t.recruiterName || t.otherUser?.name || "Recruiter";
              const company = t.companyName   || t.otherUser?.company || "";
              return (
                <div
                  key={t._id}
                  className="thread-row"
                  onClick={() => setActive({ _id: t._id, name, company, jobTitle: t.jobTitle || "" })}
                  style={{
                    padding: "12px 14px", cursor: "pointer",
                    background: isActive ? C.pLight : t.unreadCount > 0 ? "#FDFAFF" : "transparent",
                    borderLeft: isActive
                      ? `3px solid ${C.primary}`
                      : t.unreadCount > 0 ? `3px solid ${C.purple}` : "3px solid transparent",
                    transition: "background 0.13s",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Av name={name} size={40}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{
                          fontWeight: t.unreadCount > 0 ? 800 : 600,
                          fontSize: 13, color: C.text,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140,
                        }}>{name}</span>
                        <span style={{ fontSize: 10.5, color: C.muted, flexShrink: 0 }}>
                          {timeAgo(t.lastTime)}
                        </span>
                      </div>
                      {company && (
                        <div style={{ fontSize: 11.5, color: C.primary, fontWeight: 600, marginTop: 1 }}>
                          🏢 {company}
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                        <span style={{
                          fontSize: 12, color: C.muted,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 175,
                          fontWeight: t.unreadCount > 0 ? 600 : 400,
                        }}>
                          {t.lastMessage || "No messages yet"}
                        </span>
                        {t.unreadCount > 0 && (
                          <span style={{
                            background: C.purple, color: "#fff",
                            fontSize: 10, fontWeight: 800,
                            padding: "2px 7px", borderRadius: 99, flexShrink: 0,
                          }}>{t.unreadCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ CHAT PANEL ═══ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, minWidth: 0 }}>
          {active ? (
            <>
              {/* Chat header */}
              <div style={{
                background: C.white, borderBottom: `1px solid ${C.border}`,
                padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
              }}>
                <Av name={active.name} size={44} online/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{active.name}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
                    {active.company || "Recruiter"}
                    {active.jobTitle && ` · 📋 ${active.jobTitle}`}
                  </div>
                </div>
                <button
                  onClick={() => fetchMessages(active._id)}
                  title="Refresh messages"
                  style={{
                    width: 34, height: 34, borderRadius: "50%",
                    border: `1.5px solid ${C.border}`, background: C.white,
                    color: C.muted, fontSize: 16, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >↻</button>
              </div>

              {/* Messages area */}
              <div style={{
                flex: 1, overflowY: "auto",
                padding: "20px 22px",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                {/* Loading skeletons */}
                {msgsLoading && (
                  <>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ display: "flex", justifyContent: "flex-start" }}>
                        <div style={{
                          height: 52, width: "50%", borderRadius: 14,
                          background: "#E2E8F0", animation: "jsm-pulse 1.4s infinite",
                        }}/>
                      </div>
                    ))}
                  </>
                )}

                {/* No messages yet */}
                {!msgsLoading && messages.length === 0 && (
                  <div style={{
                    flex: 1, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    color: C.muted, paddingTop: 60,
                  }}>
                    <div style={{ fontSize: 48, marginBottom: 14 }}>💬</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>
                      No messages yet
                    </div>
                    <div style={{ fontSize: 13, textAlign: "center", maxWidth: 280, lineHeight: 1.7 }}>
                      The recruiter hasn't sent a message in this conversation yet.
                    </div>
                  </div>
                )}

                {/* Message bubbles */}
                {!msgsLoading && messages.map((m, idx) => {
                  const sId  = String(m.sender?._id || m.sender || m.senderId?._id || m.senderId || "");
                  const isMe = sId === myId || m.senderRole === "jobSeeker" || m.from === "jobSeeker";
                  const msgText = m.content || m.message || m.text || "";
                  if (!msgText) return null;

                  const prevMsg  = messages[idx - 1];
                  const showDate = !prevMsg ||
                    new Date(m.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

                  return (
                    <React.Fragment key={m._id || idx}>
                      {/* Date separator */}
                      {showDate && (
                        <div style={{
                          textAlign: "center", margin: "8px 0",
                          fontSize: 11, color: C.muted, fontWeight: 600,
                        }}>
                          <span style={{
                            background: C.white, padding: "4px 14px",
                            borderRadius: 99, border: `1px solid ${C.border}`,
                          }}>
                            {new Date(m.createdAt).toDateString() === new Date().toDateString()
                              ? "Today"
                              : new Date(m.createdAt).toLocaleDateString([], {
                                  weekday: "short", day: "numeric", month: "short",
                                })}
                          </span>
                        </div>
                      )}

                      {/* Bubble */}
                      <div style={{
                        display: "flex",
                        justifyContent: isMe ? "flex-end" : "flex-start",
                        alignItems: "flex-end", gap: 8,
                        animation: "jsm-in 0.18s ease",
                      }}>
                        {!isMe && <Av name={active.name} size={28}/>}
                        <div style={{
                          maxWidth: "65%",
                          background: isMe
                            ? `linear-gradient(135deg, ${C.primary}, ${C.pDark})`
                            : C.white,
                          border: isMe ? "none" : `1.5px solid ${C.border}`,
                          borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          padding: "10px 14px",
                          boxShadow: isMe
                            ? `0 4px 14px rgba(74,108,247,0.3)`
                            : "0 2px 8px rgba(0,0,0,0.06)",
                        }}>
                          <div style={{
                            fontSize: 13.5, lineHeight: 1.55,
                            color: isMe ? "#fff" : C.text,
                            wordBreak: "break-word",
                          }}>
                            {msgText}
                          </div>
                          <div style={{
                            fontSize: 10, marginTop: 5, textAlign: "right",
                            color: isMe ? "rgba(255,255,255,0.55)" : C.muted,
                            display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4,
                          }}>
                            {timeAgo(m.createdAt)}
                            {isMe && <span>{m.read ? "✓✓" : "✓"}</span>}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                <div ref={bottomRef}/>
              </div>

              {/* Read-only footer */}
              <div style={{
                padding: "14px 20px",
                borderTop: `1px solid ${C.border}`,
                background: C.bg, flexShrink: 0,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 16 }}>🔒</span>
                <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                  Only recruiters can send messages. You'll be notified when they contact you.
                </span>
              </div>
            </>
          ) : (
            /* No thread selected */
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: 40, color: C.muted,
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: C.pLight,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 40, marginBottom: 20,
              }}>📬</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: C.text, marginBottom: 8 }}>
                Your Inbox
              </div>
              <div style={{ fontSize: 14, textAlign: "center", maxWidth: 300, lineHeight: 1.7 }}>
                Messages from recruiters will appear here once they contact you.
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}