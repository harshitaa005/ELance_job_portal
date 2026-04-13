// src/components/MessagesPanel.jsx
// Job Seeker ka Messages panel - WhatsApp style full working
import { useState, useEffect, useRef, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const getToken = () => localStorage.getItem("token");
const hdrs = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

const fmtTime = (d) => {
  if (!d) return "";
  const date = new Date(d), now = new Date(), diff = now - date;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (date.toDateString() === y.toDateString()) return "Yesterday";
  if (diff < 7 * 86400000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
};

const fmtFull = (d) => !d ? "" : new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const initials = (name = "") =>
  name.trim().split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "??";

const AV_COLORS = ["#7c3aed","#4f46e5","#0891b2","#059669","#d97706","#dc2626","#7c2d88"];
const avColor = (name = "") => { let h = 0; for (let c of name) h = (h * 31 + c.charCodeAt(0)) % AV_COLORS.length; return AV_COLORS[h]; };

const getDateLabel = (dateStr) => {
  const d = new Date(dateStr), now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
};

const groupMessages = (msgs, myId) => {
  const map = {};
  msgs.forEach(m => {
    const sId = String(m.sender?._id || m.sender || "");
    const rId = String(m.receiver?._id || m.receiver || "");
    const myStr = String(myId);
    const isMe = sId === myStr;
    const otherId = isMe ? rId : sId;
    const otherUser = isMe ? m.receiver : m.sender;
    if (!otherId || otherId === "undefined" || otherId === "null") return;
    if (!map[otherId]) {
      map[otherId] = {
        _id: otherId, otherUser,
        recruiterName: !isMe ? (m.sender?.name || m.recruiterName || "Recruiter") : (m.receiver?.name || ""),
        companyName: m.companyName || (!isMe ? m.sender?.company || m.sender?.companyName : m.receiver?.company) || "",
        jobTitle: m.jobTitle || m.relatedJob?.title || "",
        lastMessage: "", lastTime: m.createdAt,
        unreadCount: 0, rawMsgs: [],
      };
    }
    if (!isMe && !map[otherId].recruiterName) map[otherId].recruiterName = m.sender?.name || "Recruiter";
    if (!map[otherId].companyName && (m.companyName || m.sender?.company)) map[otherId].companyName = m.companyName || m.sender?.company || "";
    map[otherId].rawMsgs.push(m);
    if (!map[otherId].lastTime || new Date(m.createdAt) > new Date(map[otherId].lastTime)) {
      map[otherId].lastTime = m.createdAt;
      map[otherId].lastMessage = m.content || m.message || "";
    }
    const toMe = rId === myStr;
    const read = m.read === true || (Array.isArray(m.readBy) && m.readBy.map(String).includes(myStr));
    if (toMe && !read) map[otherId].unreadCount++;
  });
  return Object.values(map).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
.mp-wrap*{box-sizing:border-box;margin:0;padding:0;font-family:'Inter',sans-serif}
.mp-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);z-index:9000;display:flex;align-items:center;justify-content:center;animation:mpFade 0.2s ease}
@keyframes mpFade{from{opacity:0}to{opacity:1}}
.mp-modal{background:#fff;border-radius:20px;width:860px;max-width:97vw;height:600px;max-height:92vh;display:flex;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.3);animation:mpPop 0.28s cubic-bezier(0.34,1.56,0.64,1)}
@keyframes mpPop{from{opacity:0;transform:scale(0.94)}to{opacity:1;transform:scale(1)}}
.mp-left{width:300px;flex-shrink:0;display:flex;flex-direction:column;background:#f7f8fc;border-right:1.5px solid #ebebf0}
.mp-lhead{padding:16px 14px 12px;border-bottom:1.5px solid #ebebf0;background:#fff}
.mp-titlerow{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.mp-title{font-size:17px;font-weight:700;color:#111;display:flex;align-items:center;gap:8px}
.mp-tbadge{background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px}
.mp-closex{border:none;background:#f0eeff;color:#7c3aed;cursor:pointer;width:30px;height:30px;border-radius:8px;font-size:15px;display:flex;align-items:center;justify-content:center;font-weight:700;transition:all .18s}
.mp-closex:hover{background:#ede0ff}
.mp-searchwrap{position:relative}
.mp-searchwrap input{width:100%;padding:9px 12px 9px 34px;border:1.5px solid #e2e2ea;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#f7f8fc;color:#111;transition:border-color .18s}
.mp-searchwrap input:focus{border-color:#7c3aed;background:#fff}
.mp-sicon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#aaa;font-size:13px;pointer-events:none}
.mp-convlist{flex:1;overflow-y:auto}
.mp-convlist::-webkit-scrollbar{width:4px}
.mp-convlist::-webkit-scrollbar-thumb{background:#d9d9e8;border-radius:4px}
.mp-convitem{display:flex;align-items:center;gap:10px;padding:11px 13px;cursor:pointer;transition:background .15s;border-bottom:1px solid #f0f0f7;position:relative}
.mp-convitem:hover{background:#f0eeff}
.mp-convitem.active{background:#ede9ff;border-left:3px solid #7c3aed}
.mp-convitem.unread-item .mp-cname{font-weight:700;color:#111}
.mp-convitem.unread-item .mp-cprev{color:#333;font-weight:600}
.mp-av{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0}
.mp-av.ring{outline:2.5px solid #7c3aed;outline-offset:2px}
.mp-cbody{flex:1;min-width:0}
.mp-ctop{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:2px}
.mp-cname{font-size:13.5px;font-weight:600;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
.mp-ctime{font-size:11px;color:#aaa;flex-shrink:0}
.mp-ccompany{font-size:11.5px;color:#7c3aed;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.mp-cjob{font-size:11px;color:#999;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mp-cbot{display:flex;align-items:center;justify-content:space-between}
.mp-cprev{font-size:12.5px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px}
.mp-ubadge{background:#7c3aed;color:#fff;font-size:11px;font-weight:700;min-width:18px;height:18px;padding:0 5px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.mp-delbtn{position:absolute;right:8px;top:50%;transform:translateY(-50%);display:none;border:none;background:#fee2e2;color:#dc2626;width:26px;height:26px;border-radius:7px;cursor:pointer;font-size:12px;align-items:center;justify-content:center;z-index:2;transition:all .18s}
.mp-convitem:hover .mp-delbtn{display:flex}
.mp-delbtn:hover{background:#dc2626;color:#fff}
.mp-right{flex:1;display:flex;flex-direction:column;background:#eae6f5;min-width:0}
.mp-thead{padding:12px 18px;background:#fff;border-bottom:1.5px solid #ebebf0;display:flex;align-items:center;gap:12px}
.mp-tav{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0}
.mp-tname{font-size:14.5px;font-weight:700;color:#111}
.mp-tsub{font-size:12px;color:#7c3aed;font-weight:600;margin-top:1px}
.mp-tjob{font-size:11.5px;color:#888}
.mp-msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:2px}
.mp-msgs::-webkit-scrollbar{width:4px}
.mp-msgs::-webkit-scrollbar-thumb{background:#c8c4e0;border-radius:4px}
.mp-datediv{text-align:center;margin:10px 0;font-size:11px;color:#999;font-weight:600;position:relative}
.mp-datediv::before{content:'';position:absolute;top:50%;left:0;right:0;height:1px;background:#d4d0ea;z-index:0}
.mp-datediv span{position:relative;z-index:1;background:#eae6f5;padding:0 10px}
.mp-sendertag{font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:3px;padding-left:4px}
.mp-msgrow{display:flex;margin-bottom:2px;animation:mpMsg 0.2s ease}
@keyframes mpMsg{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.mp-msgrow.me{justify-content:flex-end}
.mp-msgrow.them{justify-content:flex-start}
.mp-msgrow.me+.mp-msgrow.them,.mp-msgrow.them+.mp-msgrow.me{margin-top:8px}
.mp-bubble{max-width:68%;padding:8px 13px;border-radius:18px;font-size:13.5px;line-height:1.55;word-break:break-word;position:relative}
.mp-msgrow.me .mp-bubble{background:#7c3aed;color:#fff;border-bottom-right-radius:4px;box-shadow:0 2px 8px rgba(124,58,237,0.25)}
.mp-msgrow.them .mp-bubble{background:#fff;color:#111;border-bottom-left-radius:4px;border:1px solid #e0daf5;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
.mp-bubble.failed{background:#fee2e2!important;color:#dc2626!important}
.mp-bubblemeta{display:flex;align-items:center;gap:4px;margin-top:3px;justify-content:flex-end}
.mp-msgrow.them .mp-bubblemeta{justify-content:flex-start}
.mp-btime{font-size:10.5px}
.mp-msgrow.me .mp-btime{color:rgba(255,255,255,0.65)}
.mp-msgrow.them .mp-btime{color:#aaa}
.mp-tick{font-size:10px}
.mp-tick.sent{color:rgba(255,255,255,0.55)}
.mp-tick.read{color:#c4b5fd}
.mp-msgrow.me .mp-bubble::after{content:'';position:absolute;bottom:0;right:-6px;border-width:8px 0 0 8px;border-style:solid;border-color:transparent transparent transparent #7c3aed}
.mp-msgrow.them .mp-bubble::after{content:'';position:absolute;bottom:0;left:-6px;border-width:8px 8px 0 0;border-style:solid;border-color:transparent #fff transparent transparent}
.mp-inputarea{padding:10px 14px;background:#fff;border-top:1.5px solid #ebebf0;display:flex;gap:10px;align-items:flex-end}
.mp-input{flex:1;padding:10px 16px;border:1.5px solid #e2e2ea;border-radius:24px;font-size:14px;font-family:inherit;outline:none;resize:none;max-height:100px;line-height:1.5;color:#111;transition:border-color .18s;overflow-y:auto}
.mp-input:focus{border-color:#7c3aed}
.mp-input::placeholder{color:#aaa}
.mp-sendbtn{width:44px;height:44px;flex-shrink:0;background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;border-radius:50%;color:#fff;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .18s;box-shadow:0 4px 12px rgba(124,58,237,0.4)}
.mp-sendbtn:hover:not(:disabled){transform:scale(1.08)}
.mp-sendbtn:disabled{opacity:0.45;cursor:not-allowed;transform:none}
.mp-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#aaa;background:#f7f8fc}
.mp-empty-icon{font-size:52px;opacity:0.35}
.mp-empty h3{font-size:17px;font-weight:700;color:#555}
.mp-empty p{font-size:13px;text-align:center;max-width:220px;line-height:1.6}
.mp-deloverlay{position:absolute;inset:0;background:rgba(255,255,255,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;z-index:10;padding:20px;text-align:center}
.mp-deloverlay p{font-size:13.5px;color:#333;font-weight:500;line-height:1.5}
.mp-delactions{display:flex;gap:8px}
.mp-btn{padding:8px 20px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .18s}
.mp-btncancel{background:#f0f0f7;color:#555}
.mp-btncancel:hover{background:#e0e0ea}
.mp-btndel{background:#dc2626;color:#fff}
.mp-btndel:hover{background:#b91c1c}
.mp-noconv{padding:28px;text-align:center;color:#aaa;font-size:13px;line-height:1.7}
.mp-loadmsg{text-align:center;color:#aaa;font-size:13px;padding:20px}
`;

export default function MessagesPanel({ currentUser, onClose }) {
  const myId = currentUser?._id || currentUser?.id;

  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    if (!myId) return;
    setConvLoading(true);
    try {
      let convs = null;
      try {
        const r = await fetch(`${API}/messages/conversations`, { headers: hdrs() });
        if (r.ok) convs = await r.json();
      } catch {}

      if (!convs || !Array.isArray(convs)) {
        const r = await fetch(`${API}/messages`, { headers: hdrs() });
        if (!r.ok) throw new Error("Failed");
        const msgs = await r.json();
        convs = groupMessages(Array.isArray(msgs) ? msgs : msgs.messages || [], myId);
      }
      setConversations(convs);
    } catch (err) {
      console.error("fetchConversations:", err);
      setConversations([]);
    } finally {
      setConvLoading(false);
    }
  }, [myId]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const openConversation = async (conv) => {
    setSelected(conv);
    setMsgsLoading(true);
    setMessages([]);
    const otherId = conv._id || conv.otherUser?._id;

    try {
      let msgs = [];
      try {
        const r = await fetch(`${API}/messages/thread/${otherId}`, { headers: hdrs() });
        if (r.ok) msgs = await r.json();
        else throw new Error();
      } catch {
        msgs = conv.rawMsgs || [];
      }
      const list = Array.isArray(msgs) ? msgs : msgs.messages || [];
      setMessages(list);

      // Mark read
      if (conv.unreadCount > 0) {
        fetch(`${API}/messages/thread/${otherId}/read-all`, {
          method: "PATCH", headers: hdrs(),
        }).catch(() => {
          list.filter(m => {
            const rId = String(m.receiver?._id || m.receiver || "");
            return rId === String(myId) && !m.read;
          }).forEach(m =>
            fetch(`${API}/messages/${m._id}/read`, { method: "PATCH", headers: hdrs() }).catch(() => {})
          );
        });
        setConversations(prev =>
          prev.map(c => c._id === conv._id ? { ...c, unreadCount: 0 } : c)
        );
      }
    } catch (err) {
      console.error("openConversation:", err);
    } finally {
      setMsgsLoading(false);
    }
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }, 150);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = newMsg.trim();
    if (!text || !selected || sending) return;
    const otherId = selected._id || selected.otherUser?._id;
    setSending(true);

    const opt = {
      _id: "opt_" + Date.now(),
      content: text, message: text,
      sender: { _id: myId }, receiver: { _id: otherId },
      senderRole: "jobseeker",
      createdAt: new Date().toISOString(),
      read: false, pending: true,
    };
    setMessages(p => [...p, opt]);
    setNewMsg("");

    try {
      const r = await fetch(`${API}/messages`, {
        method: "POST", headers: hdrs(),
        body: JSON.stringify({ receiverId: otherId, content: text, message: text }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const saved = await r.json();
      setMessages(p => p.map(m => m._id === opt._id ? { ...saved, read: false } : m));
      setConversations(p => {
        const ex = p.find(c => c._id === selected._id);
        if (ex) return [{ ...ex, lastMessage: text, lastTime: new Date().toISOString() }, ...p.filter(c => c._id !== selected._id)];
        return p;
      });
    } catch (err) {
      console.error("sendMessage:", err);
      setMessages(p => p.map(m => m._id === opt._id ? { ...m, pending: false, failed: true } : m));
    } finally {
      setSending(false);
    }
  };

  const deleteConversation = async (convId) => {
    try {
      await fetch(`${API}/messages/conversation/${convId}`, { method: "DELETE", headers: hdrs() });
    } catch {}
    setConversations(p => p.filter(c => c._id !== convId));
    if (selected?._id === convId) { setSelected(null); setMessages([]); }
    setDeleteConfirm(null);
  };

  const isMyMsg = (m) => {
    const sId = String(m.sender?._id || m.sender || "");
    return sId === String(myId) || m.senderRole === "jobseeker";
  };

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase();
    return (c.recruiterName || c.otherUser?.name || "").toLowerCase().includes(q) ||
      (c.companyName || c.otherUser?.company || "").toLowerCase().includes(q);
  });

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0);

  return (
    <div className="mp-wrap">
      <style>{CSS}</style>
      <div className="mp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="mp-modal">

          {/* LEFT */}
          <div className="mp-left">
            <div className="mp-lhead">
              <div className="mp-titlerow">
                <div className="mp-title">
                  💬 Messages
                  {totalUnread > 0 && <span className="mp-tbadge">{totalUnread}</span>}
                </div>
                <button className="mp-closex" onClick={onClose}>✕</button>
              </div>
              <div className="mp-searchwrap">
                <span className="mp-sicon">🔍</span>
                <input placeholder="Search conversations..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            <div className="mp-convlist">
              {convLoading && <div className="mp-loadmsg">Loading...</div>}
              {!convLoading && filtered.length === 0 && (
                <div className="mp-noconv">
                  {search ? "No results found" : "No conversations yet.\nRecruiters who message you will appear here."}
                </div>
              )}
              {!convLoading && filtered.map(conv => {
                const rName = conv.recruiterName || conv.otherUser?.name || "Recruiter";
                const company = conv.companyName || conv.otherUser?.company || conv.otherUser?.companyName || "";
                const jobTitle = conv.jobTitle || "";
                const unread = conv.unreadCount || 0;
                const bg = avColor(rName);
                const isActive = selected?._id === conv._id;

                return (
                  <div
                    key={conv._id}
                    className={`mp-convitem ${isActive ? "active" : ""} ${unread > 0 ? "unread-item" : ""}`}
                    onClick={() => openConversation(conv)}
                  >
                    <div className={`mp-av ${unread > 0 ? "ring" : ""}`} style={{ background: bg }}>
                      {initials(rName)}
                    </div>
                    <div className="mp-cbody">
                      <div className="mp-ctop">
                        <div className="mp-cname">{rName}</div>
                        <div className="mp-ctime">{fmtTime(conv.lastTime)}</div>
                      </div>
                      {company && <div className="mp-ccompany">🏢 {company}</div>}
                      {jobTitle && <div className="mp-cjob">💼 {jobTitle}</div>}
                      <div className="mp-cbot">
                        <div className="mp-cprev">{conv.lastMessage || "Tap to view"}</div>
                        {unread > 0 && <div className="mp-ubadge">{unread}</div>}
                      </div>
                    </div>
                    <button className="mp-delbtn" onClick={e => { e.stopPropagation(); setDeleteConfirm(conv._id); }} title="Delete">🗑</button>

                    {deleteConfirm === conv._id && (
                      <div className="mp-deloverlay" onClick={e => e.stopPropagation()}>
                        <p>Delete conversation with<br /><strong>{rName}</strong>?<br />This cannot be undone.</p>
                        <div className="mp-delactions">
                          <button className="mp-btn mp-btncancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                          <button className="mp-btn mp-btndel" onClick={() => deleteConversation(conv._id)}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT */}
          <div className="mp-right">
            {!selected ? (
              <div className="mp-empty">
                <div className="mp-empty-icon">💬</div>
                <h3>Select a conversation</h3>
                <p>Click a thread on the left to view and reply to recruiter messages</p>
              </div>
            ) : (
              <>
                <div className="mp-thead">
                  <div className="mp-tav" style={{ background: avColor(selected.recruiterName || selected.otherUser?.name || "") }}>
                    {initials(selected.recruiterName || selected.otherUser?.name || "")}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="mp-tname">👤 {selected.recruiterName || selected.otherUser?.name || "Recruiter"}</div>
                    {(selected.companyName || selected.otherUser?.company) && (
                      <div className="mp-tsub">🏢 {selected.companyName || selected.otherUser?.company}</div>
                    )}
                    {selected.jobTitle && <div className="mp-tjob">💼 {selected.jobTitle}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{messages.length} msg{messages.length !== 1 ? "s" : ""}</div>
                </div>

                <div className="mp-msgs">
                  {msgsLoading && <div className="mp-loadmsg">Loading messages...</div>}
                  {!msgsLoading && messages.length === 0 && (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#aaa", padding: 20 }}>
                      <span style={{ fontSize: 36 }}>💬</span>
                      <p style={{ fontSize: 13, textAlign: "center" }}>No messages yet. Start the conversation!</p>
                    </div>
                  )}

                  {!msgsLoading && messages.map((m, i) => {
                    const mine = isMyMsg(m);
                    const isRead = m.read === true || (Array.isArray(m.readBy) && m.readBy.length > 0);
                    const showDate = i === 0 || new Date(m.createdAt).toDateString() !== new Date(messages[i-1]?.createdAt).toDateString();
                    const showSenderTag = !mine && (i === 0 || isMyMsg(messages[i-1]));

                    return (
                      <div key={m._id || i}>
                        {showDate && m.createdAt && (
                          <div className="mp-datediv"><span>{getDateLabel(m.createdAt)}</span></div>
                        )}
                        {showSenderTag && (
                          <div className="mp-sendertag">{selected.recruiterName || selected.otherUser?.name || "Recruiter"}</div>
                        )}
                        <div className={`mp-msgrow ${mine ? "me" : "them"}`}>
                          <div className={`mp-bubble ${m.failed ? "failed" : ""}`}>
                            {m.content || m.message || m.text}
                            {m.failed && " ⚠️"}
                            <div className="mp-bubblemeta">
                              <span className="mp-btime">{fmtFull(m.createdAt)}</span>
                              {mine && (
                                <span className={`mp-tick ${m.pending ? "" : isRead ? "read" : "sent"}`}>
                                  {m.pending ? "🕐" : isRead ? "✓✓" : "✓"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <div className="mp-inputarea">
                  <textarea
                    ref={inputRef}
                    className="mp-input"
                    rows={1}
                    placeholder={`Message ${selected.recruiterName || selected.otherUser?.name || "Recruiter"}...`}
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  />
                  <button className="mp-sendbtn" onClick={sendMessage} disabled={sending || !newMsg.trim()}>
                    {sending ? "⏳" : "➤"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
