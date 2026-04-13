// frontend/src/components/ApplicationsPage.jsx
// Replace the ApplicationsPage component inside ProfileSection.jsx with this

import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../contexts/AuthContext';


const BLUE  = '#4a6cf7';
const GRAD  = 'linear-gradient(135deg,#4a6cf7,#7c4dff)';
const LIGHT = '#f0f4ff';

/* ─── helpers ─────────────────────────────────────────── */
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const timeAgo = (d) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

const normStatus = (s) => {
  if (!s) return 'pending';
  const l = s.toLowerCase().trim();
  if (l === 'shortlisted' || l === 'interview') return 'shortlisted';
  if (l === 'accepted' || l === 'offered' || l === 'hired') return 'accepted';
  if (l === 'reviewed' || l === 'reviewing') return 'reviewed';
  if (l === 'rejected' || l === 'declined') return 'rejected';
  return 'pending';
};

const STATUS_PILL = {
  pending:     { color: '#ed8936', bg: 'rgba(237,137,54,0.12)',  icon: '⏳', label: 'Applied'     },
  reviewed:    { color: '#4a6cf7', bg: 'rgba(74,108,247,0.10)',  icon: '👀', label: 'Reviewing'   },
  shortlisted: { color: '#7c4dff', bg: 'rgba(124,77,255,0.12)', icon: '🎯', label: 'Shortlisted' },
  accepted:    { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: '🎉', label: 'Offered'     },
  rejected:    { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  icon: '❌', label: 'Rejected'    },
};

