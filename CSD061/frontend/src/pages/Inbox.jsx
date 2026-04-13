import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { jobService } from "../services/JobService";
import { authService } from "../services/AuthService";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const G = {
  bg:          "#F7F9FC",
  white:       "#FFFFFF",
  border:      "#E2E8F0",
  borderLight: "#EDF2F7",
  primary:     "#1976d2",
  primaryDark: "#0d47a1",
  primaryLight:"#E3F2FD",
  accent:      "#F5A623",
  accentLight: "#FEF3D9",
  teal:        "#2EC4B6",
  tealLight:   "#E0F7F5",
  sage:        "#6B9E6D",
  sageLight:   "#E8F3E8",
  lavender:    "#7B61FF",
  lavLight:    "#EEE9FF",
  danger:      "#E53E3E",
  dangerLight: "#FFF5F5",
  text:        "#1A202C",
  textMed:     "#4A5568",
  muted:       "#A0AEC0",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  .inbox-mail *, .inbox-mail *::before, .inbox-mail *::after { box-sizing: border-box; margin:0; padding:0; }
  .inbox-mail { font-family: 'Inter', sans-serif; color: ${G.text}; }
  .inbox-mail ::-webkit-scrollbar { width: 5px; }
  .inbox-mail ::-webkit-scrollbar-thumb { background: ${G.border}; border-radius:99px; }

  .cand-row { transition: background 0.13s, border-color 0.13s; cursor: pointer; }
  .cand-row:hover { background: ${G.primaryLight} !important; }

  .fade-in { animation: mf 0.3s cubic-bezier(.22,1,.36,1); }
  @keyframes mf { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }

  .slide-up { animation: su 0.28s cubic-bezier(.22,1,.36,1); }
  @keyframes su { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }

  .toast-wrap { position:fixed;bottom:28px;right:28px;z-index:99999; }
`;

/* ── helpers ── */
const STATUS_CFG = {
  pending:     { bg:G.accentLight,  text:G.accent,   label:"Pending"     },
  shortlisted: { bg:G.lavLight,     text:G.lavender, label:"Shortlisted" },
  accepted:    { bg:G.sageLight,    text:G.sage,     label:"Accepted"    },
  rejected:    { bg:G.dangerLight,  text:G.danger,   label:"Rejected"    },
  reviewing:   { bg:G.tealLight,    text:G.teal,     label:"Reviewing"   },
  reviewed:    { bg:G.tealLight,    text:G.teal,     label:"Reviewed"    },
};
const normStatus = s => (s || "pending").toLowerCase();
const getScfg    = s => STATUS_CFG[normStatus(s)] || STATUS_CFG.pending;

const AV_COLS = ["#1976d2","#2EC4B6","#7B61FF","#F5A623","#6B9E6D","#E85D3F"];
const avCol   = name => AV_COLS[((name || "").charCodeAt(0) || 0) % AV_COLS.length];
const getInitials = (name = "") => {
  const p = name.trim().split(" ").filter(Boolean);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name.slice(0, 2) || "?").toUpperCase();
};

const extractName = (app) =>
  app?.applicantId?.username || app?.applicantId?.name ||
  app?.applicant?.username   || app?.applicant?.name   ||
  app?.userId?.username      || app?.userId?.name      ||
  app?.applicantName || app?.candidateName || app?.name || app?.username || "Unknown";

const extractEmail = (app) =>
  app?.applicantId?.email || app?.applicant?.email ||
  app?.userId?.email      || app?.applicantEmail   || app?.email || "";

const extractSkills = (app) => {
  const raw = app?.applicantId?.skills || app?.applicant?.skills || app?.userId?.skills || app?.skills || [];
  return raw.map(s => {
    if (!s) return '';
    if (typeof s === 'object') return (s?.skill?.name || s?.name || s?.skill || '').toString().trim();
    return s.toString().trim();
  }).filter(Boolean);
};

const normalizeApp = (app, jobSkills = []) => {
  const name   = extractName(app);
  const email  = extractEmail(app);
  const skills = extractSkills(app);
  const jobNorm = jobSkills.map(s => s.toLowerCase().trim()).filter(Boolean);
  let match = app.matchScore ?? app.match ?? null;
  if ((match === null || match === undefined) && jobNorm.length > 0 && skills.length > 0) {
    const skillNorm = skills.map(s => s.toLowerCase().trim());
    const matched = jobNorm.filter(js => skillNorm.some(cs => cs.includes(js) || js.includes(cs)));
    match = Math.round((matched.length / jobNorm.length) * 100);
  } else if (match === null || match === undefined) { match = 0; }
  return {
    ...app,
    _id: app._id || app.id,
    name, email, skills, match,
    status: normStatus(app.status || "pending"),
    appliedAt: app.appliedAt || app.createdAt || app.applicationDate,
  };
};

/* ── Avatar ── */
const Av = ({ name = "?", size = 36 }) => {
  const c = avCol(name);
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:`linear-gradient(135deg,${c}cc,${c}77)`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontWeight:700, fontSize:size*0.34, color:"#fff",
      boxShadow:`0 2px 6px ${c}44` }}>
      {getInitials(name)}
    </div>
  );
};

/* ── Toast ── */
const Toast = ({ msg, type = "success", onClose }) => {
  const bg = { success:`linear-gradient(135deg,${G.teal},#1fa89f)`,
               error:`linear-gradient(135deg,${G.danger},#c53030)`,
               warning:`linear-gradient(135deg,${G.accent},#e8940a)` }[type] || `linear-gradient(135deg,${G.teal},#1fa89f)`;
  return (
    <div className="slide-up" style={{ background:bg, color:"#fff", padding:"13px 20px",
      borderRadius:14, fontWeight:600, fontSize:13.5,
      display:"flex", alignItems:"center", gap:10,
      boxShadow:"0 10px 36px rgba(0,0,0,0.18)" }}>
      {msg}
      <button onClick={onClose} style={{ background:"none", border:"none",
        color:"rgba(255,255,255,0.7)", fontSize:17, marginLeft:4, cursor:"pointer" }}>×</button>
    </div>
  );
};

