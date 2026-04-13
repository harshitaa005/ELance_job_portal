// frontend/src/components/recruiter/AIInterviewRoom.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authService } from '../../services/AuthService';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
function hdrs() {
  const t = authService?.getToken?.() || localStorage.getItem('token') || '';
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

const C = {
  bg:      '#070a12',
  panel:   '#0b0e1a',
  card:    '#10142a',
  border:  '#1c2240',
  border2: '#252d50',
  primary: '#4f8ef7',
  pLight:  '#6fa4ff',
  pGlow:   'rgba(79,142,247,0.4)',
  accent:  '#00e5b0',
  aGlow:   'rgba(0,229,176,0.35)',
  red:     '#ff3d55',
  amber:   '#ffb020',
  text:    '#dde4f8',
  muted:   '#5a6280',
  muted2:  '#8a93b8',
  gold:    '#c8a84b',
  wood:    '#6b3d1e',
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap');
  .air-root*{box-sizing:border-box;margin:0;padding:0}
  .air-root{font-family:'Outfit',sans-serif;background:${C.bg};color:${C.text};overflow:hidden}

  @keyframes blink       {0%,85%,100%{transform:scaleY(1)}91%{transform:scaleY(0.05)}}
  @keyframes mouthOpen   {0%,100%{d:path("M136 160 Q150 166 164 160")} 50%{d:path("M134 158 Q150 170 166 158")}}
  @keyframes pulse-dot   {0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.7)}}
  @keyframes wave        {0%,100%{height:3px;opacity:0.5} 50%{height:24px;opacity:1}}
  @keyframes fadeUp      {from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)}}
  @keyframes popIn       {from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)}}
  @keyframes speakRing   {0%{transform:translate(-50%,-50%) scale(1);opacity:0.6} 100%{transform:translate(-50%,-50%) scale(1.9);opacity:0}}
  @keyframes ambGlow     {0%,100%{opacity:0.5} 50%{opacity:1}}
  @keyframes flicker     {0%,100%{opacity:0.8} 30%{opacity:1} 60%{opacity:0.65} 80%{opacity:0.95}}
  @keyframes ceilLight   {0%,100%{opacity:0.7} 50%{opacity:0.85}}
  @keyframes scanline    {0%{top:-15%} 100%{top:115%}}
  @keyframes floatAnim   {0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)}}
  @keyframes holoBorder  {0%,100%{border-color:rgba(79,142,247,0.3)} 50%{border-color:rgba(79,142,247,0.7)}}
  @keyframes recPulse    {0%,100%{box-shadow:0 0 0 0 rgba(255,61,85,0.6)} 50%{box-shadow:0 0 0 6px rgba(255,61,85,0)}}
  @keyframes monitorGlow {0%,100%{opacity:0.6} 50%{opacity:0.9}}
  @keyframes cityWin     {0%,100%{opacity:0.7} 40%{opacity:1} 70%{opacity:0.8}}

  .eye-l{animation:blink 5s ease-in-out infinite;transform-origin:center}
  .eye-r{animation:blink 5s ease-in-out 0.3s infinite;transform-origin:center}
  .rec-dot{animation:recPulse 1.4s ease-in-out infinite}
  .float-anim{animation:floatAnim 4s ease-in-out infinite}
  .fade-in{animation:fadeUp 0.45s ease forwards}
  .pop-in{animation:popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards}
  .transcript-msg{animation:fadeUp 0.4s ease forwards}

  .waveform-bar{animation:wave 0.7s ease-in-out infinite}
  .waveform-bar:nth-child(2){animation-delay:.09s}
  .waveform-bar:nth-child(3){animation-delay:.18s}
  .waveform-bar:nth-child(4){animation-delay:.27s}
  .waveform-bar:nth-child(5){animation-delay:.13s}
  .waveform-bar:nth-child(6){animation-delay:.22s}
  .waveform-bar:nth-child(7){animation-delay:.04s}

  .score-fill{transition:width 1.4s cubic-bezier(0.34,1.56,0.64,1)}
  ::-webkit-scrollbar{width:3px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${C.border2};border-radius:3px}