const BackBtn = ({ onClick }) => (
  <button onClick={onClick} style={{ background: 'none', border: 'none', color: BLUE, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 10, padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
    ← Back to Profile
  </button>
);

const Toast = ({ msg }) =>
  msg ? (
    <div style={{ position: 'fixed', top: 20, right: 20, background: '#2d3748', color: 'white', padding: '12px 20px', borderRadius: 12, zIndex: 99999, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
      {msg}
    </div>
  ) : null;

/* ─── Score bar ────────────────────────────────────────── */
const ScoreBar = ({ label, val, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontSize: 10, color: '#94a3b8', width: 84, flexShrink: 0 }}>{label}</span>
    <div style={{ flex: 1, height: 5, background: '#e8edf5', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${val || 0}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 1s ease' }} />
    </div>
    <span style={{ fontSize: 11, fontWeight: 700, color, width: 24, textAlign: 'right' }}>{val || 0}</span>
  </div>
);

/* ─── Job Select Modal (for "Start AI Interview" button) ─ */
const JobSelectModal = ({ apps, onSelect, onClose }) => {
  const eligible = apps.filter(a => {
    const s = normStatus(a.status);
    return s !== 'rejected';
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 18, color: '#2d3748' }}>🎤 Start AI Interview</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#718096' }}>Kis job ke liye AI interview dena chahte ho?</p>
          </div>
          <button onClick={onClose} style={{ background: '#f7f8fc', border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#718096' }}>✕</button>
        </div>

        {eligible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#718096', fontSize: 14 }}>
            Koi eligible application nahi hai abhi.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340, overflowY: 'auto' }}>
            {eligible.map(app => {
              const job = app.jobId || {};
              const s = normStatus(app.status);
              const pill = STATUS_PILL[s];
              return (
                <div key={app._id || app.id}
                  onClick={() => onSelect(app)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, border: s === 'shortlisted' ? '1.5px solid rgba(124,77,255,0.4)' : '1.5px solid #e8edf5', cursor: 'pointer', transition: 'all 0.15s', background: s === 'shortlisted' ? 'rgba(124,77,255,0.03)' : 'white' }}
                  onMouseEnter={e => { e.currentTarget.style.background = LIGHT; e.currentTarget.style.borderColor = BLUE; }}
                  onMouseLeave={e => { e.currentTarget.style.background = s === 'shortlisted' ? 'rgba(124,77,255,0.03)' : 'white'; e.currentTarget.style.borderColor = s === 'shortlisted' ? 'rgba(124,77,255,0.4)' : '#e8edf5'; }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                    {(job.company || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#2d3748' }}>{job.title || 'Unknown Role'}</div>
                    <div style={{ fontSize: 12, color: '#718096' }}>{job.company || ''}{job.location ? ` · ${job.location}` : ''}</div>
                  </div>
                  <span style={{ background: pill.bg, color: pill.color, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
                    {pill.icon} {pill.label}
                  </span>
                  {s === 'shortlisted' && (
                    <span style={{ fontSize: 10, background: 'rgba(124,77,255,0.1)', color: '#7c4dff', borderRadius: 20, padding: '3px 10px', fontWeight: 700, flexShrink: 0 }}>⭐ Recommended</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Main ApplicationsPage ────────────────────────────── */
const ApplicationsPage = ({ onBack }) => {
  const { user: authUser } = useContext(AuthContext);
  const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const [apps,            setApps]            = useState([]);
  const [tab,             setTab]             = useState('all');        // 'all' | 'shortlisted' | 'interviewed'
  const [timeFilter,      setTimeFilter]      = useState('all');        // 'all' | 'week' | 'month' | 'year' | 'top5'
  const [loading,         setLoading]         = useState(true);
  const [toast,           setToast]           = useState('');
  const [reports,         setReports]         = useState({});
  const [expanded,        setExpanded]        = useState(null);
  const [showJobModal,    setShowJobModal]     = useState(false);
  const [interviewApp,    setInterviewApp]    = useState(null);
  const [AIRoom,          setAIRoom]          = useState(null);

  const showToast = m => { setToast(m); setTimeout(() => setToast(''), 4000); };

  /* ── Load apps ── */
  useEffect(() => {
    (async () => {
      try {
        const { jobService } = await import('../services/JobService');
        const data = await jobService.getUserApplications();
        const loaded = (data || []).sort((a, b) =>
          new Date(b.appliedAt || b.createdAt || 0) - new Date(a.appliedAt || a.createdAt || 0)
        );
        setApps(loaded);
        fetchAllReports(loaded);
      } catch { setApps([]); }
      finally { setLoading(false); }
    })();
  }, []);

  /* ── Fetch AI reports ── */
  const fetchAllReports = async (appList) => {
    if (!appList.length) return;
    const token = localStorage.getItem('token');
    const results = {};
    await Promise.all(appList.map(async app => {
      const appId = app._id || app.id;
      try {
        const res = await fetch(`${API}/interview/report/${appId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const d = await res.json();
          if (d?.report) results[appId] = d.report;
        }
      } catch {}
    }));
    setReports(results);
  };

  /* ── Launch AI Interview ── */
  const launchInterview = async (app) => {
    const normalised = {
      ...app,
      _id:           app._id || app.id,
      applicationId: app._id || app.id,
      jobTitle:      app.jobId?.title   || app.title   || 'the position',
      company:       app.jobId?.company || app.company || '',
      candidateName: (typeof app.applicantId === 'object' ? app.applicantId?.username : '')
                     || authUser?.username || authUser?.name || '',
    };
    const mod = await import('./recruiter/AIInterviewRoom');
    setAIRoom(() => mod.default);
    setInterviewApp(normalised);
    setShowJobModal(false);
  };

  const hasReport = (app) => !!reports[app._id || app.id];

  /* ── Filters ── */
  const getDisplayedApps = () => {
    let result = [...apps];

    if (tab === 'shortlisted') {
      return result.filter(a => normStatus(a.status) === 'shortlisted');
    }
    if (tab === 'interviewed') {
      return result.filter(a => hasReport(a));
    }

    // All tab — time filters
    const now = Date.now();
    if (timeFilter === 'week')  result = result.filter(a => new Date(a.appliedAt || a.createdAt || 0) >= new Date(now - 7  * 86400000));
    if (timeFilter === 'month') result = result.filter(a => new Date(a.appliedAt || a.createdAt || 0) >= new Date(now - 30 * 86400000));
    if (timeFilter === 'year')  result = result.filter(a => new Date(a.appliedAt || a.createdAt || 0) >= new Date(now - 365 * 86400000));
    if (timeFilter === 'top5')  result = result.slice(0, 5);

    return result;
  };

  const displayedApps    = getDisplayedApps();
  const shortlistedCount = apps.filter(a => normStatus(a.status) === 'shortlisted').length;
  const interviewedCount = apps.filter(a => hasReport(a)).length;

  /* ── If AI interview running ── */
  if (interviewApp && AIRoom) {
    const Comp = AIRoom;
    return (
      <Comp
        application={interviewApp}
        onClose={() => { setInterviewApp(null); setAIRoom(null); }}
        onComplete={async (report) => {
          const appId = interviewApp._id || interviewApp.id;
          setReports(prev => {
            const existing = prev[appId];
            const newScore  = report?.overallScore || 0;
            const oldScore  = existing?.overallScore || 0;
            return { ...prev, [appId]: newScore >= oldScore ? report : existing };
          });
          setInterviewApp(null);
          setAIRoom(null);
          showToast(`🎉 Interview complete! Score: ${report.overallScore}/100 — ${report.recommendation}`);
          const { jobService } = await import('../services/JobService');
          const data = await jobService.getUserApplications();
          setApps((data || []).sort((a, b) => new Date(b.appliedAt || b.createdAt || 0) - new Date(a.appliedAt || a.createdAt || 0)));
        }}
      />
    );
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: "'Segoe UI',sans-serif", minHeight: '100vh', background: '#f5f7ff' }}>
      <Toast msg={toast} />
      {showJobModal && (
        <JobSelectModal
          apps={apps}
          onSelect={launchInterview}
          onClose={() => setShowJobModal(false)}
        />
      )}

      <BackBtn onClick={onBack} />

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontWeight: 800, fontSize: 22, color: '#2d3748' }}>My Applications</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#718096' }}>
            {apps.length} total · {interviewedCount} interviewed · {shortlistedCount} shortlisted
          </p>
        </div>

        {/* Start AI Interview — opens job picker modal */}
        <button
          onClick={() => setShowJobModal(true)}
          disabled={!apps.length}
          style={{
            padding: '11px 22px', borderRadius: 20, border: 'none',
            cursor: apps.length ? 'pointer' : 'not-allowed',
            background: apps.length ? 'linear-gradient(135deg,#7c4dff,#6c63ff)' : '#e2e8f0',
            color: 'white', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 7,
            boxShadow: apps.length ? '0 6px 20px rgba(124,77,255,0.4)' : 'none',
          }}>
          🎤 Start AI Interview
        </button>
      </div>

      {/* ── Two-pane layout: Left sidebar filters + Right content ── */}
      <div style={{ display: 'flex', gap: 20 }}>

        {/* ── Left sidebar: Tab switcher + Time filters ── */}
        <div style={{ width: 200, flexShrink: 0 }}>

          {/* Main tabs */}
          <div style={{ background: 'white', borderRadius: 16, padding: '10px 8px', boxShadow: '0 2px 12px rgba(74,108,247,0.07)', border: '1px solid #e8edf5', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 12px 8px' }}>View</div>
            {[
              { key: 'all',         icon: '📋', label: 'All Applications', count: apps.length },
              { key: 'shortlisted', icon: '🎯', label: 'Shortlisted',       count: shortlistedCount },
              { key: 'interviewed', icon: '🤖', label: 'AI Interviewed',    count: interviewedCount },
            ].map(t => (
              <button key={t.key}
                onClick={() => { setTab(t.key); setTimeFilter('all'); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                  border: 'none', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                  background: tab === t.key ? LIGHT : 'transparent',
                  color: tab === t.key ? BLUE : '#718096',
                  fontWeight: tab === t.key ? 700 : 500, fontSize: 13, textAlign: 'left',
                }}>
                <span>{t.icon}</span>
                <span style={{ flex: 1 }}>{t.label}</span>
                <span style={{ background: tab === t.key ? 'rgba(74,108,247,0.2)' : '#f0f4ff', color: tab === t.key ? BLUE : '#94a3b8', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Time filters — only for All tab */}
          {tab === 'all' && (
            <div style={{ background: 'white', borderRadius: 16, padding: '10px 8px', boxShadow: '0 2px 12px rgba(74,108,247,0.07)', border: '1px solid #e8edf5' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 12px 8px' }}>Filter by Time</div>
              {[
                { key: 'all',   icon: '🗂️', label: 'All Time'   },
                { key: 'week',  icon: '📅', label: 'Last Week'  },
                { key: 'month', icon: '🗓️', label: 'Last Month' },
                { key: 'year',  icon: '📆', label: 'Last Year'  },
                { key: 'top5',  icon: '⭐', label: 'Top 5 Latest' },
              ].map(tf => (
                <button key={tf.key}
                  onClick={() => setTimeFilter(tf.key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                    border: 'none', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                    background: timeFilter === tf.key ? LIGHT : 'transparent',
                    color: timeFilter === tf.key ? BLUE : '#718096',
                    fontWeight: timeFilter === tf.key ? 700 : 500, fontSize: 12, textAlign: 'left',
                  }}>
                  <span>{tf.icon}</span>
                  <span>{tf.label}</span>
                  {timeFilter === tf.key && (
                    <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: BLUE }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Cards ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Tab description */}
          {tab === 'shortlisted' && (
            <div style={{ marginBottom: 14, padding: '10px 16px', background: 'rgba(124,77,255,0.06)', border: '1px solid rgba(124,77,255,0.2)', borderRadius: 12, fontSize: 12, color: '#7c4dff', fontWeight: 600 }}>
              🎯 Recruiter ne inhe shortlist kiya hai — yahan AI interview ka option nahi hai, upar wala button use karo
            </div>
          )}
          {tab === 'interviewed' && (
            <div style={{ marginBottom: 14, padding: '10px 16px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, fontSize: 12, color: '#059669', fontWeight: 600 }}>
              🤖 Yeh woh roles hain jinke liye tune AI mock interview de diya hai · Best score automatically save hota hai
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: BLUE, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <p style={{ color: '#718096', fontSize: 14 }}>Loading applications...</p>
            </div>
          ) : displayedApps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {tab === 'shortlisted' ? '🎯' : tab === 'interviewed' ? '🤖' : '📋'}
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#2d3748', margin: '0 0 8px' }}>
                {tab === 'shortlisted' ? 'Abhi tak shortlisted nahi hui' :
                 tab === 'interviewed' ? 'Koi AI interview complete nahi hua' :
                 timeFilter !== 'all'  ? 'Is period mein koi application nahi' :
                 'Koi application nahi abhi'}
              </p>
              <p style={{ fontSize: 13, color: '#718096', margin: 0 }}>
                {tab === 'interviewed' ? 'Upar wala "🎤 Start AI Interview" button click karo' :
                 'Jobs browse karo aur apply karo'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {displayedApps.map((app, idx) => {
                const jobData = app.jobId || {};
                const appId   = app._id || app.id;
                const status  = normStatus(app.status);
                const pill    = STATUS_PILL[status] || STATUS_PILL.pending;
                const report  = reports[appId];
                const isShort = status === 'shortlisted';
                const isRej   = status === 'rejected';
                const isExp   = expanded === appId;
                const skills  = (jobData.requiredSkills || []).map(s => typeof s === 'object' ? s.name : s);
                const isLatest = idx === 0 && tab === 'all' && timeFilter === 'all';

                return (
                  <div key={appId} style={{
                    background: 'white', borderRadius: 18,
                    border: isShort ? '1.5px solid rgba(124,77,255,0.35)' :
                            isLatest ? '1.5px solid rgba(74,108,247,0.35)' :
                            '1.5px solid #e8edf5',
                    boxShadow: isShort ? '0 4px 20px rgba(124,77,255,0.1)' :
                               isLatest ? '0 4px 20px rgba(74,108,247,0.1)' :
                               '0 2px 12px rgba(74,108,247,0.05)',
                    overflow: 'hidden', transition: 'all 0.2s',
                  }}>
                    {/* Top accent strip */}
                    {isShort && <div style={{ height: 3, background: 'linear-gradient(90deg,#7c4dff,#6c63ff,#4a6cf7)' }} />}
                    {isLatest && !isShort && <div style={{ height: 3, background: 'linear-gradient(90deg,#4a6cf7,#7c4dff)' }} />}

                    <div style={{ padding: '16px 20px' }}>
                      {/* ── Row 1: Info + badges ── */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>

                        {/* Latest / rank badge */}
                        {tab === 'all' && timeFilter === 'all' && (
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
                            background: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7c3a' : '#f0f4ff',
                            color: idx < 3 ? 'white' : '#94a3b8',
                          }}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                          </div>
                        )}

                        {/* Company avatar */}
                        <div style={{ width: 46, height: 46, borderRadius: 13, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 17, flexShrink: 0 }}>
                          {(jobData.company || '?').charAt(0).toUpperCase()}
                        </div>

                        {/* Job info */}
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: '#2d3748' }}>{jobData.title || 'Unknown Job'}</span>
                            {isLatest && <span style={{ fontSize: 9, background: 'rgba(74,108,247,0.12)', color: BLUE, borderRadius: 20, padding: '2px 7px', fontWeight: 700 }}>LATEST</span>}
                          </div>
                          <div style={{ fontSize: 12, color: '#718096', marginTop: 1 }}>
                            {jobData.company || ''}{jobData.location ? ` · ${jobData.location}` : ''}
                          </div>
                          <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 2 }}>
                            Applied {fmtDate(app.appliedAt)} · {timeAgo(app.appliedAt)}
                          </div>
                        </div>

                        {/* Status pill */}
                        <span style={{ background: pill.bg, color: pill.color, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '5px 12px', flexShrink: 0 }}>
                          {pill.icon} {pill.label}
                        </span>

                        {/* AI Score badge (if interviewed) — shown in ALL tabs */}
                        {report && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: report.overallScore >= 75 ? 'rgba(16,185,129,0.08)' : report.overallScore >= 50 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${report.overallScore >= 75 ? '#10b98130' : report.overallScore >= 50 ? '#f59e0b30' : '#ef444430'}`, borderRadius: 20, padding: '4px 12px' }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', border: `2.5px solid ${report.overallScore >= 75 ? '#10b981' : report.overallScore >= 50 ? '#f59e0b' : '#ef4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: report.overallScore >= 75 ? '#10b981' : report.overallScore >= 50 ? '#f59e0b' : '#ef4444' }}>
                              {report.overallScore}
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: report.overallScore >= 75 ? '#10b981' : report.overallScore >= 50 ? '#f59e0b' : '#ef4444', lineHeight: 1 }}>
                                {report.recommendation || 'AI Score'}
                              </div>
                              <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1, marginTop: 1 }}>AI Score</div>
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                          {/* Details toggle */}
                          <button
                            onClick={() => setExpanded(isExp ? null : appId)}
                            style={{ padding: '8px 14px', background: LIGHT, color: BLUE, border: '1px solid #e0e7ff', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            {isExp ? '▲ Hide' : '▼ Details'}
                          </button>
                        </div>
                      </div>

                      {/* ── AI Report section (in "interviewed" tab or if report exists) ── */}
                      {report && tab === 'interviewed' && (
                        <div style={{ marginTop: 14, padding: '16px 18px', background: 'linear-gradient(135deg,rgba(124,77,255,0.05),rgba(74,108,247,0.03))', border: '1px solid rgba(124,77,255,0.2)', borderRadius: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 15 }}>🤖</span>
                              <span style={{ fontWeight: 700, fontSize: 13, color: '#4c1d95' }}>
                                AI Interview — {jobData.title || 'Role'}
                              </span>
                              <span style={{ fontSize: 10, background: 'rgba(124,77,255,0.1)', color: '#7c4dff', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>Best Score Saved</span>
                            </div>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>
                              {report.recommendation === 'Strong Hire' ? '🏆' : report.recommendation === 'Hire' ? '✅' : report.recommendation === 'Maybe' ? '🤔' : '❌'} {report.recommendation}
                            </span>
                          </div>

                          {/* Score bars */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', marginBottom: 12 }}>
                            <ScoreBar label="Overall"       val={report.overallScore}       color="#7c4dff" />
                            <ScoreBar label="Communication" val={report.communicationScore} color="#4a6cf7" />
                            <ScoreBar label="Technical"     val={report.technicalScore}     color="#059669" />
                            <ScoreBar label="Confidence"    val={report.confidenceScore}    color="#f59e0b" />
                          </div>

                          {report.summary && (
                            <p style={{ margin: '0 0 12px', fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
                              {report.summary.slice(0, 200)}{report.summary.length > 200 ? '…' : ''}
                            </p>
                          )}

                          {/* Try Again / Update Score */}
                          <button
                            onClick={() => launchInterview(app)}
                            style={{ padding: '8px 20px', borderRadius: 20, border: '1.5px solid rgba(124,77,255,0.4)', cursor: 'pointer', background: 'white', color: '#7c4dff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            🔄 Try Again / Update Score
                          </button>
                        </div>
                      )}

                      {/* ── Shortlisted banner (no AI interview button here) ── */}
                      {isShort && tab !== 'interviewed' && (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(124,77,255,0.06)', border: '1px dashed rgba(124,77,255,0.3)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 18 }}>🎯</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c4dff' }}>Recruiter ne shortlist kiya hai!</div>
                            <div style={{ fontSize: 11, color: '#718096' }}>AI Mock Interview ke liye upar wala "🎤 Start AI Interview" button use karo</div>
                          </div>
                        </div>
                      )}

                      {/* ── Expanded details ── */}
                      {isExp && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f0f4ff' }}>
                          {/* Score bars for all tabs (if report exists) */}
                          {report && tab !== 'interviewed' && (
                            <div style={{ marginBottom: 14, padding: '14px 16px', background: 'rgba(124,77,255,0.04)', border: '1px solid rgba(124,77,255,0.15)', borderRadius: 12 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#7c4dff', marginBottom: 10 }}>🤖 AI Interview Result</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', marginBottom: 10 }}>
                                <ScoreBar label="Overall"       val={report.overallScore}       color="#7c4dff" />
                                <ScoreBar label="Communication" val={report.communicationScore} color="#4a6cf7" />
                                <ScoreBar label="Technical"     val={report.technicalScore}     color="#059669" />
                                <ScoreBar label="Confidence"    val={report.confidenceScore}    color="#f59e0b" />
                              </div>
                              <button
                                onClick={() => launchInterview(app)}
                                style={{ padding: '7px 16px', borderRadius: 20, border: '1.5px solid rgba(124,77,255,0.35)', cursor: 'pointer', background: 'white', color: '#7c4dff', fontSize: 11, fontWeight: 700 }}>
                                🔄 Try Again / Update Score
                              </button>
                            </div>
                          )}

                          {/* Skills */}
                          {skills.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 11, color: '#718096', fontWeight: 600, marginBottom: 6 }}>Required Skills</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {skills.map(s => (
                                  <span key={s} style={{ background: LIGHT, color: BLUE, fontSize: 11, fontWeight: 600, borderRadius: 10, padding: '3px 10px' }}>{s}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Job details */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                            {[
                              { label: 'Type',       val: jobData.type     || '—' },
                              { label: 'Experience', val: jobData.experience || '—' },
                              { label: 'Location',   val: jobData.location  || '—' },
                              { label: 'Salary',     val: jobData.salaryRange ? `${jobData.salaryRange.currency || '₹'}${(jobData.salaryRange.min || 0).toLocaleString()} – ${(jobData.salaryRange.max || 0).toLocaleString()}` : '—' },
                            ].map(f => (
                              <div key={f.label} style={{ background: LIGHT, borderRadius: 10, padding: '10px 14px' }}>
                                <div style={{ fontSize: 10, color: '#a0aec0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</div>
                                <div style={{ fontSize: 13, color: '#2d3748', fontWeight: 600, marginTop: 2 }}>{f.val}</div>
                              </div>
                            ))}
                          </div>

                          {/* Strengths / improvements */}
                          {report && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                              {report.strengths?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginBottom: 5 }}>💪 Strengths</div>
                                  {report.strengths.slice(0, 2).map((s, i) => (
                                    <div key={i} style={{ fontSize: 11, color: '#475569', marginBottom: 3 }}>• {s}</div>
                                  ))}
                                </div>
                              )}
                              {report.improvements?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 5 }}>🎯 Improve</div>
                                  {report.improvements.slice(0, 2).map((s, i) => (
                                    <div key={i} style={{ fontSize: 11, color: '#475569', marginBottom: 3 }}>• {s}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {app.notes && (
                            <div style={{ marginTop: 10, fontSize: 12, color: '#718096', background: '#f7f8fc', borderRadius: 10, padding: '10px 12px' }}>
                              <strong>Recruiter note:</strong> {app.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ApplicationsPage;
