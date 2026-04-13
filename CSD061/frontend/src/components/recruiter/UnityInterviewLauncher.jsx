// UnityInterviewLauncher.jsx
// Smart launcher:
//   • If Unity WebGL build exists at /unity-interview/Build/ → loads Unity
//   • Otherwise → renders AIInterviewRoom (pure React, works immediately)
// This means the interview ALWAYS works — Unity is progressive enhancement.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authService } from '../../services/AuthService';
import AIInterviewRoom from './AIInterviewRoom';

const API          = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const UNITY_PATH   = '/unity-interview';
const UNITY_LOADER = `${UNITY_PATH}/Build/UnityInterviewBuild.loader.js`;
const UNITY_DATA   = `${UNITY_PATH}/Build/UnityInterviewBuild.data`;

function hdrs() {
  const t = authService?.getToken?.() || localStorage.getItem('token') || '';
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

const T = {
  bg: '#07080f', panel: '#0d0f1a', card: '#12141f', border: '#1e2235',
  primary: '#6c63ff', pLight: '#9d97ff', pGlow: 'rgba(108,99,255,0.3)',
  accent: '#00d4aa', aGlow: 'rgba(0,212,170,0.25)',
  amber: '#ffa502', red: '#ff4757', text: '#e8eaf6', muted: '#6b7280', muted2: '#9ca3af',
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Epilogue:wght@300;400;500;600&display=swap');
  .uil * { box-sizing: border-box; margin: 0; padding: 0; }
  .uil { font-family: 'Epilogue', sans-serif; }
  @keyframes uil-spin    { to { transform: rotate(360deg); } }
  @keyframes uil-fadein  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes uil-pulse   { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes uil-fill    { from{width:0} to{width:var(--target-w)} }
  @keyframes uil-glow    { 0%,100%{box-shadow:0 0 16px ${T.pGlow}} 50%{box-shadow:0 0 40px ${T.pGlow}} }
  @keyframes uil-scanline{ 0%{top:-5%} 100%{top:105%} }
  .uil-fadein { animation: uil-fadein 0.45s ease forwards; }
  .uil-glow   { animation: uil-glow 2.5s ease-in-out infinite; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${T.panel}; }
  ::-webkit-scrollbar-thumb { background: #252840; border-radius: 4px; }
`;

function Meter({ label, value, color, delay = '0s' }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = setTimeout(() => setShown(value), 300); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
        <span style={{ fontSize:12, fontWeight:600, color:T.muted2, textTransform:'uppercase', letterSpacing:'0.09em' }}>{label}</span>
        <span style={{ fontSize:15, fontWeight:800, color, fontFamily:'Syne' }}>{value}</span>
      </div>
      <div style={{ height:9, background:T.border, borderRadius:5, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${shown}%`, background:`linear-gradient(90deg,${color}70,${color})`, borderRadius:5, boxShadow:`0 0 10px ${color}55`, transition:'width 1.3s cubic-bezier(0.34,1.56,0.64,1)' }}/>
      </div>
    </div>
  );
}