`;

/* ─── Waveform ─── */
function Waveform({ active }) {
  return (
    <div style={{ display:'flex', gap:2.5, alignItems:'center', height:24 }}>
      {[1,2,3,4,5,6,7].map(i => (
        <div key={i} className={active ? 'waveform-bar' : ''}
          style={{ width:3, height:active ? undefined : 3,
            background:`linear-gradient(180deg,${C.accent},${C.primary})`,
            borderRadius:2, transition:'height 0.15s' }}/>
      ))}
    </div>
  );
}

/* ─── Score Meter ─── */
function ScoreMeter({ label, value, color = C.primary }) {
  const [shown, setShown] = React.useState(0);
  React.useEffect(() => { const t = setTimeout(() => setShown(value||0), 250); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
        <span style={{ fontSize:12, fontWeight:500, color:C.muted2, letterSpacing:'0.04em' }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:700, color, fontFamily:'Outfit' }}>{shown}%</span>
      </div>
      <div style={{ height:7, background:C.border, borderRadius:4, overflow:'hidden' }}>
        <div className="score-fill" style={{ height:'100%', width:`${shown}%`,
          background:`linear-gradient(90deg,${color}90,${color})`,
          borderRadius:4, boxShadow:`0 0 10px ${color}60` }}/>
      </div>
    </div>
  );
}
function AlexAvatar({ speaking, size = 320 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 320 320">
      <defs>
        {/* Skin tones */}
        <radialGradient id="sk1" cx="42%" cy="32%" r="62%">
          <stop offset="0%"   stopColor="#f0b896"/>
          <stop offset="55%"  stopColor="#d4865c"/>
          <stop offset="100%" stopColor="#b86838"/>
        </radialGradient>
        <radialGradient id="skFace" cx="38%" cy="28%" r="55%">
          <stop offset="0%"   stopColor="rgba(255,230,200,0.35)"/>
          <stop offset="100%" stopColor="rgba(255,200,150,0)"/>
        </radialGradient>
        {/* Suit */}
        <linearGradient id="suit" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor="#1c2b62"/>
          <stop offset="40%"  stopColor="#15224f"/>
          <stop offset="100%" stopColor="#0d1838"/>
        </linearGradient>
        <linearGradient id="suitHi" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.04)"/>
          <stop offset="50%"  stopColor="rgba(255,255,255,0.09)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </linearGradient>
        {/* Shirt */}
        <linearGradient id="shirt" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#edf0fc"/>
          <stop offset="100%" stopColor="#c5cce8"/>
        </linearGradient>
        {/* Tie — deep teal */}
        <linearGradient id="tie" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#0a5c6e"/>
          <stop offset="100%" stopColor="#063a46"/>
        </linearGradient>
        {/* Hair */}
        <radialGradient id="hair" cx="50%" cy="15%" r="65%">
          <stop offset="0%"   stopColor="#231a0d"/>
          <stop offset="100%" stopColor="#140e06"/>
        </radialGradient>
        {/* Ambient screen light on face */}
        <radialGradient id="scrLight" cx="50%" cy="110%" r="70%">
          <stop offset="0%"   stopColor="rgba(79,142,247,0.14)"/>
          <stop offset="100%" stopColor="rgba(79,142,247,0)"/>
        </radialGradient>
        {/* Room light from window */}
        <radialGradient id="winLight" cx="10%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="rgba(180,210,255,0.08)"/>
          <stop offset="100%" stopColor="rgba(180,210,255,0)"/>
        </radialGradient>
        {/* Shadow under chin */}
        <radialGradient id="chinShadow" cx="50%" cy="0%" r="80%">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.5)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
        </radialGradient>
        <filter id="dropShadow"><feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000" floodOpacity="0.65"/></filter>
        <filter id="softShadow"><feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.4"/></filter>
        <filter id="eyeGlow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <clipPath id="headShape"><ellipse cx="160" cy="128" rx="75" ry="86"/></clipPath>
      </defs>

      {/* ── BODY / SUIT ── */}
      <path d="M10 320 Q18 208 75 185 L110 204 L160 192 L210 204 L245 185 Q302 208 310 320 Z"
        fill="url(#suit)" filter="url(#dropShadow)"/>
      {/* Suit highlight */}
      <path d="M10 320 Q18 208 75 185 L110 204 L160 192 L210 204 L245 185 Q302 208 310 320 Z"
        fill="url(#suitHi)"/>
      {/* Lapels */}
      <path d="M110 204 L144 252 L160 240 L176 252 L210 204 L194 194 L176 220 L160 208 L144 220 L126 194 Z"
        fill="url(#suit)"/>
      {/* Lapel shadow */}
      <path d="M126 194 L144 220 L160 208" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1"/>
      <path d="M194 194 L176 220 L160 208" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1"/>
      {/* Suit button row */}
      {[268,288,308].map((y,i)=>(
        <circle key={i} cx="160" cy={y} r="3.5" fill="#1c2b62" stroke="#253260" strokeWidth="1"/>
      ))}

      {/* ── SHIRT & TIE ── */}
      <path d="M144 220 L148 320 L172 320 L176 220 L166 210 L160 215 L154 210 Z" fill="url(#shirt)"/>
      {/* Tie */}
      <path d="M155 213 L160 320 L165 213 L163 207 L160 210 L157 207 Z" fill="url(#tie)"/>
      {/* Tie knot */}
      <polygon points="157,207 163,207 162,202 160,200 158,202" fill="#084050"/>
      {/* Tie shine */}
      <path d="M159 210 L160 230" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>

      {/* ── COLLAR ── */}
      <path d="M136 198 L144 220 L160 208 L176 220 L184 198 L170 202 L160 210 L150 202 Z"
        fill="url(#shirt)"/>

      {/* ── NECK ── */}
      <path d="M142 192 Q160 188 178 192 L180 208 Q160 212 140 208 Z" fill="url(#sk1)"/>

      {/* ── HEAD ── */}
      <ellipse cx="160" cy="128" rx="75" ry="86" fill="url(#sk1)" filter="url(#softShadow)"/>
      {/* Face highlight */}
      <ellipse cx="160" cy="128" rx="75" ry="86" fill="url(#skFace)"/>
      {/* Screen light */}
      <ellipse cx="160" cy="128" rx="75" ry="86" fill="url(#scrLight)"/>
      {/* Window light */}
      <ellipse cx="160" cy="128" rx="75" ry="86" fill="url(#winLight)"/>
      {/* Chin shadow */}
      <ellipse cx="160" cy="208" rx="60" ry="20" fill="url(#chinShadow)"/>

      {/* ── HAIR ── */}
      <path d="M86 112 Q86 44 160 42 Q234 44 234 112 Q228 76 160 74 Q92 76 86 112 Z" fill="url(#hair)"/>
      {/* Hair part */}
      <path d="M152 44 Q156 60 152 78" stroke="rgba(255,255,255,0.06)" strokeWidth="2" fill="none"/>
      {/* Sideburns */}
      <path d="M86 112 Q84 130 87 148" fill="url(#hair)" stroke="none"/>
      <path d="M234 112 Q236 130 233 148" fill="url(#hair)" stroke="none"/>

      {/* ── EARS ── */}
      <ellipse cx="86"  cy="128" rx="11" ry="15" fill="#c8784e"/>
      <ellipse cx="234" cy="128" rx="11" ry="15" fill="#c8784e"/>
      {/* Ear detail */}
      <path d="M89 120 Q87 128 89 136" stroke="#b06838" strokeWidth="1.5" fill="none"/>
      <path d="M231 120 Q233 128 231 136" stroke="#b06838" strokeWidth="1.5" fill="none"/>

      {/* ── EYEBROWS — slightly arched, well-groomed ── */}
      <path d="M118 98 Q130 91 143 94" stroke="#231a0d" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <path d="M177 94 Q190 91 202 98" stroke="#231a0d" strokeWidth="3" strokeLinecap="round" fill="none"/>

      {/* ── EYES ── */}
      {/* Left eye socket */}
      <ellipse cx="130" cy="116" rx="16" ry="13" fill="white"/>
      {/* Left iris */}
      <g className="eye-l">
        <ellipse cx="130" cy="117" rx="10" ry="10" fill="#2a4a7c"/>
        <ellipse cx="130" cy="117" rx="6"  ry="6"  fill="#162840"/>
        <ellipse cx="130" cy="117" rx="3.5" ry="3.5" fill="#0a1828"/>
        {/* Catchlight */}
        <ellipse cx="126" cy="113" rx="2"  ry="2"  fill="rgba(255,255,255,0.92)"/>
        <ellipse cx="133" cy="119" rx="1"  ry="1"  fill="rgba(255,255,255,0.4)"/>
      </g>
      {/* Left eyelid */}
      <path d="M114 116 Q130 106 146 116" fill="none" stroke="#b87055" strokeWidth="1.2" opacity="0.4"/>
      <path d="M114 116 Q130 126 146 116" fill="none" stroke="#b87055" strokeWidth="1.2" opacity="0.4"/>
      {/* Left lashes */}
      <path d="M114 116 Q110 112 112 108" stroke="#231a0d" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M146 116 Q150 112 148 108" stroke="#231a0d" strokeWidth="1.5" fill="none" strokeLinecap="round"/>

      {/* Right eye socket */}
      <ellipse cx="190" cy="116" rx="16" ry="13" fill="white"/>
      {/* Right iris */}
      <g className="eye-r">
        <ellipse cx="190" cy="117" rx="10" ry="10" fill="#2a4a7c"/>
        <ellipse cx="190" cy="117" rx="6"  ry="6"  fill="#162840"/>
        <ellipse cx="190" cy="117" rx="3.5" ry="3.5" fill="#0a1828"/>
        <ellipse cx="186" cy="113" rx="2"  ry="2"  fill="rgba(255,255,255,0.92)"/>
        <ellipse cx="193" cy="119" rx="1"  ry="1"  fill="rgba(255,255,255,0.4)"/>
      </g>
      <path d="M174 116 Q190 106 206 116" fill="none" stroke="#b87055" strokeWidth="1.2" opacity="0.4"/>
      <path d="M174 116 Q190 126 206 116" fill="none" stroke="#b87055" strokeWidth="1.2" opacity="0.4"/>
      <path d="M174 116 Q170 112 172 108" stroke="#231a0d" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M206 116 Q210 112 208 108" stroke="#231a0d" strokeWidth="1.5" fill="none" strokeLinecap="round"/>

      {/* ── NOSE ── */}
      <path d="M158 130 Q152 152 148 158 Q160 164 172 158 Q168 152 162 130 Z" fill="rgba(160,80,40,0.3)"/>
      <ellipse cx="152" cy="156" rx="6" ry="4" fill="#b86840" opacity="0.55"/>
      <ellipse cx="168" cy="156" rx="6" ry="4" fill="#b86840" opacity="0.55"/>
      {/* Nose bridge */}
      <path d="M156 130 Q154 145 152 155" stroke="rgba(160,80,40,0.25)" strokeWidth="1.5" fill="none"/>

      {/* ── MOUTH ── */}
      {speaking ? (
        <g>
          <path d="M138 168 Q160 180 182 168" fill="#5c1f10"/>
          <ellipse cx="160" cy="174" rx="18" ry="9" fill="#4a1508"/>
          <path d="M138 168 Q160 164 182 168" fill="#d08070"/>
          <path d="M142 172 Q160 176 178 172" stroke="#7a3020" strokeWidth="0.8" fill="none"/>
          <ellipse cx="160" cy="174" rx="12" ry="5" fill="#3a1005" opacity="0.7"/>
        </g>
      ) : (
        <g>
          <path d="M142 168 Q160 176 178 168" fill="none" stroke="#c07060" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M142 168 Q160 172 178 168" fill="rgba(200,120,90,0.25)"/>
        </g>
      )}

      {/* ── SUBTLE CHEEKS ── */}
      <ellipse cx="110" cy="140" rx="18" ry="12" fill="rgba(220,100,80,0.09)"/>
      <ellipse cx="210" cy="140" rx="18" ry="12" fill="rgba(220,100,80,0.09)"/>

      {/* ── GLASSES ── modern rimless style ── */}
      {/* Left lens */}
      <rect x="112" y="108" width="36" height="22" rx="8" fill="rgba(150,200,255,0.04)" stroke="#1e2a50" strokeWidth="2.2"/>
      {/* Right lens */}
      <rect x="172" y="108" width="36" height="22" rx="8" fill="rgba(150,200,255,0.04)" stroke="#1e2a50" strokeWidth="2.2"/>
      {/* Bridge */}
      <path d="M148 119 Q160 117 172 119" stroke="#1e2a50" strokeWidth="2" fill="none"/>
      {/* Arms */}
      <line x1="112" y1="119" x2="86"  y2="124" stroke="#1e2a50" strokeWidth="1.8"/>
      <line x1="208" y1="119" x2="234" y2="124" stroke="#1e2a50" strokeWidth="1.8"/>
      {/* Lens glare */}
      <path d="M116 112 Q124 109 130 114" stroke="rgba(200,230,255,0.28)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M176 112 Q184 109 190 114" stroke="rgba(200,230,255,0.28)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

function VirtualRoom({ speaking, phase }) {
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>

      {/* ═══ BACKGROUND WALL ═══ */}
      <div style={{ position:'absolute', inset:0,
        background:'linear-gradient(175deg, #14192e 0%, #0f1425 40%, #0a0f1e 100%)' }}/>

      {/* Wall texture — very subtle wood paneling lines */}
      <div style={{ position:'absolute', inset:0, opacity:0.035,
        backgroundImage:'repeating-linear-gradient(90deg, transparent, transparent 119px, #8899cc 120px)',
        backgroundSize:'120px 100%' }}/>
      <div style={{ position:'absolute', inset:0, opacity:0.02,
        backgroundImage:'repeating-linear-gradient(0deg, transparent, transparent 79px, #8899cc 80px)' }}/>

      {/* ═══ CEILING ═══ */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'8%',
        background:'linear-gradient(180deg, #0d1020 0%, transparent 100%)' }}/>

      {/* ═══ RECESSED CEILING LIGHTS ═══ */}
      {[18, 50, 82].map((pct, i) => (
        <g key={i}>
          {/* Fixture housing */}
          <div style={{ position:'absolute', top:0, left:`${pct}%`, transform:'translateX(-50%)',
            width:36, height:8, background:'#0d1020',
            borderRadius:'0 0 4px 4px', border:'1px solid #1e2540' }}/>
          {/* Light cone */}
          <div style={{ position:'absolute', top:0, left:`${pct}%`, transform:'translateX(-50%)',
            width:0, height:0,
            borderLeft:'120px solid transparent', borderRight:'120px solid transparent',
            borderTop:'280px solid rgba(200,220,255,0.025)', pointerEvents:'none' }}/>
          {/* Hot spot */}
          <div style={{ position:'absolute', top:0, left:`${pct}%`, transform:'translateX(-50%)',
            width:30, height:2, background:'rgba(220,235,255,0.7)',
            boxShadow:'0 0 16px 8px rgba(200,220,255,0.4)', borderRadius:2,
            animation:'ceilLight 3s ease-in-out infinite', animationDelay:`${i*0.8}s` }}/>
          {/* Floor pool */}
          <div style={{ position:'absolute', bottom:'18%', left:`${pct}%`, transform:'translateX(-50%)',
            width:180, height:40,
            background:'radial-gradient(ellipse, rgba(200,220,255,0.04) 0%, transparent 70%)',
            pointerEvents:'none' }}/>
        </g>
      ))}

      {/* ═══ LARGE WINDOW — floor to near-ceiling left side ═══ */}
      <div style={{ position:'absolute', top:'5%', left:'3%', width:'42%', height:'72%',
        background:'#04091c', border:'6px solid #141c36',
        borderRadius:'4px 4px 0 0',
        boxShadow:'inset 0 0 80px rgba(0,0,0,0.95), 0 0 0 1px #0d1228, 4px 0 20px rgba(0,0,0,0.5)' }}>

        {/* Window divider cross */}
        <div style={{ position:'absolute', top:0, bottom:0, left:'50%', width:5, background:'#141c36', transform:'translateX(-50%)' }}/>
        <div style={{ position:'absolute', left:0, right:0, top:'50%',  height:5, background:'#141c36', transform:'translateY(-50%)' }}/>
        {/* Corner joins */}
        <div style={{ position:'absolute', top:'50%', left:'50%', width:8, height:8, background:'#101828', transform:'translate(-50%,-50%)', borderRadius:1 }}/>

        {/* ── NIGHT SKY ── */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, #020612 0%, #040a1a 40%, #060e22 100%)' }}/>

        {/* Stars */}
        {[...Array(28)].map((_,i) => {
          const x = (i*37+11) % 93;
          const y = (i*19+7)  % 45;
          const s = i%4===0 ? 2.5 : i%3===0 ? 1.5 : 1;
          return (
            <div key={i} style={{ position:'absolute', left:`${x}%`, top:`${y}%`,
              width:s, height:s, borderRadius:'50%', background:'white',
              opacity:0.3+((i*7)%5)*0.14,
              animation:`flicker ${2.5+i%4}s ease-in-out ${i*0.3}s infinite` }}/>
          );
        })}

        {/* Moon */}
        <div style={{ position:'absolute', top:'8%', right:'22%', width:30, height:30, borderRadius:'50%',
          background:'radial-gradient(circle at 38% 35%, #fffce8, #f0e880 50%, #d4c840)',
          boxShadow:'0 0 24px 10px rgba(240,230,100,0.28), 0 0 6px 2px rgba(255,250,180,0.5)' }}/>
        {/* Moon craters */}
        <div style={{ position:'absolute', top:'10%', right:'26%', width:5, height:4, borderRadius:'50%', background:'rgba(180,160,40,0.4)' }}/>
        <div style={{ position:'absolute', top:'14%', right:'23%', width:3, height:3, borderRadius:'50%', background:'rgba(180,160,40,0.35)' }}/>

        {/* City skyline silhouette */}
        <svg style={{ position:'absolute', bottom:0, left:0, width:'100%', height:'62%' }}
          viewBox="0 0 500 160" preserveAspectRatio="none">
          <defs>
            <linearGradient id="buildGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0c1630"/>
              <stop offset="100%" stopColor="#06101e"/>
            </linearGradient>
          </defs>
          {/* Buildings — varied heights */}
          <rect x="0"   y="55"  width="42"  height="105" fill="url(#buildGrad)"/>
          <rect x="0"   y="80"  width="42"  height="80"  fill="#080e1e"/>
          <rect x="44"  y="20"  width="32"  height="140" fill="url(#buildGrad)"/>
          <rect x="78"  y="65"  width="24"  height="95"  fill="url(#buildGrad)"/>
          <rect x="104" y="10"  width="45"  height="150" fill="url(#buildGrad)"/>
          <rect x="151" y="40"  width="28"  height="120" fill="url(#buildGrad)"/>
          <rect x="181" y="70"  width="20"  height="90"  fill="#070d1c"/>
          <rect x="203" y="25"  width="50"  height="135" fill="url(#buildGrad)"/>
          <rect x="255" y="50"  width="30"  height="110" fill="url(#buildGrad)"/>
          <rect x="287" y="8"   width="48"  height="152" fill="url(#buildGrad)"/>
          <rect x="337" y="55"  width="26"  height="105" fill="url(#buildGrad)"/>
          <rect x="365" y="30"  width="42"  height="130" fill="url(#buildGrad)"/>
          <rect x="409" y="60"  width="28"  height="100" fill="#070d1c"/>
          <rect x="439" y="18"  width="52"  height="142" fill="url(#buildGrad)"/>
          {/* Antenna */}
          <rect x="113" y="0"   width="3"   height="12"  fill="#0c1630"/>
          <rect x="307" y="0"   width="3"   height="10"  fill="#0c1630"/>

          {/* Building windows — warm and cool */}
          {[
            [48,25],[53,35],[58,25],[53,45],[48,45],
            [48,55],[53,55],[58,55],
            [108,14],[113,24],[118,14],[108,34],[118,34],[108,44],[113,44],[118,44],
            [108,54],[113,54],[118,54],[108,64],[118,64],
            [207,30],[212,40],[217,30],[222,40],[207,50],[217,50],[207,60],[212,60],
            [217,60],[207,70],[217,70],[222,70],
            [291,12],[296,22],[301,12],[306,22],[291,32],[301,32],[291,42],[296,42],
            [301,42],[306,42],[291,52],[301,52],[306,52],
            [443,22],[448,32],[453,22],[458,32],[443,42],[453,42],[443,52],[448,52],
          ].map(([x,y],i) => (
            <rect key={i} x={x} y={y} width="4" height="6"
              fill={i%4===0?'#ffd090':i%4===1?'#ffe8b0':'#90b8ff'}
              opacity={0.55+((i*13)%10)*0.04}
              style={{ animation:`flicker ${2+i%5}s ease-in-out ${(i*0.28)%3}s infinite` }}/>
          ))}

          {/* Street glow at bottom */}
          <rect x="0" y="148" width="500" height="12" fill="url(#buildGrad)" opacity="0.8"/>
          {/* Street lights */}
          {[60,130,220,320,420].map((x,i) => (
            <g key={i}>
              <rect x={x} y="130" width="2" height="18" fill="#1a2040"/>
              <ellipse cx={x+1} cy="130" rx="12" ry="4" fill="rgba(255,200,100,0.15)"/>
              <circle  cx={x+1} cy="130" r="2" fill="#ffcc70" opacity="0.8"/>
            </g>
          ))}
        </svg>

        {/* Window reflection sheen */}
        <div style={{ position:'absolute', top:0, left:0, width:'8%', bottom:0,
          background:'linear-gradient(90deg, rgba(255,255,255,0.03), transparent)',
          pointerEvents:'none' }}/>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'5%',
          background:'linear-gradient(180deg, rgba(255,255,255,0.04), transparent)',
          pointerEvents:'none' }}/>
      </div>

      {/* Window frame outer molding */}
      <div style={{ position:'absolute', top:'4%', left:'2%', width:'44%', height:'74%',
        border:'3px solid #0e1428', borderRadius:6, pointerEvents:'none',
        boxShadow:'inset 0 0 0 2px rgba(255,255,255,0.03)' }}/>
      {/* Window sill */}
      <div style={{ position:'absolute', top:'77%', left:'2%', width:'44%', height:'2%',
        background:'linear-gradient(180deg, #1a2240, #131a30)',
        borderRadius:'0 0 4px 4px', boxShadow:'0 4px 12px rgba(0,0,0,0.5)' }}/>
      {/* Curtain left */}
      <div style={{ position:'absolute', top:'4%', left:'1.5%', width:'3%', height:'74%',
        background:'linear-gradient(90deg, #0e1428, #141e38 60%, transparent)',
        borderRadius:'3px 0 0 0' }}/>
      {/* Curtain right */}
      <div style={{ position:'absolute', top:'4%', left:'44.5%', width:'3%', height:'74%',
        background:'linear-gradient(270deg, #0e1428, #141e38 60%, transparent)',
        borderRadius:'0 3px 0 0' }}/>

      {/* Window ambient light spill on wall */}
      <div style={{ position:'absolute', top:'5%', left:'3%', width:'44%', height:'80%',
        background:'radial-gradient(ellipse at 50% 30%, rgba(100,150,255,0.05) 0%, transparent 70%)',
        pointerEvents:'none', animation:'ambGlow 5s ease-in-out infinite' }}/>
      {/* Floor light from window */}
      <div style={{ position:'absolute', bottom:'18%', left:'3%', width:'44%', height:'20%',
        background:'radial-gradient(ellipse at 50% 0%, rgba(80,120,220,0.08) 0%, transparent 80%)',
        pointerEvents:'none' }}/>

      {/* ═══ WALL ART / DIPLOMAS — right of window ═══ */}
      {/* Large framed artwork */}
      <div style={{ position:'absolute', top:'8%', left:'50%', width:'16%', height:'28%',
        background:'linear-gradient(145deg, #0c1025, #10162e)',
        border:'3px solid #1e2845', borderRadius:3,
        boxShadow:'0 8px 24px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.03)' }}>
        {/* Abstract art */}
        <div style={{ position:'absolute', inset:8, overflow:'hidden' }}>
          <div style={{ position:'absolute', top:'20%', left:'20%', width:'60%', height:'60%',
            borderRadius:'50%', background:'radial-gradient(circle, rgba(79,142,247,0.2), transparent)',
            border:'1px solid rgba(79,142,247,0.15)' }}/>
          <div style={{ position:'absolute', top:'35%', left:'10%', width:'80%', height:1,
            background:'rgba(79,142,247,0.2)' }}/>
          <div style={{ position:'absolute', top:'55%', left:'30%', width:'40%', height:1,
            background:'rgba(0,229,176,0.2)' }}/>
        </div>
        {/* Frame inner matte */}
        <div style={{ position:'absolute', inset:0, border:'6px solid #0e1428', pointerEvents:'none' }}/>
      </div>

      {/* Diploma 1 */}
      <div style={{ position:'absolute', top:'8%', left:'68%', width:'9%', height:'14%',
        background:'linear-gradient(145deg, #0c1025, #111728)',
        border:'2px solid #1c2440', borderRadius:2,
        boxShadow:'0 4px 16px rgba(0,0,0,0.6)' }}>
        <div style={{ position:'absolute', inset:4, border:'1px solid rgba(200,168,75,0.25)', borderRadius:1 }}>
          <div style={{ position:'absolute', top:'20%', left:'15%', right:'15%', height:1, background:'rgba(200,168,75,0.3)' }}/>
          <div style={{ position:'absolute', top:'50%', left:'15%', right:'15%', height:1, background:'rgba(200,168,75,0.2)' }}/>
          <div style={{ position:'absolute', top:'70%', left:'25%', right:'25%', height:1, background:'rgba(200,168,75,0.15)' }}/>
        </div>
      </div>
      {/* Diploma 2 */}
      <div style={{ position:'absolute', top:'24%', left:'68%', width:'9%', height:'12%',
        background:'linear-gradient(145deg, #0c1025, #111728)',
        border:'2px solid #1c2440', borderRadius:2,
        boxShadow:'0 4px 16px rgba(0,0,0,0.6)' }}>
        <div style={{ position:'absolute', inset:4, border:'1px solid rgba(79,142,247,0.2)', borderRadius:1 }}/>
      </div>

      {/* ═══ BOOKSHELF — right wall ═══ */}
      <div style={{ position:'absolute', top:'4%', right:'0', width:'9%', height:'72%',
        background:'linear-gradient(180deg, #151c30 0%, #0f1625 100%)',
        borderLeft:'3px solid #1c2440',
        boxShadow:'-6px 0 24px rgba(0,0,0,0.7)' }}>
        {/* Shelf planks */}
        {[20, 40, 60, 80].map(pct => (
          <div key={pct} style={{ position:'absolute', left:0, right:0, top:`${pct}%`, height:4,
            background:'linear-gradient(90deg, #2a3460, #1e2848)',
            boxShadow:'0 3px 6px rgba(0,0,0,0.5)' }}/>
        ))}
        {/* Books per shelf */}
        {[
          {top:'4%',  cols:['#8b1a3a','#1a5c8b','#2a7a3a','#6a3a8b','#8b5a1a']},
          {top:'24%', cols:['#1a3a8b','#8b3a2a','#3a6a2a','#8b6a1a','#4a1a8b']},
          {top:'44%', cols:['#6a1a4a','#1a5a6a','#8b4a1a','#1a7a5a','#5a1a8b']},
          {top:'64%', cols:['#2a6a8b','#8b2a5a','#4a8b2a','#8b7a1a','#2a4a8b']},
        ].map((shelf,si) => (
          <div key={si} style={{ position:'absolute', top:shelf.top, left:4, right:4, height:'15%',
            display:'flex', alignItems:'flex-end', gap:1 }}>
            {shelf.cols.map((c,i) => (
              <div key={i} style={{ flex:1, height:`${65+((si*5+i*8)%35)}%`,
                background:`linear-gradient(180deg, ${c}, ${c}cc)`,
                borderRadius:'2px 2px 0 0',
                boxShadow:`inset -1px 0 0 rgba(0,0,0,0.4), inset 0 0 0 0.5px rgba(255,255,255,0.06)` }}/>
            ))}
            {/* Small ornament */}
            <div style={{ width:8, height:8, borderRadius:'50%',
              background:`radial-gradient(circle, ${shelf.cols[0]}88, transparent)`,
              border:`1px solid ${shelf.cols[0]}44`, marginBottom:2 }}/>
          </div>
        ))}
      </div>

      {/* ═══ FLOOR ═══ */}
      {/* Floor base */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'20%',
        background:'linear-gradient(180deg, #0c1020 0%, #070a14 100%)' }}>
        {/* Polished floor tiles */}
        <div style={{ position:'absolute', inset:0, opacity:0.08,
          backgroundImage:'repeating-linear-gradient(90deg, transparent, transparent 79px, #6688bb 80px)',
          backgroundSize:'80px 100%' }}/>
        {/* Floor reflection of window */}
        <div style={{ position:'absolute', top:0, left:'3%', width:'44%', height:'100%',
          background:'linear-gradient(180deg, rgba(79,142,247,0.04), transparent)',
          pointerEvents:'none' }}/>
      </div>

      {/* ═══ DESK — executive mahogany ═══ */}
      {/* Desk surface */}
      <div style={{ position:'absolute', bottom:'18%', left:'-5%', right:'-5%', height:'5%',
        background:'linear-gradient(180deg, #7a3e1a 0%, #5e2e0e 50%, #4a2208 100%)',
        boxShadow:'0 10px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(200,130,70,0.25), 0 -1px 0 rgba(180,100,40,0.15)' }}>
        {/* Surface shine streak */}
        <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:1,
          background:'linear-gradient(90deg, transparent, rgba(220,160,90,0.35), rgba(220,160,90,0.5), rgba(220,160,90,0.35), transparent)' }}/>
        {/* Wood grain lines */}
        {[15,35,55,75].map(p=>(
          <div key={p} style={{ position:'absolute', top:'20%', left:`${p}%`, width:'8%', height:1,
            background:'rgba(0,0,0,0.2)', borderRadius:1 }}/>
        ))}
      </div>
      {/* Desk front panel */}
      <div style={{ position:'absolute', bottom:'8%', left:'-5%', right:'-5%', height:'12%',
        background:'linear-gradient(180deg, #4a2208 0%, #3a1a06 100%)',
        boxShadow:'0 4px 20px rgba(0,0,0,0.8)' }}/>
      {/* Desk legs */}
      {[-3, 85].map((l,i) => (
        <div key={i} style={{ position:'absolute', bottom:'8%', left:`${l}%`, width:'8%', height:'10%',
          background:'linear-gradient(90deg, #3a1a06, #2e1404)',
          boxShadow:'inset -2px 0 4px rgba(0,0,0,0.4)' }}/>
      ))}

      {/* ═══ DESK OBJECTS ═══ */}
      {/* Monitor */}
      <div style={{ position:'absolute', bottom:'22%', left:'8%', width:'18%' }}>
        {/* Screen */}
        <div style={{ width:'100%', paddingBottom:'62%', position:'relative',
          background:'#0a1428', border:'3px solid #1a2445',
          borderRadius:'5px 5px 0 0',
          boxShadow:'0 -4px 20px rgba(79,142,247,0.3), 0 0 40px rgba(79,142,247,0.08)' }}>
          {/* Screen content */}
          <div style={{ position:'absolute', inset:'6%', background:'#06101e', borderRadius:2,
            backgroundImage:'linear-gradient(135deg, rgba(79,142,247,0.06) 0%, transparent 60%)',
            overflow:'hidden' }}>
            {/* Fake data on screen */}
            {[10,25,40,55,70,85].map(t=>(
              <div key={t} style={{ position:'absolute', top:`${t}%`, left:'8%', right:'8%', height:2,
                background:`rgba(79,142,247,${0.15+((t/10)%3)*0.08})`, borderRadius:1 }}/>
            ))}
            <div style={{ position:'absolute', top:'15%', left:'8%', width:'40%', height:'30%',
              border:'1px solid rgba(79,142,247,0.12)', borderRadius:2,
              background:'rgba(79,142,247,0.04)' }}/>
          </div>
          {/* Screen glare */}
          <div style={{ position:'absolute', top:0, left:0, width:'35%', height:'50%',
            background:'linear-gradient(135deg, rgba(255,255,255,0.04), transparent)',
            pointerEvents:'none' }}/>
          {/* Monitor glow on desk */}
          <div style={{ position:'absolute', bottom:'-160%', left:'-20%', right:'-20%', height:'160%',
            background:'radial-gradient(ellipse at 50% 0%, rgba(79,142,247,0.12) 0%, transparent 70%)',
            pointerEvents:'none', animation:'monitorGlow 4s ease-in-out infinite' }}/>
        </div>
        {/* Monitor neck */}
        <div style={{ height:6, background:'#141e35', borderBottom:'2px solid #0e1428' }}/>
        <div style={{ width:'45%', height:4, margin:'0 auto', background:'#141e35', borderRadius:'0 0 3px 3px' }}/>
      </div>

      {/* Keyboard */}
      <div style={{ position:'absolute', bottom:'19.5%', left:'14%', width:'12%', height:'2.5%',
        background:'linear-gradient(180deg, #1a2240, #141c35)',
        border:'1px solid #252d4a', borderRadius:2,
        boxShadow:'0 2px 8px rgba(0,0,0,0.6)',
        backgroundImage:'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(79,142,247,0.04) 9px)' }}/>

      {/* Notebook / legal pad */}
      <div style={{ position:'absolute', bottom:'19%', right:'18%', width:'10%', height:'4%',
        background:'linear-gradient(180deg, #f5f0e0, #e8e0cc)',
        border:'1px solid #d0c8a8', borderRadius:2,
        transform:'perspective(300px) rotateX(-10deg) rotate(-2deg)',
        boxShadow:'2px 3px 12px rgba(0,0,0,0.6)' }}>
        {[20,40,60,75].map(p=>(
          <div key={p} style={{ position:'absolute', top:`${p}%`, left:'8%', right:'8%', height:1,
            background:'rgba(100,130,200,0.3)' }}/>
        ))}
        {/* Pen */}
        <div style={{ position:'absolute', top:'-15%', right:'-8%', width:'3%', height:'130%',
          background:'linear-gradient(90deg, #c0c0c0, #a0a0a0)',
          borderRadius:1, transform:'rotate(8deg)' }}/>
      </div>

      {/* Coffee mug */}
      <div style={{ position:'absolute', bottom:'19.8%', right:'12%', width:18, height:22,
        background:'linear-gradient(180deg, #1e2845, #161e38)',
        borderRadius:'3px 3px 5px 5px', border:'1px solid #2a3460',
        boxShadow:'0 3px 10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        {/* Coffee surface */}
        <div style={{ position:'absolute', top:2, left:2, right:2, height:4,
          background:'linear-gradient(180deg, #3d2010, #2a1508)', borderRadius:1 }}/>
        {/* Steam */}
        <div style={{ position:'absolute', top:-12, left:'30%',
          width:2, height:10, background:'rgba(200,200,200,0.15)',
          borderRadius:2, animation:'floatAnim 2s ease-in-out infinite' }}/>
        <div style={{ position:'absolute', top:-10, left:'60%',
          width:2, height:8, background:'rgba(200,200,200,0.1)',
          borderRadius:2, animation:'floatAnim 2.5s ease-in-out 0.5s infinite' }}/>
        {/* Handle */}
        <div style={{ position:'absolute', right:-7, top:4, width:7, height:10,
          border:'2px solid #2a3460', borderLeft:'none',
          borderRadius:'0 4px 4px 0' }}/>
      </div>

      {/* Phone */}
      <div style={{ position:'absolute', bottom:'19.5%', right:'24%', width:10, height:18,
        background:'linear-gradient(180deg, #1a2238, #131a2e)',
        border:'1px solid #252d45', borderRadius:2,
        boxShadow:'0 2px 8px rgba(0,0,0,0.5)' }}>
        <div style={{ position:'absolute', top:2, left:2, right:2, height:11,
          background:'#0a1020', borderRadius:1, opacity:0.9 }}/>
      </div>

      {/* Small plant / succulent */}
      <div style={{ position:'absolute', bottom:'19.5%', left:'4%' }}>
        {/* Pot */}
        <div style={{ width:18, height:14, background:'linear-gradient(180deg,#8b4e28,#6b3a1e)',
          borderRadius:'2px 2px 4px 4px', border:'1px solid #a06030' }}/>
        {/* Plant */}
        <div style={{ position:'absolute', bottom:'60%', left:'50%', transform:'translateX(-50%)',
          width:24, height:20 }}>
          {[[-8,-10,22],[0,-14,28],[8,-10,22],[-14,-5,16],[14,-5,16]].map(([x,y,r],i)=>(
            <div key={i} style={{ position:'absolute', left:`calc(50% + ${x}px)`, top:`calc(50% + ${y}px)`,
              width:r, height:r*0.6, borderRadius:'50%',
              background:'linear-gradient(135deg, #2a6a3a, #1a4a28)',
              transform:'rotate(-10deg)' }}/>
          ))}
        </div>
      </div>

      {/* ═══ AMBIENT LIGHTING OVERLAYS ═══ */}
      {/* Window light cast on wall */}
      <div style={{ position:'absolute', top:'5%', left:'3%', width:'42%', height:'76%',
        background:'linear-gradient(90deg, rgba(100,150,255,0.04) 0%, transparent 100%)',
        pointerEvents:'none' }}/>
      {/* Ceiling light halos */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'40%',
        background:'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(180,200,255,0.04) 0%, transparent 100%)',
        pointerEvents:'none' }}/>
      {/* Monitor light on ceiling */}
      <div style={{ position:'absolute', bottom:'22%', left:'8%', width:'20%', height:'30%',
        background:'radial-gradient(ellipse at 50% 100%, rgba(79,142,247,0.1) 0%, transparent 70%)',
        pointerEvents:'none', animation:'monitorGlow 4s ease-in-out infinite' }}/>
      {/* Deep corner shadows */}
      <div style={{ position:'absolute', inset:0,
        background:'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, rgba(0,0,0,0.6) 100%)',
        pointerEvents:'none' }}/>

      {/* ═══ SPEAKING PULSE RINGS ═══ */}
      {speaking && (
        <>
          {[0, 0.6, 1.2].map((delay,i) => (
            <div key={i} style={{ position:'absolute', top:'48%', left:'50%',
              width:300, height:300, borderRadius:'50%',
              border:`${2-i*0.5}px solid ${C.primary}`,
              opacity:0, animation:`speakRing 2.2s ease-out ${delay}s infinite`,
              pointerEvents:'none' }}/>
          ))}
        </>
      )}

      {/* ═══ HUD SCAN LINE (subtle tech feel) ═══ */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px',
        background:`linear-gradient(90deg, transparent, ${C.primary}22, transparent)`,
        animation:'scanline 8s linear infinite', pointerEvents:'none' }}/>

    </div>
  );
}

/* ─── Main Component ─── */

export default function AIInterviewRoom({ application, onClose, onComplete }) {
  const [phase, setPhase]           = useState('loading'); // loading|intro|interview|thinking|report
  const [reportId, setReportId]     = useState(null);
  const [questions, setQuestions]   = useState([]);
  const [qIndex, setQIndex]         = useState(0);
  const [alexSpeaking, setAlexSpeaking] = useState(false);
  const [alexText, setAlexText]     = useState('');
  const [transcript, setTranscript] = useState([]);
  const [recording, setRecording]   = useState(false);
  const [userText, setUserText]     = useState('');
  const [answerText, setAnswerText] = useState('');
  const [lastScore, setLastScore]   = useState(null);
  const [report, setReport]         = useState(null);
  const [error, setError]           = useState('');
  const [timer, setTimer]           = useState(0);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [micPermission, setMicPermission]   = useState('unknown');
  const [readyCountdown, setReadyCountdown] = useState(0); // seconds after Alex finishes before mic opens

  const recRef     = useRef(null);
  const synthRef   = useRef(null);
  const timerRef   = useRef(null);
  const transcriptRef = useRef(null);
  const introPlayed    = useRef(false);
  const startedRef    = useRef(false); // prevents double-fire in React 18 Strict Mode
  const submittingRef = useRef(false); // prevents double answer submission

  const jobTitle = application?.jobId?.title || application?.jobTitle || 'the position';
  const company  = application?.jobId?.company || application?.company || '';
  const candidateName = application?.applicantId?.username || application?.candidateName || 'Candidate';

  /* ── Voice setup ── */
  useEffect(() => {
    if ('speechSynthesis' in window) { synthRef.current = window.speechSynthesis; setVoiceSupported(true); }
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.continuous      = true;   // keep listening until user stops
      rec.interimResults  = true;   // show live transcript
      rec.maxAlternatives = 3;      // consider multiple interpretations, pick best
      rec.lang            = 'en-US';

      let finalTranscript = '';
      let silenceTimer    = null;

      rec.onresult = (e) => {
        let interim = '';
        finalTranscript = '';
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            finalTranscript += e.results[i][0].transcript + ' ';
          } else {
            interim += e.results[i][0].transcript;
          }
        }
        const fullText = (finalTranscript + interim).trim();
        setUserText(fullText);
        setAnswerText(finalTranscript.trim());

        // Reset silence timer — if user stops speaking for 2.5s, mark as done
        clearTimeout(silenceTimer);
        if (finalTranscript.trim().length > 0) {
          silenceTimer = setTimeout(() => {
            setAnswerText(finalTranscript.trim());
            setUserText(finalTranscript.trim());
          }, 2500);
        }
      };

      rec.onerror = (e) => {
        if (e.error === 'not-allowed') { setMicPermission('denied'); return; }
        if (e.error === 'no-speech')   { return; } // ignore silence errors
        if (e.error === 'aborted')     { return; } // ignore manual stops
        console.warn('Speech recognition error:', e.error);
        setRecording(false);
      };

      rec.onend = () => {
        // If still in recording state, restart (handles browser auto-stop on silence)
        setRecording(prev => {
          if (prev) {
            try { rec.start(); } catch {}
            return true;
          }
          return false;
        });
      };

      recRef.current = rec;
    }
    return () => { stopSpeaking(); clearInterval(timerRef.current); };
  }, []);

  /* ── Timer ── */
  useEffect(() => {
    if (phase === 'interview') {
      timerRef.current = setInterval(() => setTimer(p => p + 1), 1000);
    } else { clearInterval(timerRef.current); }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  /* ── Auto-scroll transcript ── */
  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [transcript]);

  /* ── Start interview on mount ── */
  useEffect(() => { startInterview(); }, []);

  const stopSpeaking = () => { if (synthRef.current) synthRef.current.cancel(); setAlexSpeaking(false); };

  const speak = useCallback((text, onEnd) => {
    if (!synthRef.current || !voiceSupported) { setAlexSpeaking(false); onEnd && onEnd(); return; }
    stopSpeaking();

    // Add natural pauses: replace sentence endings with pause markers
    const pausedText = text
      .replace(/\.\s+/g, '.  ')        // pause after periods
      .replace(/\?\s+/g, '?  ')        // pause after questions
      .replace(/!\s+/g, '!  ')         // pause after exclamations
      .replace(/,\s+/g, ', ')          // slight pause after commas
      .replace(/:\s+/g, ':  ')         // pause after colons
      .replace(/—/g,    ',  ')         // pause at em-dashes
      .replace(/\d+\.\s/g, m => m + ' '); // pause after numbered lists

    const utt        = new SpeechSynthesisUtterance(pausedText);
    utt.rate         = 0.92;  // slightly faster — natural conversational pace
    utt.pitch        = 0.90;  // slightly deeper — professional male voice
    utt.volume       = 1.0;

    // Voice priority: prefer high-quality natural voices
    const voices = synthRef.current.getVoices();
    const preferred = (
      voices.find(v => v.name === 'Google UK English Male')  ||
      voices.find(v => v.name === 'Daniel')                  || // macOS
      voices.find(v => v.name === 'Alex')                    || // macOS
      voices.find(v => v.name.includes('Google') && v.lang === 'en-US') ||
      voices.find(v => v.name.includes('Microsoft') && v.lang === 'en-US' && v.name.includes('Guy')) ||
      voices.find(v => v.lang === 'en-US' && v.localService) ||
      voices.find(v => v.lang === 'en-GB')                   ||
      voices.find(v => v.lang.startsWith('en'))
    );
    if (preferred) utt.voice = preferred;

    utt.onstart = () => setAlexSpeaking(true);
    utt.onend   = () => {
      setAlexSpeaking(false);
      // Give user 2 seconds to prepare after Alex finishes speaking
      setReadyCountdown(2);
      const cd = setInterval(() => {
        setReadyCountdown(prev => {
          if (prev <= 1) { clearInterval(cd); return 0; }
          return prev - 1;
        });
      }, 1000);
      if (onEnd) setTimeout(onEnd, 400);
    };
    utt.onerror = (e) => {
      if (e.error !== 'interrupted') console.warn('TTS error:', e.error);
      setAlexSpeaking(false);
      if (onEnd) onEnd();
    };

    // Chrome bug: long utterances silently stop — keep synthesis alive
    const keepAlive = setInterval(() => {
      if (synthRef.current?.speaking) {
        synthRef.current.pause();
        synthRef.current.resume();
      } else {
        clearInterval(keepAlive);
      }
    }, 10000);

    synthRef.current.speak(utt);
  }, [voiceSupported]);

  const startInterview = async () => {
    if (startedRef.current) return; // prevent double-fire (React 18 Strict Mode)
    startedRef.current = true;
    try {
      setPhase('loading');
      const appId = application?._id || application?.applicationId;
      if (!appId) throw new Error('No applicationId — cannot start interview.');

      const r = await fetch(`${API}/interview/start`, {
        method: 'POST', headers: hdrs(), body: JSON.stringify({ applicationId: appId })
      });

      // Guard: server might return HTML on crash/404
      const contentType = r.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await r.text();
        throw new Error(`Backend error (${r.status}): ${text.slice(0, 120)}`);
      }

      const data = await r.json();
      if (!r.ok) throw new Error(data.message || `HTTP ${r.status}`);
      setReportId(data.reportId);
      setQuestions(data.questions || []);

      const introMsg = data.intro || `Hello ${candidateName}! I'm Alex, your AI interviewer today for the ${jobTitle} role${company ? ' at ' + company : ''}. I'll ask you ${(data.questions||[]).length} questions. Please speak clearly when answering. Ready? Let's begin.`;
      setAlexText(introMsg);
      setPhase('intro');
      if (!introPlayed.current) {
        introPlayed.current = true;
        setTimeout(() => speak(introMsg, () => {
          setPhase('interview');
          askQuestion(0, data.questions);
        }), 800);
      }
    } catch (err) {
      console.error('[AIInterviewRoom] startInterview error:', err);
      setError(err.message);
      setPhase('error');
    }
  };

  const lastAskedIdx = useRef(-1); // prevent same question being asked twice

  const askQuestion = useCallback((idx, qs) => {
    const qList = qs || questions;
    if (idx >= qList.length) return;
    if (idx === lastAskedIdx.current) return; // deduplicate
    lastAskedIdx.current = idx;

    const q = qList[idx];

    // Build natural spoken question with transition phrase
    const transitions = [
      `Alright, question ${idx + 1} of ${qList.length}.`,
      `Moving on. Question ${idx + 1}.`,
      `Good. Here is question ${idx + 1}.`,
      `Next question — number ${idx + 1} of ${qList.length}.`,
    ];
    const prefix = idx === 0 ? `Let's begin. Question 1.` : transitions[idx % transitions.length];
    const qText  = `${prefix}  ${q.question}`;

    setAlexText(q.question);
    setTranscript(p => {
      // Deduplicate: don't add if last message is already this question
      const last = p[p.length - 1];
      if (last && last.role === 'alex' && last.text === q.question) return p;
      return [...p, { role:'alex', text: q.question }];
    });
    setAnswerText('');
    setUserText('');
    setLastScore(null);
    setPhase('interview');
    speak(qText);
  }, [questions, speak]);

  const startRecording = () => {
    if (!recRef.current) { setError('Speech recognition not supported. Please type your answer below.'); return; }
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(() => {
        setMicPermission('granted');
        setUserText('');
        setAnswerText('');
        setRecording(true);
        try { recRef.current.start(); } catch {}
      })
      .catch(() => { setMicPermission('denied'); setError('Microphone access denied. Please type your answer.'); });
  };

  const stopRecording = () => {
    setRecording(false); // set false FIRST so onend handler does not auto-restart
    if (recRef.current) { try { recRef.current.stop(); } catch {} }
  };

  // Stop recording and submit — waits 700ms for final transcript to settle before submitting
  const stopAndSubmit = () => {
    setRecording(false);
    if (recRef.current) { try { recRef.current.stop(); } catch {} }
    setTimeout(() => {
      setAnswerText(prev => {
        const finalAnswer = prev.trim() || userText.trim();
        if (finalAnswer) submitAnswer(finalAnswer);
        return prev;
      });
    }, 700);
  };

  const submitAnswer = async (answer) => {
    if (submittingRef.current) return; // prevent double submit
    submittingRef.current = true;

    // Use best available transcript — prefer passed answer, fallback to userText
    const finalAnswer = (answer || '').trim() || userText.trim();
    if (!finalAnswer) { submittingRef.current = false; return; }
    const q = questions[qIndex];
    if (!q) { submittingRef.current = false; return; }
    stopRecording();
    stopSpeaking();
    setPhase('thinking');
    setTranscript(p => {
      // Deduplicate — don't add if last message is already this answer
      const last = p[p.length - 1];
      if (last && last.role === 'candidate' && last.text === finalAnswer) return p;
      return [...p, { role:'candidate', text: finalAnswer }];
    });
    setAnswerText('');
    setUserText('');

    try {
      const r = await fetch(`${API}/interview/answer`, {
        method:'POST', headers: hdrs(),
        body: JSON.stringify({ reportId, question: q.question, answer: finalAnswer, questionIndex: qIndex, totalQuestions: questions.length })
      });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error(`Server error ${r.status}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || `HTTP ${r.status}`);

      setLastScore(data.score);
      const responseText = data.nextMessage || data.feedback;
      setAlexText(responseText);
      setTranscript(p => {
        const last = p[p.length - 1];
        if (last && last.role === 'alex' && last.text === responseText) return p;
        return [...p, { role:'alex', text: responseText, score: data.score }];
      });

      const nextIdx = qIndex + 1;
      setQIndex(nextIdx);
      submittingRef.current = false; // unlock for next answer

      if (nextIdx >= questions.length) {
        setPhase('interview');
        speak(responseText, () => completeInterview());
      } else {
        setPhase('interview');
        speak(responseText, () => {
          setTimeout(() => askQuestion(nextIdx, questions), 800);
        });
      }
    } catch (err) {
      submittingRef.current = false; // unlock on error too
      setError(err.message);
      setPhase('interview');
    }
  };

  const completeInterview = async () => {
    setPhase('thinking');
    setAlexText('Compiling your performance report... This will take a moment.');
    try {
      const r = await fetch(`${API}/interview/complete`, {
        method:'POST', headers: hdrs(), body: JSON.stringify({ reportId })
      });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error(`Server error ${r.status}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || `HTTP ${r.status}`);
      // Backend returns { report: {...}, transcript: [...] }
      const rpt = data.report || data;
      setReport(rpt);
      setPhase('report');
      // Auto-save: immediately notify parent (recruiter gets report, job seeker sees scores)
      if (onComplete) setTimeout(() => onComplete(rpt), 100);
      // Speak a warm closing — don't mention recommendation to candidate
      speak(`Your interview is complete! You scored ${rpt.overallScore} out of 100. Your report has been saved and sent to the recruiter. Thank you for your time today. Good luck!`);
    } catch (err) {
      setError(err.message);
      setPhase('report');
    }
  };

  const fmtTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const recColor = {
    'Strong Hire': C.accent,
    'Hire':        '#4ade80',
    'Maybe':       C.amber,
    'No Hire':     C.red,
  };

  /* ── Render ── */
  return (
    <div className="air-root" style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', flexDirection:'column', background:C.bg }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Top Bar ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 28px',
        borderBottom:`1px solid ${C.border}`,
        background:'linear-gradient(90deg, rgba(7,10,18,0.99) 0%, rgba(10,14,26,0.99) 100%)',
        backdropFilter:'blur(20px)',
        flexShrink:0, zIndex:100,
        boxShadow:'0 1px 0 rgba(255,255,255,0.04)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          {/* Brand mark */}
          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
            <div style={{ width:3, height:24, background:`linear-gradient(180deg,${C.primary},${C.accent})`, borderRadius:2 }}/>
            <div style={{ width:3, height:18, background:`linear-gradient(180deg,${C.primary},${C.accent})`, borderRadius:2, opacity:0.6 }}/>
            <div style={{ width:3, height:12, background:`linear-gradient(180deg,${C.primary},${C.accent})`, borderRadius:2, opacity:0.35 }}/>
          </div>
          <div>
            <div style={{ fontFamily:'Outfit', fontWeight:700, fontSize:15, color:C.text, letterSpacing:'0.01em' }}>
              AI Interview Room
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:1, fontWeight:400 }}>
              {jobTitle}{company ? <span style={{ color:C.muted2 }}> · {company}</span> : ''}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          {phase === 'interview' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div className="rec-dot" style={{ width:8, height:8, borderRadius:'50%', background:C.red }}/>
                <span style={{ fontSize:12, color:C.red, fontWeight:600, fontFamily:'Syne' }}>REC</span>
              </div>
              <span style={{ fontSize:13, fontFamily:'Syne', color:C.muted2, letterSpacing:'0.08em' }}>{fmtTime(timer)}</span>
              <span style={{ fontSize:12, color:C.muted, background:C.card, padding:'3px 10px', borderRadius:20, border:`1px solid ${C.border}` }}>
                Q {Math.min(qIndex + 1, questions.length)} / {questions.length}
              </span>
            </>
          )}
          <button onClick={() => { stopSpeaking(); stopRecording(); onClose && onClose(); }}
            style={{ background:'none', border:`1px solid ${C.border2}`, color:C.muted2, cursor:'pointer', borderRadius:8, padding:'6px 14px', fontSize:13, fontWeight:600, transition:'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=C.red; e.currentTarget.style.color=C.red; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=C.border2; e.currentTarget.style.color=C.muted2; }}>
            ✕ Exit
          </button>
        </div>
      </div>

      {/* ── Main Area — FULLSCREEN VIRTUAL ROOM ── */}
      <div style={{ flex:1, position:'relative', overflow:'hidden', background:'#070a12' }}>

        {/* Full-bleed virtual room */}
        <VirtualRoom speaking={alexSpeaking} phase={phase}/>

        {/* Alex avatar — centered, sits above desk */}
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'flex-end', justifyContent:'center', paddingBottom:'18%', pointerEvents:'none', zIndex:2 }}>
          <div style={{ position:'relative' }}>
            {alexSpeaking && (
              <div style={{ position:'absolute', bottom:-20, left:'50%', transform:'translateX(-50%)',
                width:240, height:60, background:`radial-gradient(ellipse,${C.pGlow} 0%,transparent 70%)`,
                animation:'ambGlow 1.5s ease-in-out infinite' }}/>
            )}
            <AlexAvatar speaking={alexSpeaking} size={320}/>
          </div>
        </div>

        {/* Nameplate on desk */}
        <div style={{ position:'absolute', bottom:'19%', left:'50%', transform:'translateX(-50%)', zIndex:3,
          background:'linear-gradient(135deg,rgba(7,10,18,0.96),rgba(10,14,26,0.96))',
          backdropFilter:'blur(12px)', border:'1px solid rgba(200,168,75,0.35)',
          borderRadius:3, padding:'5px 22px', whiteSpace:'nowrap',
          boxShadow:'0 4px 16px rgba(0,0,0,0.8), inset 0 1px 0 rgba(200,168,75,0.1)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:1, height:14, background:'rgba(200,168,75,0.5)' }}/>
            <span style={{ fontSize:10, color:C.gold, fontWeight:700, fontFamily:'Outfit', letterSpacing:'0.18em' }}>ALEX · AI INTERVIEWER</span>
            <div style={{ width:1, height:14, background:'rgba(200,168,75,0.5)' }}/>
          </div>
        </div>

        {/* ══ QUESTION CARD — Unity-style dark lower-third ══ */}
        {phase !== 'report' && alexText && (
          <div className="fade-in" style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:10,
            background:'linear-gradient(180deg, rgba(4,6,14,0) 0%, rgba(4,6,14,0.85) 18%, rgba(4,6,14,0.97) 100%)',
            paddingTop:40 }}>

            {/* Card inner */}
            <div style={{ margin:'0 0', padding:'16px 32px 20px',
              borderTop:`3px solid ${
                phase==='thinking' ? C.primary :
                questions[qIndex]?.type==='technical' ? C.amber :
                questions[qIndex]?.type==='behavioral' ? C.accent :
                C.primary}`,
              background:'rgba(5,8,18,0.92)',
              backdropFilter:'blur(20px)' }}>

              {/* Card top row — label + progress */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:4, height:4, borderRadius:'50%',
                    background: phase==='thinking' ? C.primary : questions[qIndex]?.type==='technical' ? C.amber : C.primary,
                    boxShadow:`0 0 6px ${C.primary}` }}/>
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.18em', fontFamily:'Outfit',
                    color: phase==='thinking' ? C.primary+'cc' :
                      questions[qIndex]?.type==='technical' ? C.amber+'cc' :
                      questions[qIndex]?.type==='behavioral' ? C.accent+'cc' :
                      C.primary+'cc' }}>
                    {phase==='thinking' ? 'ANALYZING...' :
                     phase==='interview' ? `${(questions[qIndex]?.type||'QUESTION').toUpperCase()}  ·  Q${Math.min(qIndex+1,questions.length)} / ${questions.length}` :
                     'ALEX'}
                  </span>
                </div>
                {/* Mini waveform when speaking */}
                {alexSpeaking && <Waveform active={true}/>}
                {/* Answer timer pill */}
                {phase==='interview' && readyCountdown > 0 && (
                  <div style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 10px',
                    background:'rgba(255,176,32,0.1)', border:'1px solid rgba(255,176,32,0.3)',
                    borderRadius:20 }}>
                    <span style={{ fontSize:11, color:C.amber, fontWeight:700 }}>⏱ {readyCountdown}s</span>
                  </div>
                )}
              </div>

              {/* Main question text */}
              <p style={{ fontSize:20, fontWeight:500, color:C.text, margin:0, lineHeight:1.55,
                fontFamily:'Outfit', letterSpacing:'0.01em', maxWidth:'85%' }}>
                "{alexText}"
              </p>
            </div>
          </div>
        )}

        {/* ══ MIC / INPUT PANEL — bottom overlay ══ */}
        {phase === 'interview' && (
          <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:20,
            background:'rgba(4,6,14,0.97)', backdropFilter:'blur(20px)',
            borderTop:`1px solid ${C.border2}`,
            padding:'14px 32px 18px' }}>

            {error && (
              <div style={{ marginBottom:10, padding:'8px 14px',
                background:'rgba(255,61,85,0.1)', border:`1px solid ${C.red}44`,
                borderRadius:8, fontSize:12, color:C.red }}>{error}</div>
            )}

            {/* Live transcript display */}
            {(recording || userText) && (
              <div style={{ marginBottom:12, padding:'10px 16px',
                background:'rgba(255,255,255,0.03)', border:`1px solid ${C.primary}33`,
                borderRadius:8, display:'flex', alignItems:'center', gap:10, minHeight:40 }}>
                {recording && <Waveform active={true}/>}
                <p style={{ fontSize:13, color:recording ? C.text : C.muted2, margin:0, flex:1, fontStyle:'italic' }}>
                  {userText || <em style={{ color:C.muted }}>Speak now...</em>}
                </p>
              </div>
            )}

            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              {/* Status label */}
              <div style={{ fontSize:12, color: alexSpeaking ? C.amber : readyCountdown>0 ? C.amber : recording ? C.accent : C.muted,
                fontWeight:600, minWidth:220, fontFamily:'Outfit' }}>
                {alexSpeaking ? '🔊 Alex is speaking...'
                  : readyCountdown > 0 ? `⏱ Starting in ${readyCountdown}s...`
                  : recording ? (userText ? '✅ Speaking — click Stop when done' : '🎙 Listening...')
                  : '👆 Click mic to answer'}
              </div>

              {/* Mic button */}
              {('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && micPermission !== 'denied' && (
                <button
                  onClick={recording ? stopAndSubmit : startRecording}
                  disabled={alexSpeaking || readyCountdown > 0}
                  style={{ flex:1, padding:'12px 20px', borderRadius:10, border:'none',
                    cursor:(alexSpeaking||readyCountdown>0) ? 'not-allowed' : 'pointer',
                    fontWeight:700, fontSize:14, fontFamily:'Outfit', letterSpacing:'0.04em',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                    transition:'all 0.25s',
                    background: recording
                      ? `linear-gradient(135deg,${C.red},#cc2030)`
                      : (alexSpeaking||readyCountdown>0) ? C.border
                      : `linear-gradient(135deg,${C.primary},#3a6dd4)`,
                    color:'white',
                    opacity:(alexSpeaking||readyCountdown>0) ? 0.4 : 1,
                    boxShadow: recording ? `0 0 20px ${C.red}55` : (alexSpeaking||readyCountdown>0) ? 'none' : `0 4px 20px rgba(79,142,247,0.4)` }}>
                  {recording ? <><Waveform active={true}/><span>Stop &amp; Submit</span></>
                    : alexSpeaking ? <><span>🔊</span><span>Wait...</span></>
                    : readyCountdown>0 ? <><span>⏱</span><span>Ready in {readyCountdown}...</span></>
                    : <><span style={{fontSize:18}}>🎙</span><span>Start Speaking</span></>}
                </button>
              )}

              {/* Text fallback + manual submit */}
              {(micPermission==='denied' || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) && (
                <textarea value={answerText} onChange={e=>setAnswerText(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={2}
                  style={{ flex:1, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border2}`,
                    borderRadius:10, padding:'10px 14px', color:C.text, fontSize:13, resize:'none',
                    outline:'none', fontFamily:'Outfit' }}/>
              )}
              {!recording && (answerText||userText) && (
                <button onClick={()=>submitAnswer(answerText||userText)}
                  style={{ padding:'12px 24px', borderRadius:10, border:'none', cursor:'pointer',
                    fontWeight:700, fontSize:14, fontFamily:'Outfit',
                    background:`linear-gradient(135deg,${C.accent},#00a070)`,
                    color:'#040a10', boxShadow:`0 4px 16px ${C.aGlow}`, whiteSpace:'nowrap' }}>
                  Submit ✓
                </button>
              )}
            </div>
            {recording && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, fontSize:11, color:C.red }}>
                <div style={{ width:6,height:6,borderRadius:'50%',background:C.red,animation:'pulse-dot 1s infinite' }}/>
                Recording — speak naturally
              </div>
            )}
          </div>
        )}

        {/* ══ SCORE BADGE — top right ══ */}
        {lastScore !== null && phase === 'interview' && (
          <div className="pop-in" style={{ position:'absolute', top:16, right:16, zIndex:15,
            padding:'12px 18px', borderRadius:14,
            background:'rgba(4,6,14,0.92)', backdropFilter:'blur(12px)',
            border:`1px solid ${lastScore>=7?C.accent:lastScore>=5?C.amber:C.red}55`,
            boxShadow:`0 4px 24px ${lastScore>=7?C.aGlow:lastScore>=5?'rgba(255,176,32,0.3)':'rgba(255,61,85,0.3)'}`,
            display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:28, fontFamily:'Outfit', fontWeight:900, lineHeight:1,
                color:lastScore>=7?C.accent:lastScore>=5?C.amber:C.red }}>
                {lastScore}<span style={{ fontSize:13, fontWeight:400, opacity:0.55 }}>/10</span>
              </div>
              <div style={{ fontSize:10, color:C.muted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', marginTop:2 }}>
                {lastScore>=9?'🔥 Outstanding':lastScore>=7?'✓ Strong':lastScore>=5?'~ OK':'✗ Weak'}
              </div>
            </div>
          </div>
        )}

        {/* ══ PROGRESS SIDEBAR — right edge glass panel ══ */}
        {phase !== 'report' && (
          <div style={{ position:'absolute', top:0, right:0, bottom:0, width:220, zIndex:8,
            background:'linear-gradient(180deg,rgba(4,6,14,0.88) 0%,rgba(4,6,14,0.75) 100%)',
            backdropFilter:'blur(16px)',
            borderLeft:`1px solid ${C.border}`,
            padding:'20px 14px', overflowY:'auto' }}>

            {/* Candidate */}
            <div style={{ marginBottom:20, padding:'12px 14px',
              background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border2}`,
              borderRadius:10 }}>
              <div style={{ fontSize:9, color:C.muted, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>Candidate</div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:'50%',
                  background:`linear-gradient(135deg,${C.primary},${C.accent})`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:14, fontWeight:800, color:'white' }}>
                  {(candidateName||'C')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{candidateName||'Candidate'}</div>
                  <div style={{ fontSize:10, color:C.muted }}>{jobTitle}</div>
                </div>
              </div>
            </div>

            {/* Question list */}
            <div style={{ fontSize:9, color:C.muted, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>Progress</div>
            {questions.map((q,i) => {
              const done    = i < qIndex;
              const active  = i === qIndex && phase === 'interview';
              const pending = i > qIndex;
              return (
                <div key={i} style={{ marginBottom:8, padding:'10px 12px',
                  background: active ? `${C.primary}18` : done ? 'rgba(0,229,176,0.05)' : 'rgba(255,255,255,0.02)',
                  border:`1px solid ${active?C.primary+'55':done?C.accent+'33':C.border}`,
                  borderRadius:8, transition:'all 0.3s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <div style={{ width:18, height:18, borderRadius:'50%', flexShrink:0,
                      background: done ? C.accent : active ? C.primary : C.border,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:9, fontWeight:700, color: done||active ? '#040a10' : C.muted }}>
                      {done ? '✓' : i+1}
                    </div>
                    <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em',
                      color: active ? C.primary : done ? C.accent : C.muted }}>
                      {(q.type||'question').toUpperCase()}
                    </span>
                    {active && <div style={{ marginLeft:'auto', width:5, height:5, borderRadius:'50%', background:C.primary, animation:'pulse-dot 1s infinite' }}/>}
                  </div>
                  <p style={{ fontSize:10.5, color: active ? C.text : done ? C.muted2 : C.muted,
                    margin:0, lineHeight:1.4,
                    overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                    {q.question}
                  </p>
                  {done && lastScore !== null && i === qIndex - 1 && (
                    <div style={{ marginTop:5, fontSize:10, color:lastScore>=7?C.accent:lastScore>=5?C.amber:C.red, fontWeight:700 }}>
                      Score: {lastScore}/10
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ THINKING OVERLAY ══ */}
        {phase === 'thinking' && (
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:15,
            padding:'16px 28px',
            background:'rgba(4,6,14,0.92)', backdropFilter:'blur(16px)',
            border:`1px solid ${C.primary}44`, borderRadius:14,
            display:'flex', alignItems:'center', gap:12,
            boxShadow:`0 8px 32px rgba(79,142,247,0.2)` }}>
            <div style={{ display:'flex', gap:5 }}>
              {[0,1,2].map(i=><div key={i} style={{ width:8,height:8,borderRadius:'50%',background:C.primary,animation:`pulse-dot 1s ease-in-out ${i*0.25}s infinite` }}/>)}
            </div>
            <span style={{ fontSize:14, color:C.primary, fontWeight:600, fontFamily:'Outfit' }}>Alex is analyzing your answer...</span>
          </div>
        )}

        {/* ══ REPORT VIEW — full overlay ══ */}
        {phase === 'report' && report && (
          <div style={{ position:'absolute', inset:0, zIndex:20, overflowY:'auto',
            background:'linear-gradient(180deg,rgba(4,6,14,0.97) 0%,rgba(4,6,14,0.99) 100%)',
            backdropFilter:'blur(20px)', padding:'32px' }}>
            {/* === REPORT CONTENTS === */}
            <div className="fade-in">
              <div style={{ textAlign:'center', marginBottom:28 }}>
                <div style={{ fontSize:52, marginBottom:10 }}>🎉</div>
                <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:26, color:C.text, marginBottom:8 }}>Interview Complete!</h2>
                <p style={{ fontSize:14, color:C.muted2, maxWidth:460, margin:'0 auto', lineHeight:1.6 }}>
                  Great job. Your responses have been recorded and your report has been sent to the recruiter.
                </p>
              </div>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:28 }}>
                <div style={{ position:'relative', width:130, height:130 }}>
                  <svg width="130" height="130" style={{ transform:'rotate(-90deg)' }}>
                    <circle cx="65" cy="65" r="54" fill="none" stroke={C.border} strokeWidth="9"/>
                    <circle cx="65" cy="65" r="54" fill="none"
                      stroke={report.overallScore>=70?C.accent:report.overallScore>=50?C.amber:C.red}
                      strokeWidth="9"
                      strokeDasharray={`${(report.overallScore/100)*339} 339`}
                      strokeLinecap="round"
                      style={{ filter:`drop-shadow(0 0 10px ${report.overallScore>=70?C.accent:C.amber})`, transition:'stroke-dasharray 1.5s ease' }}/>
                  </svg>
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontFamily:'Outfit', fontWeight:800, fontSize:30, color:C.text }}>{report.overallScore}</span>
                    <span style={{ fontSize:10, color:C.muted, fontWeight:600, textTransform:'uppercase' }}>/ 100</span>
                  </div>
                </div>
              </div>
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:24, marginBottom:20, maxWidth:600, margin:'0 auto 20px' }}>
                <h3 style={{ fontFamily:'Outfit', fontWeight:700, fontSize:13, color:C.muted2, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:20 }}>Your Performance</h3>
                <ScoreMeter label="Communication"    value={report.communicationScore}  color={C.accent}/>
                <ScoreMeter label="Technical Skills" value={report.technicalScore}       color={C.primary}/>
                <ScoreMeter label="Confidence"       value={report.confidenceScore}      color={C.amber}/>
                <ScoreMeter label="Problem Solving"  value={report.problemSolvingScore}  color="#a78bfa"/>
              </div>
              {(report.answerScores||[]).length > 0 && (
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:24, marginBottom:20, maxWidth:600, margin:'0 auto 20px' }}>
                  <h3 style={{ fontFamily:'Outfit', fontWeight:700, fontSize:13, color:C.muted2, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:18 }}>Answer Scores</h3>
                  {report.answerScores.map((a,i) => (
                    <div key={i} style={{ padding:'12px 0', borderBottom:i<report.answerScores.length-1?`1px solid ${C.border}`:'none' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                        <p style={{ fontSize:12.5, color:C.muted2, margin:0, flex:1, paddingRight:12, fontWeight:600 }}>Q{i+1}: {a.question}</p>
                        <span style={{ fontSize:12, fontWeight:700, color:a.score>=7?C.accent:a.score>=5?C.amber:C.red }}>{a.score}/10</span>
                      </div>
                      {a.feedback && <p style={{ fontSize:11.5, color:C.muted, margin:0, lineHeight:1.5 }}>{a.feedback}</p>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ textAlign:'center', maxWidth:600, margin:'0 auto 24px', padding:'16px 20px',
                background:`${C.primary}08`, border:`1px solid ${C.primary}20`, borderRadius:16 }}>
                <p style={{ fontSize:13, color:C.muted2, margin:0, lineHeight:1.7 }}>
                  ✅ Report automatically saved and sent to the recruiter. Good luck! 🚀
                </p>
              </div>
              <div style={{ display:'flex', justifyContent:'center' }}>
                <button onClick={() => { stopSpeaking(); onClose && onClose(); }}
                  style={{ padding:'13px 40px', borderRadius:12, border:'none', cursor:'pointer',
                    fontWeight:700, fontSize:15, fontFamily:'Outfit',
                    background:`linear-gradient(135deg,${C.primary},#3a6dd4)`,
                    color:'white', boxShadow:`0 4px 20px rgba(79,142,247,0.4)` }}>
                  Close & Return
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ LOADING / ERROR overlays ══ */}
        {phase === 'loading' && (
          <div style={{ position:'absolute', inset:0, zIndex:25, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            background:'rgba(4,6,14,0.7)', backdropFilter:'blur(8px)' }}>
            <div style={{ width:44,height:44,border:`3px solid ${C.border}`,borderTopColor:C.primary,borderRadius:'50%',animation:'pulse-dot 0.8s linear infinite',marginBottom:16 }}/>
            <p style={{ color:C.muted, fontSize:14, fontFamily:'Outfit' }}>Preparing your interview questions...</p>
          </div>
        )}
        {phase === 'error' && (
          <div style={{ position:'absolute', inset:0, zIndex:25, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            background:'rgba(4,6,14,0.85)', backdropFilter:'blur(12px)', padding:32 }}>
            <div style={{ fontSize:44, marginBottom:16 }}>⚠️</div>
            <h3 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:C.text, marginBottom:12 }}>Could not connect to interview server</h3>
            <div style={{ padding:'12px 20px', background:'rgba(255,61,85,0.1)', border:`1px solid ${C.red}44`, borderRadius:10, marginBottom:24, fontSize:13, color:C.red }}>
              {error}
            </div>
            <button onClick={startInterview}
              style={{ padding:'11px 28px', borderRadius:10, border:'none', cursor:'pointer',
                fontWeight:700, fontSize:14, fontFamily:'Outfit',
                background:`linear-gradient(135deg,${C.primary},#3a6dd4)`, color:'white' }}>
              ↺ Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}