/* ── Skeleton ── */
const Sk = ({ w = "100%", h = 14, r = 8 }) => (
  <div style={{ width:w, height:h, borderRadius:r,
    background:"linear-gradient(90deg,#EDF2F7 25%,#E2E8F0 50%,#EDF2F7 75%)",
    backgroundSize:"200% 100%",
    animation:"sk 1.4s infinite" }}/>
);

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function Inbox({ onBack }) {
  const { user } = useContext(AuthContext);

  /* ── data ── */
  const [jobs,        setJobs]        = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [candidates,  setCandidates]  = useState([]);
  const [candsLoading,setCandsLoading]= useState(false);

  /* ── filters ── */
  const [searchQ,      setSearchQ]      = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedIds,  setSelectedIds]  = useState([]);
  const [sortBy,       setSortBy]       = useState("match");

  /* ── compose ── */
  const [subject, setSubject] = useState("");
  const [body,    setBody]    = useState("");

  /* ── ui ── */
  const [sending, setSending] = useState(false);
  const [toast,   setToast]   = useState(null);

  const toast$ = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const hdrs = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${authService.getToken?.() || ""}`,
  });

  /* ── load jobs ── */
  useEffect(() => {
    if (!user) return;
    setJobsLoading(true);
    jobService.getRecruiterJobs()
      .then(list => {
        const arr = Array.isArray(list) ? list : (list?.jobs || list?.data || []);
        const active = arr.filter(j => j.status !== "closed");
        setJobs(active);
        if (active.length > 0) setSelectedJob(active[0]);
      })
      .catch(() => toast$("Could not load jobs", "error"))
      .finally(() => setJobsLoading(false));
  }, [user]);

  /* ── load candidates on job change ── */
  useEffect(() => {
    if (!selectedJob) { setCandidates([]); return; }
    setCandsLoading(true);
    setCandidates([]); setSelectedIds([]); setSearchQ(""); setFilterStatus("all");

    const jobId = selectedJob._id || selectedJob.id;
    const jobSkills = (selectedJob.requiredSkills || []).map(s =>
      typeof s === "object" ? (s.name || "") : (s || "")
    ).filter(Boolean);

    const load = async () => {
      try {
        let raw = [];
        try {
          const data = await jobService.getJobApplications(jobId);
          if (Array.isArray(data)) raw = data;
          else if (Array.isArray(data?.applications)) raw = data.applications;
          else if (Array.isArray(data?.candidates))   raw = data.candidates;
          else raw = [];
        } catch {
          const res = await fetch(`${API}/jobs/${jobId}/applications`, { headers: hdrs() });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          raw = Array.isArray(data) ? data : (data?.applications || data?.candidates || []);
        }
        setCandidates(raw.map(app => normalizeApp(app, jobSkills)));
      } catch (err) {
        toast$("Could not load applicants", "error");
        setCandidates([]);
      } finally {
        setCandsLoading(false);
      }
    };
    load();
  }, [selectedJob?._id]);

  /* ── set default subject when job changes ── */
  useEffect(() => {
    if (selectedJob) {
      setSubject(`Regarding your application for ${selectedJob.title || "the position"}`);
      setBody(
        `Hi [Name],\n\nThank you for applying for the ${selectedJob.title || ""} role.\n\nWe wanted to reach out regarding your application.\n\nBest regards,\n${user?.username || "The Recruitment Team"}`
      );
    }
  }, [selectedJob?._id]);

  /* ── filtered list ── */
  const filtered = candidates
    .filter(c => {
      if (filterStatus !== "all" && normStatus(c.status) !== filterStatus) return false;
      const q = searchQ.toLowerCase().trim();
      if (!q) return true;
      return (
        (c.name  || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.skills || []).some(s => s.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === "match") return (b.match || 0) - (a.match || 0);
      if (sortBy === "name")  return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "date")  return new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0);
      return 0;
    });

  const toggleOne = (id) =>
    setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const toggleAll = () =>
    setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(c => c._id));

  /* ── recipients (selected or all filtered) ── */
  const recipients = (selectedIds.length > 0
    ? candidates.filter(c => selectedIds.includes(c._id))
    : filtered
  ).filter(c => c.email);

  /* ── send email ── */
  const handleSend = async () => {
    if (!recipients.length || !subject.trim() || !body.trim() || sending) return;
    setSending(true);
    let sent = 0, failed = 0, fallbacks = [];

    for (const r of recipients) {
      try {
        const res = await fetch(`${API}/email/send`, {
          method: "POST",
          headers: hdrs(),
          body: JSON.stringify({
            to:            r.email,
            subject,
            body:          body.replace(/\[Name\]/g, r.name),
            candidateName: r.name,
            jobTitle:      selectedJob?.title || "",
          }),
        });
        const d = await res.json();
        if (d.sent) { sent++; }
        else if (d.fallback && d.mailtoUrl) { fallbacks.push(d.mailtoUrl); sent++; }
        else { failed++; }
      } catch { failed++; }
    }

    setSending(false);
    fallbacks.forEach(url => window.open(url, "_blank"));
    toast$(
      failed > 0
        ? `Sent ${sent}, failed ${failed} ⚠️`
        : `✅ Email sent to ${sent} candidate${sent > 1 ? "s" : ""}!`
    );
    if (sent > 0) setSelectedIds([]);
  };

  const statusCounts = (s) => candidates.filter(c => normStatus(c.status) === s).length;

  return (
    <div className="inbox-mail fade-in"
      style={{ height:"calc(100vh - 64px)", display:"flex", flexDirection:"column", background:G.bg }}>
      <style>{CSS}
        @keyframes sk {"{ 0%{background-position:200% 0} 100%{background-position:-200% 0} }"}
      </style>

      {/* Toast */}
      {toast && (
        <div className="toast-wrap">
          <Toast {...toast} onClose={() => setToast(null)} />
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div style={{ background:G.white, borderBottom:`1px solid ${G.border}`,
        height:60, padding:"0 24px", display:"flex", alignItems:"center",
        gap:14, flexShrink:0, boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>

        {onBack && (
          <button onClick={onBack} style={{ background:"none", border:`1.5px solid ${G.border}`,
            borderRadius:99, color:G.muted, fontSize:13, padding:"6px 14px",
            fontWeight:600, flexShrink:0, cursor:"pointer" }}>
            ← Back
          </button>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:22 }}>📧</span>
          <span style={{ fontWeight:800, fontSize:19, color:G.text }}>Send Email</span>
        </div>

        <div style={{ flexShrink:0 }}>
          {jobsLoading ? (
            <Sk w={200} h={34} r={99}/>
          ) : jobs.length === 0 ? (
            <span style={{ fontSize:13, color:G.muted, fontStyle:"italic",
              padding:"7px 14px", background:G.bg, borderRadius:99, border:`1px solid ${G.border}` }}>
              No active jobs
            </span>
          ) : (
            <select value={selectedJob?._id || selectedJob?.id || ""}
              onChange={e => setSelectedJob(jobs.find(j => (j._id || j.id) === e.target.value) || null)}
              style={{ padding:"8px 16px", borderRadius:99, fontSize:13, fontWeight:600,
                border:`1.5px solid ${G.border}`, background:G.white, cursor:"pointer",
                color:G.text, minWidth:200 }}>
              {jobs.map(j => (
                <option key={j._id || j.id} value={j._id || j.id}>
                  {j.title || "Untitled"}
                  {j.applicationCount != null ? ` (${j.applicationCount})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ flex:1 }}/>

        {recipients.length > 0 && (
          <span style={{ background:G.primaryLight, color:G.primary,
            fontSize:12.5, fontWeight:700, padding:"5px 13px", borderRadius:99, flexShrink:0 }}>
            {recipients.length} recipient{recipients.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── BODY: 2 columns ── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* ════ LEFT: Candidate Filter Panel ════ */}
        <div style={{ width:320, flexShrink:0, borderRight:`1px solid ${G.border}`,
          display:"flex", flexDirection:"column", background:G.white }}>

          {/* Search + Filters */}
          <div style={{ padding:14, borderBottom:`1px solid ${G.border}`, display:"flex", flexDirection:"column", gap:10 }}>
            <input
              placeholder="🔍 Search name, email, skill…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{ padding:"9px 13px", borderRadius:99, fontSize:13,
                border:`1.5px solid ${G.border}`, background:G.bg,
                color:G.text, outline:"none", width:"100%",
                fontFamily:"'Inter',sans-serif" }}
            />

            {/* Status filter pills */}
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {["all","shortlisted","pending","reviewing","accepted","rejected"].map(s => {
                const cfg = getScfg(s), isA = filterStatus === s;
                const cnt = s === "all" ? candidates.length : statusCounts(s);
                return (
                  <button key={s} onClick={() => setFilterStatus(s)} style={{
                    padding:"4px 11px", borderRadius:99, fontSize:11, fontWeight:600,
                    border:"none", cursor:"pointer", transition:"all 0.15s", textTransform:"capitalize",
                    background: isA ? (s === "all" ? G.primary : cfg.text) : G.bg,
                    color: isA ? "#fff" : G.muted,
                  }}>
                    {s === "all" ? `All (${cnt})` : `${cfg.label} (${cnt})`}
                  </button>
                );
              })}
            </div>

            {/* Sort + Select all */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ padding:"4px 10px", fontSize:11, borderRadius:99,
                  border:`1px solid ${G.border}`, background:G.bg,
                  color:G.textMed, cursor:"pointer" }}>
                <option value="match">By Match%</option>
                <option value="name">By Name</option>
                <option value="date">By Date</option>
              </select>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={toggleAll}
                  style={{ background:"none", border:"none", color:G.primary,
                    fontSize:11, fontWeight:700, cursor:"pointer" }}>
                  {selectedIds.length === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
                </button>
                {selectedIds.length > 0 && (
                  <button onClick={() => setSelectedIds([])}
                    style={{ background:"none", border:"none", color:G.muted,
                      fontSize:11, fontWeight:600, cursor:"pointer" }}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div style={{ fontSize:11, color:G.muted }}>
              {candsLoading ? "Loading…" : `${filtered.length} of ${candidates.length} shown`}
              {selectedIds.length > 0 && (
                <span style={{ marginLeft:6, color:G.primary, fontWeight:700 }}>
                  · {selectedIds.length} selected
                </span>
              )}
            </div>
          </div>

          {/* Candidate List */}
          <div style={{ flex:1, overflowY:"auto" }}>
            {candsLoading && (
              <div style={{ padding:14, display:"flex", flexDirection:"column", gap:11 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <div style={{ width:38, height:38, borderRadius:"50%", background:"#EDF2F7", flexShrink:0 }}/>
                    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:7 }}>
                      <Sk w="65%" h={12}/><Sk w="40%" h={10}/>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!candsLoading && !selectedJob && (
              <div style={{ padding:28, textAlign:"center", color:G.muted, fontSize:13 }}>
                ← Select a job from above
              </div>
            )}
            {!candsLoading && selectedJob && candidates.length === 0 && (
              <div style={{ padding:28, textAlign:"center", color:G.muted, fontSize:13 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📭</div>
                No applications yet
              </div>
            )}
            {!candsLoading && filtered.length === 0 && candidates.length > 0 && (
              <div style={{ padding:28, textAlign:"center", color:G.muted, fontSize:13 }}>
                No candidates match filter
                <button onClick={() => { setFilterStatus("all"); setSearchQ(""); }}
                  style={{ display:"block", margin:"10px auto 0", background:"none",
                    border:`1px solid ${G.primary}`, color:G.primary,
                    borderRadius:99, padding:"5px 14px", fontSize:12, cursor:"pointer", fontWeight:600 }}>
                  Clear filters
                </button>
              </div>
            )}

            {!candsLoading && filtered.map((c, i) => {
              const ss   = getScfg(c.status);
              const isSel = selectedIds.includes(c._id);
              const noMail = !c.email;
              return (
                <div key={c._id} className="cand-row"
                  onClick={() => !noMail && toggleOne(c._id)}
                  style={{ padding:"12px 14px", borderBottom:`1px solid ${G.borderLight}`,
                    background: isSel ? G.primaryLight : G.white,
                    borderLeft: isSel ? `4px solid ${G.primary}` : "4px solid transparent",
                    opacity: noMail ? 0.45 : 1,
                    cursor: noMail ? "not-allowed" : "pointer" }}>

                  <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                    <input type="checkbox" checked={isSel} disabled={noMail}
                      onChange={() => {}} onClick={e => { e.stopPropagation(); if (!noMail) toggleOne(c._id); }}
                      style={{ width:"auto", marginTop:4, accentColor:G.primary }}/>
                    <Av name={c.name} size={36}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontWeight:700, fontSize:13, color:G.text,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {c.name}
                        </span>
                        {c.match !== null && (
                          <span style={{ fontSize:10, fontWeight:800, color:G.primary,
                            background:G.primaryLight, padding:"2px 7px", borderRadius:99, flexShrink:0 }}>
                            {c.match}%
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:11, color: noMail ? G.danger : G.muted, marginTop:2,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {noMail ? "⚠️ No email" : c.email}
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:5 }}>
                        <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px",
                          borderRadius:99, background:ss.bg, color:ss.text }}>● {ss.label}</span>
                        {c.skills?.length > 0 && (
                          <span style={{ fontSize:10, color:G.muted }}>
                            {c.skills.slice(0,2).join(", ")}{c.skills.length > 2 ? ` +${c.skills.length-2}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ════ RIGHT: Email Compose ════ */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", background:G.bg, overflow:"hidden" }}>

          {/* Compose header */}
          <div style={{ background:G.white, borderBottom:`1px solid ${G.border}`,
            padding:"16px 28px", display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
            <div style={{ width:44, height:44, borderRadius:12, flexShrink:0,
              background:`linear-gradient(135deg,${G.primary},${G.primaryDark})`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:20, boxShadow:`0 4px 14px ${G.primary}44` }}>📧</div>
            <div>
              <div style={{ fontWeight:800, fontSize:16, color:G.text }}>Compose Email</div>
              <div style={{ fontSize:12, color:G.muted, marginTop:2 }}>
                {selectedIds.length > 0
                  ? `${recipients.length} selected candidate${recipients.length > 1 ? "s" : ""}`
                  : `${filtered.filter(c => c.email).length} candidate${filtered.filter(c => c.email).length !== 1 ? "s" : ""} in current filter`}
                {" · "}use <code style={{ background:G.bg, padding:"1px 5px", borderRadius:4, fontSize:11 }}>[Name]</code> for candidate's name
              </div>
            </div>

            {/* Recipients preview */}
            {recipients.length > 0 && (
              <div style={{ marginLeft:"auto", display:"flex", flexWrap:"wrap", gap:5, maxWidth:300, justifyContent:"flex-end" }}>
                {recipients.slice(0,4).map(r => (
                  <span key={r._id} style={{ display:"inline-flex", alignItems:"center", gap:5,
                    background:G.primaryLight, color:G.primary,
                    fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:99,
                    border:`1px solid ${G.primary}22` }}>
                    <Av name={r.name} size={16}/> {r.name}
                  </span>
                ))}
                {recipients.length > 4 && (
                  <span style={{ fontSize:11, color:G.muted, padding:"4px 8px",
                    background:G.bg, borderRadius:99, border:`1px solid ${G.border}` }}>
                    +{recipients.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Compose form */}
          <div style={{ flex:1, overflowY:"auto", padding:28, display:"flex", flexDirection:"column", gap:18 }}>

            {/* Subject */}
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:G.muted,
                textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:8 }}>
                Subject
              </label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Email subject…"
                style={{ width:"100%", padding:"12px 16px", borderRadius:12, fontSize:14,
                  border:`1.5px solid ${G.border}`, background:G.white,
                  color:G.text, fontFamily:"'Inter',sans-serif", outline:"none",
                  transition:"border-color 0.18s",
                  boxShadow: subject ? `0 0 0 3px ${G.primary}18` : "none" }}
                onFocus={e => e.target.style.borderColor = G.primary}
                onBlur={e  => e.target.style.borderColor = G.border}
              />
            </div>

            {/* Body */}
            <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
              <label style={{ fontSize:11, fontWeight:700, color:G.muted,
                textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:8 }}>
                Message
              </label>
              <textarea value={body} onChange={e => setBody(e.target.value)}
                placeholder="Write your email here…"
                style={{ flex:1, minHeight:260, width:"100%", padding:"14px 16px",
                  borderRadius:12, fontSize:14, lineHeight:1.7,
                  border:`1.5px solid ${G.border}`, background:G.white,
                  color:G.text, fontFamily:"'Inter',sans-serif", outline:"none",
                  resize:"vertical", transition:"border-color 0.18s" }}
                onFocus={e => e.target.style.borderColor = G.primary}
                onBlur={e  => e.target.style.borderColor = G.border}
              />
              <div style={{ textAlign:"right", fontSize:11, color:G.muted, marginTop:6 }}>
                {body.length} characters
              </div>
            </div>
          </div>

          {/* Send bar */}
          <div style={{ background:G.white, borderTop:`1px solid ${G.border}`,
            padding:"16px 28px", display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>

            {/* Status: no recipients warning */}
            {recipients.length === 0 && !candsLoading && (
              <span style={{ fontSize:13, color:G.muted }}>
                ← Select candidates from the list to send
              </span>
            )}

            {recipients.length > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:13, color:G.textMed, fontWeight:500 }}>To:</span>
                <span style={{ fontSize:13, fontWeight:700, color:G.primary }}>
                  {recipients.length} candidate{recipients.length > 1 ? "s" : ""}
                </span>
                <span style={{ fontSize:12, color:G.muted }}>
                  ({recipients.map(r => r.email).slice(0,2).join(", ")}{recipients.length > 2 ? ` +${recipients.length-2} more` : ""})
                </span>
              </div>
            )}

            <div style={{ flex:1 }}/>

            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim() || recipients.length === 0}
              style={{
                background: (sending || !subject.trim() || !body.trim() || recipients.length === 0)
                  ? G.border
                  : `linear-gradient(135deg,${G.primary},${G.primaryDark})`,
                color: (sending || !subject.trim() || !body.trim() || recipients.length === 0) ? G.muted : "#fff",
                border:"none", borderRadius:99, padding:"12px 32px",
                fontSize:14, fontWeight:700, cursor: sending ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", gap:8,
                boxShadow: recipients.length > 0 ? `0 6px 20px ${G.primary}44` : "none",
                transition:"all 0.2s",
              }}>
              {sending
                ? <>⏳ Sending…</>
                : <>📧 Send Email{recipients.length > 0 ? ` (${recipients.length})` : ""}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