export default function UnityInterviewLauncher({ application, onClose, onComplete }) {
  const [mode, setMode]             = useState('checking'); // checking|unity|fallback
  const [phase, setPhase]           = useState('loading');  // loading|unity|report
  const [report, setReport]         = useState(null);
  const [unityReady, setUnityReady] = useState(false);
  const [loadPct, setLoadPct]       = useState(0);
  const [unityError, setUnityError] = useState('');
  const canvasRef = useRef(null);
  const unityRef  = useRef(null);

  const appId         = application?._id || application?.applicationId;
  const jobTitle      = application?.jobId?.title      || application?.jobTitle   || 'the position';
  const company       = application?.jobId?.company    || application?.company    || '';
  const candidateName = application?.applicantId?.username || application?.candidateName || 'Candidate';
  const token         = authService?.getToken?.() || localStorage.getItem('token') || '';

  // Build config object passed to Unity
  const unityConfig = useCallback(() => ({
    apiUrl: API, authToken: token, applicationId: appId,
    candidateName, jobTitle, company,
  }), [appId, token, candidateName, jobTitle, company]);

  // ── Step 1: Check if Unity build exists ──────────────────
  useEffect(() => {
    fetch(UNITY_DATA, { method: 'HEAD' })
      .then(r => { if (r.ok) setMode('unity'); else setMode('fallback'); })
      .catch(() => setMode('fallback'));
  }, []);

  // ── Step 2: If Unity, set up event listeners ──────────────
  useEffect(() => {
    if (mode !== 'unity') return;

    const cfg = unityConfig();
    window.elanceInterviewConfig = cfg;

    const onReady = () => { setUnityReady(true); setPhase('unity'); };
    const onDone  = (e) => {
      const data = e?.detail || e;
      setReport(typeof data === 'string' ? JSON.parse(data) : data);
      setPhase('report');
      onComplete?.(typeof data === 'string' ? JSON.parse(data) : data);
    };

    window.onElanceInterviewReady    = onReady;
    window.onElanceInterviewComplete = onDone;
    window.addEventListener('elance:interview:ready',    onReady);
    window.addEventListener('elance:interview:complete', onDone);

    // Load Unity loader script
    const script = document.createElement('script');
    script.src = UNITY_LOADER;
    script.onload = () => initUnity(cfg);
    script.onerror = () => {
      setUnityError('Unity build files not found.');
      setMode('fallback');
    };
    document.body.appendChild(script);

    return () => {
      window.removeEventListener('elance:interview:ready',    onReady);
      window.removeEventListener('elance:interview:complete', onDone);
      try { unityRef.current?.Quit(); } catch {}
      document.body.removeChild(script);
    };
  }, [mode]);

  function initUnity(cfg) {
    if (!window.createUnityInstance || !canvasRef.current) {
      setUnityError('Unity loader failed.'); setMode('fallback'); return;
    }
    const ucfg = {
      dataUrl:            `${UNITY_PATH}/Build/UnityInterviewBuild.data`,
      frameworkUrl:       `${UNITY_PATH}/Build/UnityInterviewBuild.framework.js`,
      codeUrl:            `${UNITY_PATH}/Build/UnityInterviewBuild.wasm`,
      streamingAssetsUrl: `${UNITY_PATH}/StreamingAssets`,
      companyName: 'Elance', productName: 'AI Interview Room', productVersion: '1.0',
    };
    window.createUnityInstance(canvasRef.current, ucfg, p => setLoadPct(Math.round(p * 100)))
      .then(inst => {
        unityRef.current = inst;
        // Push auth config into Unity after it's ready
        inst.SendMessage('InterviewManager', 'SetConfig', JSON.stringify(cfg));
      })
      .catch(e => { setUnityError(String(e)); setMode('fallback'); });
  }

  // ── Fallback = pure React AIInterviewRoom ─────────────────
  if (mode === 'checking') {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:9999, background:T.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          <div style={{ width:40, height:40, border:`3px solid ${T.border}`, borderTopColor:T.primary, borderRadius:'50%', animation:'uil-spin 0.8s linear infinite' }}/>
          <p style={{ color:T.muted, fontSize:14, fontFamily:'Epilogue' }}>Initializing interview room...</p>
        </div>
      </div>
    );
  }

  if (mode === 'fallback') {
    return <AIInterviewRoom application={application} onClose={onClose} onComplete={onComplete}/>;
  }

  // ── Unity Mode ────────────────────────────────────────────
  const recColor = { 'Strong Hire':T.accent, 'Hire':'#4ade80', 'Maybe':T.amber, 'No Hire':T.red }[report?.recommendation] || T.primary;
  const recIcon  = { 'Strong Hire':'🏆', 'Hire':'✅', 'Maybe':'🤔', 'No Hire':'❌' }[report?.recommendation] || '📋';

  return (
    <div className="uil" style={{ position:'fixed', inset:0, zIndex:9999, background:T.bg, display:'flex', flexDirection:'column' }}>
      <style>{CSS}</style>

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 24px', background:T.panel, borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:unityReady?T.accent:T.amber, boxShadow:`0 0 8px ${unityReady?T.accent:T.amber}` }}/>
          <span style={{ fontFamily:'Syne', fontWeight:700, fontSize:15, color:T.text }}>Elance AI Interview Room</span>
          <span style={{ fontSize:12, color:T.muted, background:T.card, border:`1px solid ${T.border}`, borderRadius:20, padding:'3px 12px' }}>
            {candidateName} · {jobTitle}{company ? ` · ${company}` : ''}
          </span>
        </div>
        <button onClick={() => { try { unityRef.current?.Quit(); } catch {} onClose?.(); }}
          style={{ background:'none', border:`1px solid #252840`, color:T.muted2, cursor:'pointer', borderRadius:8, padding:'6px 16px', fontSize:13, fontWeight:600, fontFamily:'Syne' }}
          onMouseEnter={e=>{ e.currentTarget.style.borderColor=T.red; e.currentTarget.style.color=T.red; }}
          onMouseLeave={e=>{ e.currentTarget.style.borderColor='#252840'; e.currentTarget.style.color=T.muted2; }}>
          ✕ Exit
        </button>
      </div>

      {/* Main */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>

        {/* Unity canvas area */}
        <div style={{ position:'absolute', inset:0, display: phase==='report'?'none':'flex', alignItems:'center', justifyContent:'center', background:T.bg }}>

          {/* Loading overlay */}
          {!unityReady && !unityError && (
            <div style={{ position:'absolute', inset:0, zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:T.bg, gap:24 }}>
              <div style={{ position:'relative', width:180, height:180 }}>
                <svg viewBox="0 0 200 200" width="180" height="180">
                  <polygon points="0,200 60,100 140,100 200,200" fill="#0d0f1a" stroke="#1e2235" strokeWidth="1"/>
                  <polygon points="60,100 100,60 100,100" fill="#12141f" stroke="#1e2235" strokeWidth="1"/>
                  <polygon points="100,60 140,100 100,100" fill="#0f1120" stroke="#1e2235" strokeWidth="1"/>
                  <rect x="125" y="105" width="60" height="70" fill="none" stroke={T.primary} strokeWidth="1" opacity="0.4"/>
                  <rect x="130" y="108" width="50" height="30" fill={T.primary} opacity="0.07"/>
                  <rect x="55" y="162" width="90" height="6" rx="2" fill="#1e2235"/>
                  <ellipse cx="100" cy="128" rx="13" ry="15" fill="#d4956a" opacity="0.6"/>
                  <rect x="86" y="140" width="28" height="16" rx="4" fill="#3a3f6e" opacity="0.6"/>
                </svg>
                <div style={{ position:'absolute', inset:0, overflow:'hidden', borderRadius:8, pointerEvents:'none' }}>
                  <div style={{ position:'absolute', left:0, right:0, height:2, background:`linear-gradient(transparent,${T.primary}44,transparent)`, animation:'uil-scanline 2s linear infinite' }}/>
                </div>
              </div>
              <div style={{ textAlign:'center' }}>
                <p style={{ fontFamily:'Syne', fontWeight:700, fontSize:18, color:T.text, marginBottom:8 }}>Loading Interview Room</p>
                <p style={{ fontSize:13, color:T.muted, marginBottom:20 }}>Preparing AI questions for {jobTitle}…</p>
              </div>
              <div style={{ width:280, height:5, background:T.border, borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${loadPct}%`, background:`linear-gradient(90deg,${T.primary},${T.pLight})`, borderRadius:3, transition:'width 0.3s ease', boxShadow:`0 0 10px ${T.pGlow}` }}/>
              </div>
              <p style={{ fontSize:12, color:T.muted, fontFamily:'Syne', fontWeight:600 }}>{loadPct}%</p>
            </div>
          )}

          {/* Error */}
          {unityError && (
            <div style={{ maxWidth:500, padding:40, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:16 }}>🎮</div>
              <h2 style={{ fontFamily:'Syne', fontWeight:800, fontSize:20, color:T.text, marginBottom:12 }}>Unity Build Not Found</h2>
              <p style={{ fontSize:13, color:T.muted2, marginBottom:20, lineHeight:1.7 }}>
                Export your Unity project to WebGL and place the Build files in<br/>
                <code style={{ color:T.accent }}>frontend/public/unity-interview/Build/</code>
              </p>
              <button onClick={() => setMode('fallback')}
                style={{ padding:'12px 24px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:'Syne', fontWeight:700, fontSize:14, background:`linear-gradient(135deg,${T.primary},${T.pLight})`, color:'white', boxShadow:`0 4px 20px ${T.pGlow}` }}>
                Use React Interview Room Instead →
              </button>
            </div>
          )}

          <canvas ref={canvasRef} id="unity-canvas" style={{ width:'100%', height:'100%', display:unityReady?'block':'none' }}/>
        </div>

        {/* Report view */}
        {phase === 'report' && report && (
          <div className="uil-fadein" style={{ position:'absolute', inset:0, overflowY:'auto', padding:'40px 48px' }}>
            <div style={{ textAlign:'center', marginBottom:40 }}>
              <div style={{ fontSize:52, marginBottom:12 }}>{recIcon}</div>
              <h1 style={{ fontFamily:'Syne', fontWeight:800, fontSize:30, color:T.text, marginBottom:10 }}>Interview Complete</h1>
              <p style={{ fontSize:14, color:T.muted2, maxWidth:500, margin:'0 auto 20px', lineHeight:1.7 }}>
                {report.summary || `${candidateName} completed the AI interview for ${jobTitle}.`}
              </p>
              <div className="uil-glow" style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'10px 24px', borderRadius:32, background:`${recColor}12`, border:`1.5px solid ${recColor}50` }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:recColor, boxShadow:`0 0 10px ${recColor}` }}/>
                <span style={{ fontFamily:'Syne', fontWeight:800, fontSize:15, color:recColor }}>{report.recommendation}</span>
              </div>
            </div>

            <div style={{ maxWidth:860, margin:'0 auto', display:'grid', gap:20 }}>
              {/* Score ring + breakdown */}
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:20, padding:32, display:'flex', alignItems:'center', gap:40 }}>
                <div style={{ flexShrink:0, position:'relative', width:130, height:130 }}>
                  <svg width="130" height="130" style={{ transform:'rotate(-90deg)' }}>
                    <circle cx="65" cy="65" r="54" fill="none" stroke={T.border} strokeWidth="9"/>
                    <circle cx="65" cy="65" r="54" fill="none" stroke={T.primary} strokeWidth="9" strokeLinecap="round"
                      strokeDasharray={`${(report.overallScore/100)*339.3} 339.3`}
                      style={{ filter:`drop-shadow(0 0 8px ${T.primary})`, transition:'stroke-dasharray 1.5s ease' }}/>
                  </svg>
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontFamily:'Syne', fontWeight:800, fontSize:30, color:T.text }}>{report.overallScore}</span>
                    <span style={{ fontSize:10, color:T.muted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em' }}>/ 100</span>
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontFamily:'Syne', fontWeight:700, fontSize:12, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:18 }}>Performance Breakdown</p>
                  <Meter label="Communication"   value={report.communicationScore} color={T.accent}   delay="0.1s"/>
                  <Meter label="Technical Skills" value={report.technicalScore}    color={T.primary}  delay="0.2s"/>
                  <Meter label="Confidence"       value={report.confidenceScore}   color={T.amber}    delay="0.3s"/>
                </div>
              </div>

              {/* Strengths + Improvements */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                {[
                  { title:'💪 Strengths', items:report.strengths, color:T.accent },
                  { title:'🎯 Areas to Improve', items:report.improvements, color:T.amber },
                ].map(({ title, items, color }) => (
                  <div key={title} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:24 }}>
                    <p style={{ fontFamily:'Syne', fontWeight:700, fontSize:12, color, textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:16 }}>{title}</p>
                    {(items||[]).map((s,i) => (
                      <div key={i} style={{ display:'flex', gap:10, marginBottom:12 }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0, marginTop:6 }}/>
                        <p style={{ fontSize:13, color:T.text, lineHeight:1.6, margin:0 }}>{s}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Meta */}
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:24, display:'flex', gap:32, flexWrap:'wrap' }}>
                {[
                  { label:'Candidate',  value:candidateName },
                  { label:'Role',       value:jobTitle },
                  { label:'Company',    value:company||'—' },
                  { label:'Questions',  value:report.totalQuestions||'6' },
                  { label:'Duration',   value:report.elapsedSeconds?`${Math.round(report.elapsedSeconds/60)} min`:'—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontSize:11, color:T.muted, textTransform:'uppercase', letterSpacing:'0.09em', fontWeight:600, marginBottom:4 }}>{label}</p>
                    <p style={{ fontSize:14, color:T.text, fontWeight:600, fontFamily:'Syne' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Buttons */}
              <div style={{ display:'flex', gap:14, justifyContent:'center', paddingBottom:32 }}>
                <button onClick={() => { onComplete?.(report); onClose?.(); }}
                  style={{ padding:'14px 32px', borderRadius:12, border:'none', cursor:'pointer', fontFamily:'Syne', fontWeight:700, fontSize:14, background:`linear-gradient(135deg,${T.primary},${T.pLight})`, color:'white', boxShadow:`0 4px 24px ${T.pGlow}` }}>
                  Save Report & Close
                </button>
                <button onClick={() => setPhase('unity')}
                  style={{ padding:'14px 24px', borderRadius:12, border:`1px solid #252840`, cursor:'pointer', fontFamily:'Syne', fontWeight:600, fontSize:14, background:'none', color:T.muted2 }}>
                  ← Back to Room
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
