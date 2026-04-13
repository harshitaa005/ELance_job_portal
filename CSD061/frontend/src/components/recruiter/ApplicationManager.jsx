import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Avatar, IconButton, alpha,
  CircularProgress, Alert, Snackbar, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider, InputAdornment, Tab, Tabs, Collapse
} from '@mui/material';
import {
  Search, Email, Chat, Schedule, CheckCircle, Cancel,
  Download, Star, StarBorder, Person, Visibility, Close, Send,
  Work, Psychology, EmojiEvents, Business,
  KeyboardArrowDown, HourglassEmpty, SmartToy
} from '@mui/icons-material';
import { AuthContext } from '../../contexts/AuthContext';
import { jobService } from '../../services/JobService';
import AIInterviewRoom from './AIInterviewRoom';
import UnityInterviewLauncher from './UnityInterviewLauncher';

const STATUS_CFG = {
  pending:     { label: 'Pending',     color: '#b45309', bg: '#fef3c7', border: '#fcd34d', text: '#78350f', icon: HourglassEmpty, glow: 'rgba(180,83,9,0.18)'  },
  reviewed:    { label: 'Reviewed',    color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc', text: '#0c4a6e', icon: Visibility,     glow: 'rgba(3,105,161,0.18)' },
  shortlisted: { label: 'Shortlisted', color: '#6d28d9', bg: '#ede9fe', border: '#c4b5fd', text: '#4c1d95', icon: EmojiEvents,    glow: 'rgba(109,40,217,0.18)'},
  accepted:    { label: 'Accepted',    color: '#047857', bg: '#d1fae5', border: '#6ee7b7', text: '#065f46', icon: CheckCircle,    glow: 'rgba(4,120,87,0.18)'  },
  rejected:    { label: 'Rejected',    color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5', text: '#7f1d1d', icon: Cancel,         glow: 'rgba(185,28,28,0.18)' },
};

const ROLE_COLORS = [
  { accent:'#4f46e5', light:'#eef2ff', mid:'#c7d2fe', grad:'linear-gradient(135deg,#4f46e5,#7c3aed)', text:'#3730a3' },
  { accent:'#0284c7', light:'#e0f2fe', mid:'#7dd3fc', grad:'linear-gradient(135deg,#0284c7,#0891b2)', text:'#075985' },
  { accent:'#059669', light:'#d1fae5', mid:'#6ee7b7', grad:'linear-gradient(135deg,#059669,#10b981)', text:'#065f46' },
  { accent:'#b45309', light:'#fef3c7', mid:'#fcd34d', grad:'linear-gradient(135deg,#b45309,#d97706)', text:'#78350f' },
  { accent:'#be185d', light:'#fce7f3', mid:'#f9a8d4', grad:'linear-gradient(135deg,#be185d,#db2777)', text:'#831843' },
  { accent:'#7c3aed', light:'#ede9fe', mid:'#c4b5fd', grad:'linear-gradient(135deg,#7c3aed,#8b5cf6)', text:'#4c1d95' },
];

const MATCH_CFG = (pct) => {
  if (pct >= 85) return { color:'#047857', bg:'#d1fae5', border:'#6ee7b7', label:'Excellent', icon:'🏆', glow:'rgba(4,120,87,0.22)' };
  if (pct >= 70) return { color:'#1d4ed8', bg:'#dbeafe', border:'#93c5fd', label:'Good',      icon:'⭐', glow:'rgba(29,78,216,0.22)' };
  if (pct >= 50) return { color:'#b45309', bg:'#fef3c7', border:'#fcd34d', label:'Fair',      icon:'📊', glow:'rgba(180,83,9,0.22)' };
  return           { color:'#b91c1c', bg:'#fee2e2', border:'#fca5a5', label:'Low',       icon:'⚠️', glow:'rgba(185,28,28,0.22)' };
};

const AVATAR_PAL = ['#4f46e5','#0284c7','#059669','#b45309','#be185d','#7c3aed','#0d9488','#b45309'];

const getInitials   = (n) => n ? n.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2) : '??';
const getAvColor    = (n) => AVATAR_PAL[(n?.charCodeAt(0)||0) % AVATAR_PAL.length];
const fmtDate       = (d) => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';

// ✅ FIX: Robust skill normalization that handles all formats
const normSkill = (s) => {
  if (!s) return '';
  if (typeof s === 'object') return (s?.skill?.name || s?.name || s?.skill || '').toString().toLowerCase().trim();
  return s.toString().toLowerCase().trim();
};

const calcMatch = (aSkills, jSkills) => {
  if (!jSkills?.length || !aSkills?.length) return 0;
  const req = jSkills.map(normSkill).filter(Boolean);
  const has = aSkills.map(normSkill).filter(Boolean);
  if (!req.length) return 0;
  return Math.round((req.filter(r => has.some(h => h.includes(r) || r.includes(h))).length / req.length) * 100);
};

// ✅ FIX: Comprehensive applicant data extractor - handles all API response shapes
const extractApplicant = (app) => {
  // The applicant info might be in different places depending on population
  const applicantId = app.applicantId || app.applicant || app.userId || {};
  return {
    _id: applicantId._id || applicantId.id || app.userId || '',
    username: applicantId.username || applicantId.name || applicantId.fullName || app.applicantName || app.name || 'Unknown Candidate',
    email: applicantId.email || app.applicantEmail || app.email || '',
    skills: applicantId.skills || app.skills || [],
    careerGoals: applicantId.careerGoals || {},
    currentRole: applicantId.currentRole || applicantId.careerGoals?.currentRole || '',
    currentCompany: applicantId.currentCompany || '',
    experience: applicantId.experience || [],
    phone: applicantId.phone || '',
  };
};

// ✅ FIX: Comprehensive array extractor for all API response shapes
const toArray = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.applications)) return res.applications;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.candidates)) return res.candidates;
  if (Array.isArray(res.results)) return res.results;
  return [];
};

// ✅ FIX: Normalize application to always have consistent structure
const normalizeApp = (app) => {
  const applicant = extractApplicant(app);
  return {
    ...app,
    _id: app.applicationId || app._id || app.id,  // always use the application's _id
    status: app.status || 'pending',
    appliedAt: app.appliedAt || app.createdAt || app.applicationDate,
    jobId: app.jobId || app.job,
    applicantId: {
      ...applicant,
      ...(typeof app.applicantId === 'object' ? app.applicantId : {}),
      username: applicant.username,
      email: applicant.email,
      skills: applicant.skills,
    },
  };
};

/* ═══ MATCH RING ═══ */
const MatchRing = ({ pct, size=70 }) => {
  const cfg = MATCH_CFG(pct);
  const r = (size-8)/2, circ = 2*Math.PI*r, dash = (pct/100)*circ;
  return (
    <Box sx={{position:'relative',width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={7}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cfg.color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{transition:'stroke-dasharray 1s ease',filter:`drop-shadow(0 0 4px ${cfg.glow})`}}/>
      </svg>
      <Box sx={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <Typography sx={{fontSize:'0.85rem',fontWeight:900,color:cfg.color,lineHeight:1}}>{pct}%</Typography>
        <Typography sx={{fontSize:'0.46rem',color:'#94a3b8',mt:0.2,textTransform:'uppercase',letterSpacing:'0.06em'}}>match</Typography>
      </Box>
    </Box>
  );
};

/* ═══ STATUS BADGE ═══ */
const StatusBadge = ({ status, size='sm' }) => {
  const c = STATUS_CFG[status] || STATUS_CFG.pending;
  const Icon = c.icon;
  return (
    <Box sx={{
      display:'inline-flex', alignItems:'center', gap:0.5,
      px: size==='lg'?1.4:1, py: size==='lg'?0.6:0.35,
      borderRadius:'999px', backgroundColor:c.bg,
      border:`1.5px solid ${c.border}`,
      boxShadow:`0 2px 8px ${c.glow}`,
    }}>
      <Icon sx={{fontSize:size==='lg'?13:11, color:c.color}}/>
      <Typography sx={{fontSize:size==='lg'?'0.72rem':'0.6rem', fontWeight:700, color:c.text, letterSpacing:'0.01em'}}>
        {c.label}
      </Typography>
    </Box>
  );
};

/* ═══ STATUS UPDATE BAR ═══ */
const StatusBar = ({ current, onUpdate, loading, compact }) => (
  <Box sx={{display:'flex',gap:0.6,flexWrap:'wrap'}}>
    {Object.entries(STATUS_CFG).map(([k,v]) => {
      const Icon = v.icon, active = current===k;
      return (
        <Button key={k} size="small" disabled={loading} onClick={()=>!active && onUpdate(k)}
          startIcon={<Icon sx={{fontSize:compact?11:13}}/>}
          sx={{
            textTransform:'none', fontWeight:700,
            fontSize:compact?'0.62rem':'0.7rem',
            borderRadius:'9px', px:compact?1:1.3, py:compact?0.4:0.65,
            minWidth:0, transition:'all 0.18s',
            ...(active ? {
              backgroundColor:v.bg, color:v.text, border:`1.5px solid ${v.border}`,
              boxShadow:`0 2px 10px ${v.glow}`, transform:'scale(1.04)',
            } : {
              backgroundColor:'#f1f5f9', color:'#64748b', border:'1.5px solid #e2e8f0',
              '&:hover':{ backgroundColor:v.bg, color:v.text, border:`1.5px solid ${v.border}`, boxShadow:`0 2px 8px ${v.glow}` },
            }),
          }}>
          {v.label}
        </Button>
      );
    })}
  </Box>
);

/* ═══ CANDIDATE CARD ═══ */
const CandidateCard = ({ app, jobSkills, rank, roleColor, onView, isFav, onFav, onStatus, statusLoading }) => {
  const applicant = app.applicantId || {};
  const pct = calcMatch(applicant.skills, jobSkills);
  const mc = MATCH_CFG(pct);
  const [open, setOpen] = useState(false);
  const badge = ['🥇','🥈','🥉'][rank-1];

  // ✅ FIX: use robust name extraction
  const displayName = applicant.username || applicant.name || applicant.fullName || 'Unknown Candidate';
  const displayRole = applicant.careerGoals?.currentRole || applicant.currentRole || 'Role not specified';

  return (
    <Box sx={{
      backgroundColor:'#ffffff',
      border:'1.5px solid #e8edf5',
      borderLeft:`4px solid ${mc.color}`,
      borderRadius:'14px', overflow:'hidden',
      boxShadow:'0 2px 8px rgba(15,23,42,0.06)',
      transition:'all 0.2s ease',
      '&:hover':{
        boxShadow:`0 6px 24px ${mc.glow}, 0 2px 8px rgba(15,23,42,0.08)`,
        borderColor:mc.color, transform:'translateY(-2px)',
      },
    }}>
      <Box onClick={()=>onView(app)} sx={{display:'flex',alignItems:'center',gap:1.5,p:1.5,cursor:'pointer'}}>
        {/* Rank */}
        <Typography sx={{fontSize:'1rem',minWidth:24,textAlign:'center',flexShrink:0}}>
          {badge || <Typography component="span" sx={{fontSize:'0.64rem',color:'#94a3b8',fontWeight:700}}>#{rank}</Typography>}
        </Typography>

        {/* Avatar */}
        <Box sx={{position:'relative',flexShrink:0}}>
          <Avatar sx={{
            width:42,height:42,fontWeight:800,fontSize:'0.85rem',color:'#fff',
            backgroundColor:getAvColor(displayName),
            boxShadow:`0 3px 10px ${getAvColor(displayName)}55`,
          }}>
            {getInitials(displayName)}
          </Avatar>
          <IconButton size="small" onClick={e=>{e.stopPropagation();onFav(app._id);}}
            sx={{position:'absolute',bottom:-5,right:-5,width:18,height:18,p:0,
              backgroundColor:'#fff',border:'1.5px solid #e2e8f0',
              boxShadow:'0 2px 6px rgba(0,0,0,0.1)',
              transition:'transform 0.2s','&:hover':{transform:'scale(1.2)'}}}>
            {isFav ? <Star sx={{fontSize:11,color:'#f59e0b'}}/> : <StarBorder sx={{fontSize:11,color:'#cbd5e1'}}/>}
          </IconButton>
        </Box>

        {/* Name + info */}
        <Box sx={{flex:1,minWidth:0}}>
          <Typography sx={{fontWeight:700,fontSize:'0.86rem',color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {displayName}
          </Typography>
          <Typography sx={{fontSize:'0.65rem',color:'#64748b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',mt:0.1}}>
            {displayRole}
          </Typography>
          <Box sx={{display:'flex',gap:0.4,mt:0.5,flexWrap:'wrap'}}>
            {(applicant.skills||[]).slice(0,3).map((sk,i)=>(
              <Box key={i} sx={{px:'7px',py:'2px',borderRadius:'6px',fontSize:'0.56rem',fontWeight:600,
                backgroundColor:roleColor.light,color:roleColor.accent,border:`1px solid ${roleColor.mid}`}}>
                {normSkill(sk)}
              </Box>
            ))}
            {(applicant.skills||[]).length>3 &&
              <Typography sx={{fontSize:'0.55rem',color:'#94a3b8',alignSelf:'center'}}>
                +{applicant.skills.length-3}
              </Typography>}
          </Box>
        </Box>

        {/* Match % */}
        <Box sx={{px:1.2,py:0.4,borderRadius:'999px',backgroundColor:mc.bg,border:`1.5px solid ${mc.border}`,
          boxShadow:`0 2px 8px ${mc.glow}`,display:'flex',alignItems:'center',gap:0.5,flexShrink:0}}>
          <Typography sx={{fontSize:'0.75rem',fontWeight:900,color:mc.color}}>{pct}%</Typography>
          <Typography sx={{fontSize:'0.6rem',lineHeight:1}}>{mc.icon}</Typography>
        </Box>

        {/* Status badge */}
        <Box sx={{flexShrink:0}}><StatusBadge status={app.status}/></Box>

        {/* Expand toggle */}
        <IconButton size="small" onClick={e=>{e.stopPropagation();setOpen(p=>!p);}}
          sx={{color:'#94a3b8',transition:'all 0.2s',transform:open?'rotate(180deg)':'none',
            '&:hover':{color:'#475569',backgroundColor:'#f1f5f9'},flexShrink:0}}>
          <KeyboardArrowDown sx={{fontSize:18}}/>
        </IconButton>
      </Box>

      {/* Inline status update */}
      <Collapse in={open}>
        <Box sx={{px:1.5,pb:1.2,pt:1,borderTop:'1.5px solid #f1f5f9',
          background:'linear-gradient(to bottom,#f8fafc,#fff)'}}>
          <Box sx={{display:'flex',alignItems:'center',justifyContent:'space-between',mb:0.8}}>
            <Typography sx={{fontSize:'0.6rem',color:'#64748b',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em'}}>
              Quick Status Update
            </Typography>
            {statusLoading && <CircularProgress size={12} sx={{color:'#6366f1'}}/>}
          </Box>
          <StatusBar current={app.status} onUpdate={s=>onStatus(app,s)} loading={statusLoading} compact/>
        </Box>
      </Collapse>
    </Box>
  );
};

/* ═══════════════════════════
   MAIN
═══════════════════════════ */
const ApplicationManager = () => {
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading,       setLoading]       = useState(true);
  const [snackbar,      setSnackbar]      = useState({open:false,message:'',severity:'success'});
  const [searchTerm,    setSearchTerm]    = useState('');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [activeTab,     setActiveTab]     = useState(0);
  const [jobs,          setJobs]          = useState([]);
  const [allApps,       setAllApps]       = useState({});
  const [favorites,     setFavorites]     = useState(new Set());
  const [selectedApp,   setSelectedApp]   = useState(null);
  const [detailsOpen,   setDetailsOpen]   = useState(false);
  const [scheduleOpen,  setScheduleOpen]  = useState(false);
  const [chatOpen,      setChatOpen]      = useState(false);
  const [aiInterviewApp, setAiInterviewApp] = useState(null);
  const [aiReport,      setAiReport]      = useState(null);  // fetched interview report
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [chatMsgs,      setChatMsgs]      = useState([]);
  const [chatInput,     setChatInput]     = useState('');
  const [updStatus,     setUpdStatus]     = useState(false);
  const [updId,         setUpdId]         = useState(null);
  const [schedDateTime, setSchedDateTime] = useState('');
  const [schedType,     setSchedType]     = useState('video');
  const [schedLink,     setSchedLink]     = useState('');
  const [schedNotes,    setSchedNotes]    = useState('');
  const [schedLoading,  setSchedLoading]  = useState(false);
  const [matchFilter, setMatchFilter] = useState(0);

  useEffect(()=>{ if(user?.userType==='recruiter') fetchAll(); },[user]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const jobsRes = await jobService.getRecruiterJobs();
      const list = toArray(jobsRes);
      setJobs(list);
      const map = {};
      await Promise.all(list.map(async job => {
        try {
          const res = await jobService.getJobApplications(job._id);
          const raw = toArray(res);
          // ✅ FIX: Normalize every application so data shape is consistent
          map[job._id] = raw.map(normalizeApp);
        } catch(err) {
          console.warn(`Failed to load apps for job ${job._id}:`, err);
          map[job._id] = [];
        }
      }));
      setAllApps(map);
    } catch(err) {
      console.error('fetchAll error:', err);
      showSnack('Failed to load applications','error');
    }
    finally { setLoading(false); }
  };

  // ── Auto-select correct tab after jobs finish loading ──────
  useEffect(() => {
    if (loading || !jobs.length) return;

    const jobIdFromUrl     = searchParams.get('jobId');
    const jobIdFromStorage = sessionStorage.getItem('applicationsJobId');
    const jobId            = jobIdFromUrl || jobIdFromStorage;

    if (!jobId) return;

    const idx = jobs.findIndex(j => j._id === jobId);
    if (idx !== -1) setActiveTab(idx);

    if (jobIdFromUrl)     setSearchParams({}, { replace: true });
    if (jobIdFromStorage) {
      sessionStorage.removeItem('applicationsJobId');
      sessionStorage.removeItem('applicationsJobTitle');
    }
  }, [jobs, loading]);

  const showSnack = (m,s='success') => setSnackbar({open:true,message:m,severity:s});

  const handleStatus = async (app, ns) => {
    if(app.status===ns) return;
    try {
      setUpdStatus(true); setUpdId(app._id);
      await jobService.updateApplicationStatus(app._id, ns);
      // ✅ FIX: robust jobId extraction
      const jid = app.jobId?._id || app.jobId || app.job?._id || app.job;
      setAllApps(p => {
        const list = Array.isArray(p[jid]) ? p[jid] : [];
        return { ...p, [jid]: list.map(a => a._id===app._id ? {...a, status:ns} : a) };
      });
      if(selectedApp?._id===app._id) setSelectedApp(p=>({...p,status:ns}));
      showSnack(`✅ Status → ${STATUS_CFG[ns]?.label}`,'success');
    } catch(err) {
      console.error('updateStatus error:', err);
      showSnack('Failed to update status','error');
    }
    finally { setUpdStatus(false); setUpdId(null); }
  };

  const handleFav = (id) => setFavorites(p=>{const s=new Set(p);s.has(id)?s.delete(id):s.add(id);return s;});

  const handleSchedule = async () => {
    if (!selectedApp) return;
    if (!schedDateTime) { showSnack('Please select a date and time', 'error'); return; }
    setSchedLoading(true);
    try {
      const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token');
      const candidateName = selectedApp.applicantId?.username || 'Candidate';
      const jobTitle = detailJob?.title || 'the position';
      const dateStr = new Date(schedDateTime).toLocaleString('en-US', {
        weekday:'long', year:'numeric', month:'long', day:'numeric',
        hour:'2-digit', minute:'2-digit'
      });
      const messageText = `Hi ${candidateName}, you have been scheduled for a ${schedType} interview for the role of ${jobTitle}.\n\n📅 Date & Time: ${dateStr}\n${schedLink ? `🔗 Link/Address: ${schedLink}\n` : ''}${schedNotes ? `📝 Notes: ${schedNotes}` : ''}`;

      const receiverId = selectedApp.applicantId?._id;
      if (receiverId) {
        await fetch(`${API}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            receiverId,
            applicationId: selectedApp._id,
            text: messageText,
            scheduledAt: schedDateTime,
          }),
        });
      }
      await handleStatus(selectedApp, 'shortlisted');
      setScheduleOpen(false);
      setSchedDateTime(''); setSchedType('video'); setSchedLink(''); setSchedNotes('');
      showSnack(`🗓 Interview scheduled for ${candidateName} & message sent!`);
    } catch (err) {
      console.error('Schedule error:', err);
      showSnack('Failed to schedule interview', 'error');
    } finally {
      setSchedLoading(false);
    }
  };

  const handleDownloadResume = async (app) => {
    const resumeUrl = app?.resumeUrl || app?.applicantId?.resumeUrl;
    if (!resumeUrl) { showSnack('No resume available for this candidate', 'error'); return; }
    try {
      const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token');
      const fullUrl = resumeUrl.startsWith('http') ? resumeUrl : `${API.replace('/api','')}/${resumeUrl.replace(/^\//,'')}`;
      const res = await fetch(fullUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch resume');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const name = app?.applicantId?.username || 'candidate';
      a.download = `${name.replace(/\s+/g,'_')}_resume.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showSnack('📄 Resume downloaded!');
    } catch (err) {
      console.error('Download error:', err);
      showSnack('Failed to download resume', 'error');
    }
  };

  const handleEmail = (app) => {
    const email = app.applicantId?.email || '';
    const title = app.jobId?.title || 'the position';
    window.open(`mailto:${email}?subject=Re: Your application for ${title}`,'_blank');
  };

  const handleChat  = (app) => {
    setSelectedApp(app);
    const name = app.applicantId?.username || 'Candidate';
    setChatMsgs([
      {id:1,sender:'candidate',message:`Hello! Thank you for considering my application.`,time:'10:30 AM'},
      {id:2,sender:'recruiter',message:`Hi ${name}! We love your profile. When are you available?`,time:'10:32 AM'},
    ]);
    setChatOpen(true);
  };

  const sendChat = () => {
    if(!chatInput.trim()) return;
    setChatMsgs(p=>[...p,{id:p.length+1,sender:'recruiter',message:chatInput,
      time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}]);
    setChatInput('');
  };

  const curJob     = jobs[activeTab]||null;
  const curJobId   = curJob?._id;
  const roleColor  = ROLE_COLORS[activeTab % ROLE_COLORS.length];
  // ✅ FIX: normalize job skills properly
  const jobSkills  = (curJob?.requiredSkills||[]).map(normSkill).filter(Boolean);

  const filtered = useMemo(() => {
    if (!curJobId) return [];
    const apps = Array.isArray(allApps[curJobId]) ? allApps[curJobId] : [];
    return apps
      .filter(app => {
        const a = app.applicantId || {};
        const name = a.username || a.name || '';
        const email = a.email || '';
        const skills = a.skills || [];
        const srch = !searchTerm ||
          name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          skills.some(s => normSkill(s).includes(searchTerm.toLowerCase()));
       return srch && (statusFilter==='all' || app.status===statusFilter) && app._pct >= matchFilter;
      })
      .map(app => ({...app, _pct: calcMatch(app.applicantId?.skills, jobSkills)}))
      .sort((a,b) => b._pct - a._pct);
  }, [curJobId, allApps, searchTerm, statusFilter, jobSkills]);

  const allList   = Object.values(allApps).flatMap(v => Array.isArray(v) ? v : []);
  const detailJob = selectedApp ? jobs.find(j=>j._id===(selectedApp.jobId?._id||selectedApp.jobId||selectedApp.job?._id||selectedApp.job)) : null;
  const djSkills  = (detailJob?.requiredSkills||[]).map(normSkill).filter(Boolean);
  const detailPct = selectedApp ? calcMatch(selectedApp.applicantId?.skills, djSkills) : 0;
  const dmc       = MATCH_CFG(detailPct);

  const countForStatus = (key) => {
    const apps = Array.isArray(allApps[curJobId]) ? allApps[curJobId] : [];
    return apps.filter(a => a.status === key).length;
  };

  const inputStyle = {
    '& .MuiOutlinedInput-root':{borderRadius:'10px',backgroundColor:'#f8fafc',color:'#0f172a',
      '& fieldset':{borderColor:'#e2e8f0'},
      '&:hover fieldset':{borderColor:'#c7d2fe'},
      '&.Mui-focused fieldset':{borderColor:'#6366f1',borderWidth:1.5},
    },
    '& .MuiInputLabel-root':{color:'#64748b'},
    '& .MuiInputLabel-root.Mui-focused':{color:'#6366f1'},
    '& input::placeholder':{color:'#94a3b8'},
    '& textarea::placeholder':{color:'#94a3b8'},
  };

  return (
    <Box sx={{height:'100vh',display:'flex',flexDirection:'column',
      background:'linear-gradient(150deg,#f0f4ff 0%,#f8faff 60%,#fdf4ff 100%)',overflow:'hidden'}}>

      {/* ── HEADER ── */}
      <Box sx={{flexShrink:0,
        background:'linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#0891b2 100%)',
        px:3,pt:2.5,pb:0,
        boxShadow:'0 4px 32px rgba(79,70,229,0.3)',
        position:'relative',overflow:'hidden',
        '&::before':{content:'""',position:'absolute',inset:0,
          background:'radial-gradient(ellipse 50% 90% at 85% 50%,rgba(255,255,255,0.12) 0%,transparent 70%)',
          pointerEvents:'none'},
      }}>
        {/* Title row */}
        <Box sx={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',mb:2}}>
          <Box>
            <Typography sx={{fontWeight:900,fontSize:'1.35rem',color:'#fff',letterSpacing:'-0.02em',mb:0.3}}>
              Application Pipeline
            </Typography>
            <Typography sx={{fontSize:'0.7rem',color:'rgba(255,255,255,0.8)',letterSpacing:'0.04em'}}>
              Candidates ranked by skill match · Role-wise view
            </Typography>
          </Box>
          <Box sx={{display:'flex',gap:1}}>
            {[
              {label:'Total',      val:allList.length,                                        icon:'📋', bg:'rgba(255,255,255,0.2)'},
              {label:'Pending',    val:allList.filter(a=>a.status==='pending').length,        icon:'⏳', bg:'rgba(251,191,36,0.3)'},
              {label:'Shortlisted',val:allList.filter(a=>a.status==='shortlisted').length,   icon:'⭐', bg:'rgba(196,181,253,0.35)'},
              {label:'Accepted',   val:allList.filter(a=>a.status==='accepted').length,      icon:'✅', bg:'rgba(110,231,183,0.35)'},
              {label:'Roles',      val:jobs.length,                                           icon:'💼', bg:'rgba(255,255,255,0.2)'},
            ].map(s=>(
              <Box key={s.label} sx={{textAlign:'center',px:1.3,py:0.9,
                backgroundColor:s.bg,backdropFilter:'blur(10px)',
                borderRadius:'14px',border:'1px solid rgba(255,255,255,0.35)',
                transition:'transform 0.15s','&:hover':{transform:'translateY(-2px)'}}}>
                <Typography sx={{fontSize:'0.7rem',mb:0.2}}>{s.icon}</Typography>
                <Typography sx={{fontSize:'1.1rem',fontWeight:900,color:'#fff',lineHeight:1.1,
                  textShadow:'0 1px 4px rgba(0,0,0,0.2)'}}>{s.val}</Typography>
                <Typography sx={{fontSize:'0.54rem',color:'rgba(255,255,255,0.85)',textTransform:'uppercase',
                  letterSpacing:'0.05em',mt:0.2}}>{s.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Search + filter */}
        <Box sx={{display:'flex',gap:1,mb:1.5,alignItems:'center',flexWrap:'wrap'}}>
          <TextField placeholder="Search by name, email, or skill..." value={searchTerm}
            onChange={e=>setSearchTerm(e.target.value)} size="small"
            InputProps={{
              startAdornment:<InputAdornment position="start"><Search sx={{fontSize:15,color:'rgba(255,255,255,0.7)'}}/></InputAdornment>,
              endAdornment:searchTerm&&<InputAdornment position="end"><IconButton size="small" onClick={()=>setSearchTerm('')}><Close sx={{fontSize:13,color:'rgba(255,255,255,0.7)'}}/></IconButton></InputAdornment>,
            }}
            sx={{flex:1,maxWidth:340,
              '& .MuiOutlinedInput-root':{backgroundColor:'rgba(255,255,255,0.18)',backdropFilter:'blur(10px)',
                borderRadius:'10px',color:'#fff',fontSize:'0.8rem',
                '& fieldset':{borderColor:'rgba(255,255,255,0.35)'},
                '&:hover fieldset':{borderColor:'rgba(255,255,255,0.65)'},
                '&.Mui-focused fieldset':{borderColor:'#fff',borderWidth:1.5}},
              '& input::placeholder':{color:'rgba(255,255,255,0.65)'}}}/>
{/* Match % filter */}
<select value={matchFilter} onChange={e => setMatchFilter(Number(e.target.value))}
  style={{
    background: 'rgba(255,255,255,0.18)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: 8,
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '6px 10px',
    cursor: 'pointer',
    outline: 'none',
    flexShrink: 0,
  }}>
  <option value={0}  style={{color:'#0f172a',background:'#fff'}}>🎯 All Match</option>
  <option value={90} style={{color:'#0f172a',background:'#fff'}}>🏆 Top 2% (90%+)</option>
  <option value={80} style={{color:'#0f172a',background:'#fff'}}>⭐ Top 5% (80%+)</option>
  <option value={70} style={{color:'#0f172a',background:'#fff'}}>✅ Top 10% (70%+)</option>
  <option value={50} style={{color:'#0f172a',background:'#fff'}}>📊 50%+</option>
</select>

{/* Status filter pills */}
<Box sx={{display:'flex',gap:0.5,flexWrap:'nowrap',overflow:'auto'}}></Box>
          {/* Status filter pills */}
          <Box sx={{display:'flex',gap:0.5,flexWrap:'nowrap',overflow:'auto'}}>
            {[{key:'all',label:'All'},...Object.entries(STATUS_CFG).map(([k,v])=>({key:k,label:v.label}))].map(s=>(
              <Button key={s.key} size="small" onClick={()=>setStatusFilter(s.key)}
                sx={{textTransform:'none',fontSize:'0.65rem',fontWeight:700,
                  borderRadius:'8px',px:1.2,py:0.5,minWidth:0,transition:'all 0.18s',
                  ...(statusFilter===s.key
                    ?{backgroundColor:'rgba(255,255,255,0.28)',color:'#fff',border:'1.5px solid rgba(255,255,255,0.55)',boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}
                    :{backgroundColor:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.75)',border:'1px solid rgba(255,255,255,0.2)',
                      '&:hover':{backgroundColor:'rgba(255,255,255,0.18)',color:'#fff'}})}}>
                {s.label}
                <Typography component="span" sx={{ml:0.4,fontSize:'0.58rem',opacity:0.85}}>
                  {s.key==='all' ? allList.length : countForStatus(s.key)}
                </Typography>
              </Button>
            ))}
          </Box>
        </Box>

        {/* Role Tabs */}
        <Tabs value={activeTab} onChange={(_,v)=>setActiveTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{'& .MuiTabs-indicator':{backgroundColor:'#fff',height:3,borderRadius:'3px 3px 0 0'},
            '& .MuiTab-root':{color:'rgba(255,255,255,0.65)',fontWeight:700,fontSize:'0.75rem',
              textTransform:'none',minHeight:42,px:2,transition:'color 0.2s','&.Mui-selected':{color:'#fff'}}}}>
          {jobs.map((job)=>(
            <Tab key={job._id} label={
              <Box sx={{display:'flex',alignItems:'center',gap:0.8}}>
                <Box sx={{width:7,height:7,borderRadius:'50%',backgroundColor:'rgba(255,255,255,0.75)'}}/>
                <Typography sx={{fontSize:'0.75rem',fontWeight:700}}>{job.title}</Typography>
                <Box sx={{px:0.7,py:0.1,borderRadius:'20px',backgroundColor:'rgba(255,255,255,0.2)'}}>
                  <Typography sx={{fontSize:'0.6rem',color:'#fff',fontWeight:700}}>
                    {Array.isArray(allApps[job._id]) ? allApps[job._id].length : 0}
                  </Typography>
                </Box>
              </Box>}/>
          ))}
        </Tabs>
      </Box>

      {/* ── BODY ── */}
      <Box sx={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {loading ? (
          <Box sx={{display:'flex',justifyContent:'center',alignItems:'center',height:'100%',flexDirection:'column',gap:2}}>
            <CircularProgress sx={{color:'#6366f1'}}/>
            <Typography sx={{color:'#64748b',fontSize:'0.8rem',fontWeight:600}}>Loading candidates...</Typography>
          </Box>
        ) : jobs.length===0 ? (
          <Box sx={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',flexDirection:'column',gap:1.5}}>
            <Work sx={{fontSize:52,color:'#e2e8f0'}}/>
            <Typography sx={{fontWeight:700,color:'#94a3b8',fontSize:'1rem'}}>No jobs posted yet</Typography>
            <Typography sx={{color:'#cbd5e1',fontSize:'0.78rem'}}>Post a job to receive applications</Typography>
          </Box>
        ) : (
          <Box sx={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',p:2}}>
            {/* Role bar */}
            {curJob && (
              <Box sx={{display:'flex',alignItems:'center',gap:2,mb:1.5,
                backgroundColor:'#fff',borderRadius:'14px',border:'1.5px solid #e2e8f0',
                p:'10px 16px',boxShadow:'0 2px 12px rgba(79,70,229,0.08)'}}>
                <Box sx={{width:38,height:38,borderRadius:'10px',background:roleColor.grad,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  boxShadow:`0 4px 12px ${roleColor.accent}44`,flexShrink:0}}>
                  <Work sx={{color:'#fff',fontSize:18}}/>
                </Box>
                <Box sx={{flex:1}}>
                  <Typography sx={{fontWeight:800,fontSize:'0.9rem',color:'#0f172a'}}>{curJob.title}</Typography>
                  <Typography sx={{fontSize:'0.67rem',color:'#64748b'}}>{curJob.company} · {curJob.location}</Typography>
                </Box>
                <Box sx={{display:'flex',gap:0.5,flexWrap:'wrap',maxWidth:360}}>
                  {jobSkills.slice(0,5).map((sk,i)=>(
                    <Box key={i} sx={{px:'8px',py:'3px',borderRadius:'7px',fontSize:'0.6rem',fontWeight:600,
                      backgroundColor:roleColor.light,color:roleColor.accent,border:`1px solid ${roleColor.mid}`}}>
                      {sk}
                    </Box>
                  ))}
                  {jobSkills.length>5 && <Box sx={{px:'8px',py:'3px',borderRadius:'7px',fontSize:'0.6rem',backgroundColor:'#f1f5f9',color:'#64748b'}}>+{jobSkills.length-5}</Box>}
                </Box>
                <Box sx={{display:'flex',gap:0.8,flexShrink:0}}>
                  {[
                    {l:'Total',v:filtered.length,c:'#4f46e5'},
                    {l:'Top',v:`${filtered[0]?._pct||0}%`,c:MATCH_CFG(filtered[0]?._pct||0).color},
                    {l:'Avg',v:`${filtered.length?Math.round(filtered.reduce((s,a)=>s+a._pct,0)/filtered.length):0}%`,c:'#0284c7'},
                  ].map(s=>(
                    <Box key={s.l} sx={{textAlign:'center',px:1.2,py:0.6,
                      backgroundColor:alpha(s.c,0.07),borderRadius:'9px',border:`1px solid ${alpha(s.c,0.18)}`}}>
                      <Typography sx={{fontSize:'0.88rem',fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</Typography>
                      <Typography sx={{fontSize:'0.52rem',color:'#94a3b8',mt:0.1,textTransform:'uppercase',letterSpacing:'0.06em'}}>{s.l}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Candidate list */}
            <Box sx={{flex:1,overflow:'auto',pr:0.5,
              '&::-webkit-scrollbar':{width:5},
              '&::-webkit-scrollbar-track':{backgroundColor:'transparent'},
              '&::-webkit-scrollbar-thumb':{backgroundColor:'#e2e8f0',borderRadius:99}}}>
              {filtered.length===0 ? (
                <Box sx={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:200,gap:1}}>
                  <Person sx={{fontSize:40,color:'#e2e8f0'}}/>
                  <Typography sx={{color:'#94a3b8',fontSize:'0.85rem',fontWeight:600}}>No candidates found</Typography>
                  <Typography sx={{color:'#cbd5e1',fontSize:'0.72rem'}}>
                    {(Array.isArray(allApps[curJobId]) ? allApps[curJobId] : []).length===0
                      ? 'No applications yet for this role'
                      : 'Try adjusting filters'}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{display:'flex',flexDirection:'column',gap:0.8}}>
                  {filtered.map((app,idx)=>(
                    <CandidateCard key={app._id} app={app} jobSkills={jobSkills} rank={idx+1}
                      roleColor={roleColor} isFav={favorites.has(app._id)} onFav={handleFav}
                      onView={a=>{
                        setSelectedApp(a);
                        setDetailsOpen(true);
                        setAiReport(null);
                        // Fetch AI interview report if exists
                        const appId = a._id || a.id;
                        if (appId) {
                          setAiReportLoading(true);
                          const token = localStorage.getItem('token');
                          const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
                          fetch(`${API}/interview/report/${appId}`, {
                            headers: { Authorization: `Bearer ${token}` }
                          })
                          .then(r => r.ok ? r.json() : null)
                          .then(d => { if (d?.report) setAiReport(d.report); })
                          .catch(() => {})
                          .finally(() => setAiReportLoading(false));
                        }
                      }}
                      onStatus={handleStatus} statusLoading={updStatus && updId===app._id}/>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* ══ DETAIL MODAL ══ */}
      <Dialog open={detailsOpen} onClose={()=>setDetailsOpen(false)} maxWidth="md" fullWidth
        PaperProps={{sx:{borderRadius:'20px',overflow:'hidden',background:'#fff',
          border:'1px solid #e2e8f0',boxShadow:'0 32px 80px rgba(79,70,229,0.18)'}}}>
        {selectedApp&&(()=>{
          const ap = selectedApp.applicantId || {};
          const apName = ap.username || ap.name || 'Unknown';
          const req = djSkills;
          const has = (ap.skills||[]).map(normSkill);
          const matched = req.filter(r=>has.some(h=>h.includes(r)||r.includes(h)));
          return (
            <>
              <Box sx={{background:`linear-gradient(135deg,${dmc.color}12 0%,transparent 100%)`,
                borderBottom:`1.5px solid ${dmc.border}`,p:2.5,position:'relative'}}>
                <IconButton size="small" onClick={()=>setDetailsOpen(false)}
                  sx={{position:'absolute',top:12,right:12,backgroundColor:'#f1f5f9',color:'#64748b',
                    border:'1px solid #e2e8f0','&:hover':{backgroundColor:'#e2e8f0'}}}>
                  <Close sx={{fontSize:16}}/>
                </IconButton>
                <Box sx={{display:'flex',alignItems:'center',gap:2}}>
                  <Avatar sx={{width:58,height:58,fontSize:'1.1rem',fontWeight:900,color:'#fff',
                    backgroundColor:getAvColor(apName),
                    border:`3px solid ${getAvColor(apName)}44`,boxShadow:`0 4px 16px ${getAvColor(apName)}44`}}>
                    {getInitials(apName)}
                  </Avatar>
                  <Box sx={{flex:1}}>
                    <Typography sx={{fontWeight:900,fontSize:'1.1rem',color:'#0f172a',lineHeight:1}}>
                      {apName}
                    </Typography>
                    <Typography sx={{fontSize:'0.72rem',color:'#475569',mt:0.3}}>
                      {ap.careerGoals?.currentRole||ap.currentRole||'Role not specified'}
                      {ap.currentCompany&&` · ${ap.currentCompany}`}
                    </Typography>
                    <Typography sx={{fontSize:'0.65rem',color:'#94a3b8',mt:0.2}}>{ap.email}</Typography>
                    <Box sx={{mt:0.8,display:'flex',gap:0.8,alignItems:'center',flexWrap:'wrap'}}>
                      <StatusBadge status={selectedApp.status} size="lg"/>
                      <Typography sx={{fontSize:'0.62rem',color:'#94a3b8'}}>📅 Applied {fmtDate(selectedApp.appliedAt)}</Typography>
                      {detailJob&&<Typography sx={{fontSize:'0.62rem',color:'#94a3b8'}}>💼 {detailJob.title}</Typography>}
                    </Box>
                  </Box>
                  <MatchRing pct={detailPct} size={76}/>
                </Box>

                {/* Status update */}
                <Box sx={{mt:2,p:1.5,borderRadius:'12px',background:'#f8fafc',border:'1.5px solid #e2e8f0'}}>
                  <Box sx={{display:'flex',alignItems:'center',justifyContent:'space-between',mb:0.8}}>
                    <Typography sx={{fontSize:'0.6rem',color:'#64748b',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em'}}>
                      Update Application Status
                    </Typography>
                    {updStatus&&updId===selectedApp._id&&(
                      <Box sx={{display:'flex',alignItems:'center',gap:0.6}}>
                        <CircularProgress size={10} sx={{color:'#6366f1'}}/>
                        <Typography sx={{fontSize:'0.58rem',color:'#6366f1',fontWeight:600}}>Saving...</Typography>
                      </Box>
                    )}
                  </Box>
                  <StatusBar current={selectedApp.status} onUpdate={s=>handleStatus(selectedApp,s)}
                    loading={updStatus&&updId===selectedApp._id}/>
                </Box>
              </Box>

              <DialogContent sx={{p:0,overflow:'hidden',display:'flex',height:'52vh'}}>
                {/* Left */}
                <Box sx={{flex:1,overflow:'auto',p:2.5,
                  '&::-webkit-scrollbar':{width:4},
                  '&::-webkit-scrollbar-thumb':{backgroundColor:'#e2e8f0',borderRadius:99}}}>

                  {/* Skill match */}
                  <Box sx={{backgroundColor:`${dmc.color}09`,border:`1.5px solid ${dmc.border}`,borderRadius:'14px',p:2,mb:2}}>
                    <Box sx={{display:'flex',alignItems:'center',justifyContent:'space-between',mb:1.2}}>
                      <Box sx={{display:'flex',alignItems:'center',gap:0.8}}>
                        <Psychology sx={{color:dmc.color,fontSize:18}}/>
                        <Typography sx={{fontWeight:800,fontSize:'0.85rem',color:'#0f172a'}}>Skill Match</Typography>
                      </Box>
                      <Typography sx={{fontSize:'0.7rem',fontWeight:700,color:dmc.color}}>{matched.length}/{req.length} matched</Typography>
                    </Box>
                    <Box sx={{height:7,borderRadius:99,mb:1.5,backgroundColor:'#e2e8f0',overflow:'hidden'}}>
                      <Box sx={{height:'100%',borderRadius:99,width:`${detailPct}%`,
                        background:`linear-gradient(90deg,${dmc.color},${dmc.color}99)`,
                        boxShadow:`0 0 8px ${dmc.glow}`,transition:'width 1s ease'}}/>
                    </Box>
                    <Box sx={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0.6}}>
                      {req.map((sk,i)=>{
                        const m=has.some(h=>h.includes(sk)||sk.includes(h));
                        return (
                          <Box key={i} sx={{display:'flex',alignItems:'center',gap:0.7,
                            px:1,py:0.5,borderRadius:'8px',
                            backgroundColor:m?'#d1fae5':'#f8fafc',
                            border:`1px solid ${m?'#6ee7b7':'#e2e8f0'}`}}>
                            {m?<CheckCircle sx={{fontSize:13,color:'#059669',flexShrink:0}}/>
                              :<Cancel sx={{fontSize:13,color:'#cbd5e1',flexShrink:0}}/>}
                            <Typography sx={{fontSize:'0.63rem',fontWeight:m?700:400,
                              color:m?'#065f46':'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {sk}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>

                  {/* Info grid */}
                  <Box sx={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,mb:2}}>
                    {[
                      {icon:'👤',label:'Full Name',val:apName},
                      {icon:'📧',label:'Email',val:ap.email||'—'},
                      {icon:'💼',label:'Current Role',val:ap.careerGoals?.currentRole||ap.currentRole||'—'},
                      {icon:'🏢',label:'Company',val:ap.currentCompany||'—'},
                      {icon:'🎯',label:'Target Role',val:ap.careerGoals?.targetRole||'—'},
                      {icon:'📅',label:'Applied',val:fmtDate(selectedApp.appliedAt)},
                    ].map(f=>(
                      <Box key={f.label} sx={{backgroundColor:'#f8fafc',borderRadius:'10px',p:1.2,border:'1px solid #e2e8f0'}}>
                        <Typography sx={{fontSize:'0.55rem',color:'#94a3b8',textTransform:'uppercase',letterSpacing:0.6,mb:0.3}}>
                          {f.icon} {f.label}
                        </Typography>
                        <Typography sx={{fontSize:'0.72rem',color:'#0f172a',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {f.val}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {ap.experience?.length>0&&(
                    <Box sx={{mb:2}}>
                      <Typography sx={{fontWeight:800,fontSize:'0.82rem',color:'#0f172a',mb:1,display:'flex',alignItems:'center',gap:0.6}}>
                        <Business sx={{fontSize:16,color:'#6366f1'}}/> Experience
                      </Typography>
                      {ap.experience.map((e,i)=>(
                        <Box key={i} sx={{backgroundColor:'#f8fafc',borderRadius:'10px',p:1.2,mb:0.7,
                          border:'1px solid #e2e8f0',borderLeft:'3px solid #6366f1'}}>
                          <Typography sx={{fontWeight:700,fontSize:'0.78rem',color:'#0f172a'}}>
                            {e.title}{e.company&&` · ${e.company}`}
                          </Typography>
                          <Typography sx={{fontSize:'0.62rem',color:'#64748b',mt:0.2}}>
                            {fmtDate(e.startDate)} – {e.endDate?fmtDate(e.endDate):'Present'}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {selectedApp.coverLetter&&(
                    <Box>
                      <Typography sx={{fontWeight:800,fontSize:'0.82rem',color:'#0f172a',mb:1}}>📝 Cover Letter</Typography>
                      <Box sx={{backgroundColor:'#f8fafc',borderRadius:'10px',p:1.5,border:'1px solid #e2e8f0'}}>
                        <Typography sx={{fontSize:'0.73rem',color:'#475569',lineHeight:1.7}}>{selectedApp.coverLetter}</Typography>
                      </Box>
                    </Box>
                  )}

                  {/* ── AI Interview Report Card ── */}
                  {aiReportLoading && (
                    <Box sx={{mt:2,p:2,borderRadius:'12px',background:'#f8fafc',border:'1px solid #e2e8f0',textAlign:'center'}}>
                      <CircularProgress size={18} sx={{color:'#7c3aed'}}/><Typography sx={{fontSize:'0.72rem',color:'#94a3b8',mt:0.8}}>Loading interview report...</Typography>
                    </Box>
                  )}
                  {!aiReportLoading && aiReport && (
                    <Box sx={{mt:2,p:0,borderRadius:'14px',border:'1.5px solid rgba(124,77,255,0.3)',overflow:'hidden',background:'#fff'}}>
                      {/* Report header */}
                      <Box sx={{background:'linear-gradient(135deg,rgba(124,77,255,0.1),rgba(108,99,255,0.05))',px:2,py:1.5,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <Box sx={{display:'flex',alignItems:'center',gap:1}}>
                          <SmartToy sx={{fontSize:16,color:'#7c3aed'}}/>
                          <Typography sx={{fontWeight:800,fontSize:'0.75rem',color:'#4c1d95'}}>AI Interview Report</Typography>
                        </Box>
                        <Box sx={{display:'flex',alignItems:'center',gap:0.8,px:1.2,py:0.4,borderRadius:'20px',
                          background: aiReport.recommendation==='Strong Hire'?'rgba(16,185,129,0.12)':aiReport.recommendation==='Hire'?'rgba(59,130,246,0.12)':aiReport.recommendation==='Maybe'?'rgba(245,158,11,0.12)':'rgba(239,68,68,0.12)',
                          border:`1px solid ${aiReport.recommendation==='Strong Hire'?'rgba(16,185,129,0.4)':aiReport.recommendation==='Hire'?'rgba(59,130,246,0.4)':aiReport.recommendation==='Maybe'?'rgba(245,158,11,0.4)':'rgba(239,68,68,0.4)'}`}}>
                          <Typography sx={{fontSize:'0.65rem',fontWeight:800,
                            color:aiReport.recommendation==='Strong Hire'?'#065f46':aiReport.recommendation==='Hire'?'#1e40af':aiReport.recommendation==='Maybe'?'#92400e':'#991b1b'}}>
                            {aiReport.recommendation==='Strong Hire'?'🏆':aiReport.recommendation==='Hire'?'✅':aiReport.recommendation==='Maybe'?'🤔':'❌'} {aiReport.recommendation}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{px:2,py:1.5}}>
                        {/* Overall score */}
                        <Box sx={{display:'flex',alignItems:'center',justifyContent:'space-between',mb:1.5}}>
                          <Typography sx={{fontSize:'0.72rem',color:'#64748b',fontWeight:600}}>Overall Score</Typography>
                          <Box sx={{display:'flex',alignItems:'center',gap:1}}>
                            <Box sx={{width:80,height:6,borderRadius:3,background:'#e2e8f0',overflow:'hidden'}}>
                              <Box sx={{width:`${aiReport.overallScore}%`,height:'100%',borderRadius:3,
                                background:aiReport.overallScore>=70?'linear-gradient(90deg,#10b981,#059669)':aiReport.overallScore>=50?'linear-gradient(90deg,#f59e0b,#d97706)':'linear-gradient(90deg,#ef4444,#dc2626)',transition:'width 1s ease'}}/>
                            </Box>
                            <Typography sx={{fontWeight:800,fontSize:'0.8rem',color:'#0f172a',minWidth:36}}>{aiReport.overallScore}/100</Typography>
                          </Box>
                        </Box>

                        {/* 4 sub-scores compact */}
                        {[
                          ['Communication', aiReport.communicationScore, '#6366f1'],
                          ['Technical',     aiReport.technicalScore,     '#8b5cf6'],
                          ['Confidence',    aiReport.confidenceScore,    '#f59e0b'],
                          ['Problem Solving',aiReport.problemSolvingScore,'#10b981'],
                        ].map(([label, val, color]) => (
                          <Box key={label} sx={{display:'flex',alignItems:'center',justifyContent:'space-between',mb:0.8}}>
                            <Typography sx={{fontSize:'0.68rem',color:'#94a3b8',fontWeight:500,width:90}}>{label}</Typography>
                            <Box sx={{display:'flex',alignItems:'center',gap:1,flex:1,justifyContent:'flex-end'}}>
                              <Box sx={{width:60,height:4,borderRadius:2,background:'#f1f5f9',overflow:'hidden'}}>
                                <Box sx={{width:`${val||0}%`,height:'100%',borderRadius:2,background:color,transition:'width 1s ease'}}/>
                              </Box>
                              <Typography sx={{fontSize:'0.68rem',fontWeight:700,color:'#475569',minWidth:28,textAlign:'right'}}>{val||0}</Typography>
                            </Box>
                          </Box>
                        ))}

                        {/* Summary */}
                        {aiReport.summary && (
                          <Box sx={{mt:1.5,pt:1.5,borderTop:'1px solid #f1f5f9'}}>
                            <Typography sx={{fontSize:'0.68rem',color:'#64748b',lineHeight:1.6}}>{aiReport.summary}</Typography>
                          </Box>
                        )}

                        {/* Hiring justification */}
                        {aiReport.hiringJustification && (
                          <Box sx={{mt:1,p:1,borderRadius:'8px',background:'rgba(124,77,255,0.05)',border:'1px solid rgba(124,77,255,0.15)'}}>
                            <Typography sx={{fontSize:'0.65rem',color:'#4c1d95',fontWeight:700,mb:0.3}}>⚖️ Justification</Typography>
                            <Typography sx={{fontSize:'0.67rem',color:'#64748b',lineHeight:1.5}}>{aiReport.hiringJustification}</Typography>
                          </Box>
                        )}

                        {/* Strengths & improvements */}
                        {(aiReport.strengths||[]).length > 0 && (
                          <Box sx={{mt:1.2}}>
                            <Typography sx={{fontSize:'0.68rem',fontWeight:700,color:'#10b981',mb:0.5}}>💪 Strengths</Typography>
                            {aiReport.strengths.slice(0,3).map((s,i)=>(
                              <Typography key={i} sx={{fontSize:'0.67rem',color:'#475569',lineHeight:1.5,mb:0.3}}>• {s}</Typography>
                            ))}
                          </Box>
                        )}
                        {(aiReport.improvements||[]).length > 0 && (
                          <Box sx={{mt:1}}>
                            <Typography sx={{fontSize:'0.68rem',fontWeight:700,color:'#f59e0b',mb:0.5}}>🎯 Areas to Improve</Typography>
                            {aiReport.improvements.slice(0,2).map((s,i)=>(
                              <Typography key={i} sx={{fontSize:'0.67rem',color:'#475569',lineHeight:1.5,mb:0.3}}>• {s}</Typography>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}
                  {!aiReportLoading && !aiReport && (
                    <Box sx={{mt:2,p:1.5,borderRadius:'12px',background:'#f8fafc',border:'1px dashed #e2e8f0',textAlign:'center'}}>
                      <Typography sx={{fontSize:'0.68rem',color:'#94a3b8'}}>🤖 No AI interview report yet</Typography>
                      <Typography sx={{fontSize:'0.63rem',color:'#cbd5e1',mt:0.3}}>Schedule AI interview to get analysis</Typography>
                    </Box>
                  )}
                </Box>

                {/* Right actions — only Send Email + Favourite */}
                <Box sx={{width:196,flexShrink:0,borderLeft:'1.5px solid #f1f5f9',
                  background:'linear-gradient(to bottom,#f8fafc,#fff)',p:2,
                  display:'flex',flexDirection:'column',gap:0.9}}>
                  <Typography sx={{fontWeight:800,fontSize:'0.7rem',color:'#94a3b8',mb:0.3,textTransform:'uppercase',letterSpacing:'0.1em'}}>
                    Actions
                  </Typography>
                  {[
                    {icon:<Email sx={{fontSize:14}}/>, label:'Send Email', color:'#1d4ed8', action:()=>handleEmail(selectedApp)},
                    {icon:favorites.has(selectedApp._id)?<Star sx={{fontSize:14}}/>:<StarBorder sx={{fontSize:14}}/>,
                     label:favorites.has(selectedApp._id)?'Unfavourite':'Favourite', color:'#b45309', action:()=>handleFav(selectedApp._id)},
                  ].map((a,i)=>(
                    <Button key={i} fullWidth size="small" onClick={a.action}
                      startIcon={a.icon}
                      sx={{justifyContent:'flex-start',textTransform:'none',fontWeight:600,
                        fontSize:'0.7rem',borderRadius:'10px',py:0.8,
                        color:a.color,backgroundColor:alpha(a.color,0.07),
                        border:`1px solid ${alpha(a.color,0.2)}`,transition:'all 0.18s',
                        '&:hover':{backgroundColor:alpha(a.color,0.14),borderColor:alpha(a.color,0.4),
                          boxShadow:`0 2px 10px ${alpha(a.color,0.15)}`}}}>
                      {a.label}
                    </Button>
                  ))}

                  {/* Info box about AI Interview */}
                  <Box sx={{mt:1.5,p:1.2,borderRadius:'10px',background:'rgba(124,77,255,0.06)',border:'1px dashed rgba(124,77,255,0.3)'}}>
                    <Typography sx={{fontSize:'0.62rem',color:'#7c3aed',fontWeight:700,mb:0.4,display:'flex',alignItems:'center',gap:0.4}}>
                      🤖 AI Interview
                    </Typography>
                    <Typography sx={{fontSize:'0.6rem',color:'#94a3b8',lineHeight:1.6}}>
                      Candidate takes AI interview from their own profile under <strong style={{color:'#7c3aed'}}>My Applications → Take AI Interview</strong>
                    </Typography>
                  </Box>
                </Box>
              </DialogContent>
            </>
          );
        })()}
      </Dialog>

      {/* ══ SCHEDULE ══ */}
      <Dialog open={scheduleOpen} onClose={()=>setScheduleOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{sx:{borderRadius:'16px',background:'#fff',border:'1px solid #e2e8f0',boxShadow:'0 24px 64px rgba(79,70,229,0.15)'}}}>
        <DialogTitle sx={{fontWeight:800,fontSize:'0.95rem',color:'#0f172a',
          borderBottom:'1.5px solid #f1f5f9',display:'flex',alignItems:'center',gap:1}}>
          <Schedule sx={{color:'#7c3aed',fontSize:20}}/> Schedule Interview
          {selectedApp?.applicantId?.username&&<Typography sx={{fontSize:'0.72rem',color:'#94a3b8',ml:0.5}}>— {selectedApp.applicantId.username}</Typography>}
          <IconButton size="small" onClick={()=>setScheduleOpen(false)} sx={{ml:'auto',color:'#94a3b8'}}><Close sx={{fontSize:16}}/></IconButton>
        </DialogTitle>
        <DialogContent sx={{p:2.5}}>

          <TextField fullWidth label="Interview Type" select size="small"
            value={schedType} onChange={e=>setSchedType(e.target.value)}
            sx={{mb:1.5,...inputStyle}} SelectProps={{native:true}}>
            <option value="video">📹 Video Call</option>
            <option value="phone">📞 Phone Call</option>
            <option value="in-person">🏢 In Person</option>
            <option value="technical">💻 Technical Round</option>
          </TextField>

          <TextField fullWidth label="Scheduled Date & Time" type="datetime-local" size="small"
            InputLabelProps={{shrink:true}} value={schedDateTime}
            onChange={e=>setSchedDateTime(e.target.value)} sx={{mb:1.5,...inputStyle}}/>

          <TextField fullWidth label="Meeting Link / Address" placeholder="Zoom, Google Meet or office address"
            size="small" value={schedLink} onChange={e=>setSchedLink(e.target.value)}
            sx={{mb:1.5,...inputStyle}}/>

          <TextField fullWidth label="Notes to Candidate" multiline rows={2}
            placeholder="Topics to cover, what to prepare..."
            size="small" value={schedNotes} onChange={e=>setSchedNotes(e.target.value)}
            sx={{...inputStyle}}/>

          {/* Info: AI Interview is taken by candidate from their profile */}
          <Box sx={{mt:2,p:1.5,borderRadius:'10px',background:'rgba(99,102,241,0.05)',border:'1px solid rgba(99,102,241,0.2)'}}>
            <Typography sx={{fontSize:'0.68rem',color:'#6366f1',fontWeight:600,display:'flex',alignItems:'center',gap:0.5}}>
              🤖 AI Interview? The candidate takes it directly from their profile under <strong>My Applications → Take AI Interview</strong>.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{px:2.5,pb:2,gap:1,borderTop:'1.5px solid #f1f5f9'}}>
          <Button onClick={()=>setScheduleOpen(false)} sx={{textTransform:'none',color:'#64748b',fontSize:'0.78rem'}}>Cancel</Button>
          <Button variant="contained" onClick={handleSchedule} disabled={schedLoading}
            sx={{textTransform:'none',fontWeight:700,fontSize:'0.78rem',borderRadius:'10px',
              background:'linear-gradient(135deg,#6d28d9,#7c3aed)',
              boxShadow:'0 4px 14px rgba(109,40,217,0.3)',
              '&:hover':{background:'linear-gradient(135deg,#5b21b6,#6d28d9)'}}}>
            {schedLoading
              ? <CircularProgress size={14} sx={{color:'#fff'}}/>
              : '📅 Schedule & Shortlist'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══ CHAT ══ */}
      <Dialog open={chatOpen} onClose={()=>setChatOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{sx:{borderRadius:'16px',background:'#fff',border:'1px solid #e2e8f0',
          boxShadow:'0 24px 64px rgba(79,70,229,0.15)',height:'60vh',display:'flex',flexDirection:'column'}}}>
        <DialogTitle sx={{borderBottom:'1.5px solid #f1f5f9',py:1.5,display:'flex',alignItems:'center',gap:1.2}}>
          <Avatar sx={{width:32,height:32,fontSize:'0.7rem',fontWeight:800,color:'#fff',
            backgroundColor:getAvColor(selectedApp?.applicantId?.username||'')}}>
            {getInitials(selectedApp?.applicantId?.username||'?')}
          </Avatar>
          <Box sx={{flex:1}}>
            <Typography sx={{fontWeight:700,fontSize:'0.8rem',color:'#0f172a'}}>{selectedApp?.applicantId?.username||'Candidate'}</Typography>
            <Box sx={{display:'flex',alignItems:'center',gap:0.4}}>
              <Box sx={{width:6,height:6,borderRadius:'50%',backgroundColor:'#10b981',boxShadow:'0 0 5px #10b981'}}/>
              <Typography sx={{fontSize:'0.58rem',color:'#059669',fontWeight:600}}>Online</Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={()=>setChatOpen(false)} sx={{color:'#94a3b8'}}><Close sx={{fontSize:15}}/></IconButton>
        </DialogTitle>
        <DialogContent sx={{flex:1,overflow:'hidden',p:0,display:'flex',flexDirection:'column'}}>
          <Box sx={{flex:1,overflowY:'auto',p:1.5,display:'flex',flexDirection:'column',gap:1,
            background:'#f8fafc',
            '&::-webkit-scrollbar':{width:3},
            '&::-webkit-scrollbar-thumb':{backgroundColor:'#e2e8f0',borderRadius:99}}}>
            {chatMsgs.map(msg=>(
              <Box key={msg.id} sx={{display:'flex',justifyContent:msg.sender==='recruiter'?'flex-end':'flex-start'}}>
                <Box sx={{maxWidth:'78%',px:1.3,py:0.9,borderRadius:'12px',
                  background:msg.sender==='recruiter'?'linear-gradient(135deg,#4f46e5,#7c3aed)':'#fff',
                  border:msg.sender==='recruiter'?'none':'1.5px solid #e2e8f0',
                  boxShadow:msg.sender==='recruiter'?'0 4px 14px rgba(79,70,229,0.25)':'0 1px 4px rgba(0,0,0,0.05)'}}>
                  <Typography sx={{fontSize:'0.73rem',color:msg.sender==='recruiter'?'#fff':'#0f172a',lineHeight:1.5}}>
                    {msg.message}
                  </Typography>
                  <Typography sx={{fontSize:'0.52rem',mt:0.3,color:msg.sender==='recruiter'?'rgba(255,255,255,0.65)':'#94a3b8'}}>
                    {msg.time}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{p:1.2,borderTop:'1.5px solid #f1f5f9',display:'flex',gap:0.8,background:'#fff'}}>
            <TextField fullWidth size="small" placeholder="Type a message..." value={chatInput}
              onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}
              sx={{...inputStyle,'& input::placeholder':{color:'#94a3b8'}}}/>
            <IconButton onClick={sendChat} disabled={!chatInput.trim()}
              sx={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)',borderRadius:'10px',
                boxShadow:'0 4px 12px rgba(79,70,229,0.3)',
                '&:hover':{background:'linear-gradient(135deg,#4338ca,#6d28d9)'},
                '&.Mui-disabled':{backgroundColor:'#e2e8f0'}}}>
              <Send sx={{fontSize:15,color:'#fff'}}/>
            </IconButton>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={()=>setSnackbar(p=>({...p,open:false}))}
        anchorOrigin={{vertical:'bottom',horizontal:'right'}}>
        <Alert severity={snackbar.severity} onClose={()=>setSnackbar(p=>({...p,open:false}))}
          sx={{fontSize:'0.75rem',borderRadius:'12px',
            boxShadow:'0 8px 32px rgba(79,70,229,0.15)',
            border:'1px solid #e2e8f0',
            '& .MuiAlert-message':{color:'#0f172a',fontWeight:600}}}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* AI Interview is conducted by the CANDIDATE on their profile — not here */}
    </Box>
  );
};

export default ApplicationManager;
