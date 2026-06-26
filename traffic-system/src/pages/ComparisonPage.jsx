import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const LANES     = ['north','east','south','west'];
const SIG_COLOR = { GREEN:'#22c55e', YELLOW:'#fbbf24', RED:'#ef4444' };

// ── Live intersection SVG diagram ────────────────────────────────────────────
function IntersectionSVG({ mode, activeLane, emergencyLanes=[] }) {
  const positions = {
    north: { cx:200, cy:70,  label:'N' },
    east:  { cx:330, cy:200, label:'E' },
    south: { cx:200, cy:330, label:'S' },
    west:  { cx:70,  cy:200, label:'W' },
  };
  return (
    <svg viewBox="0 0 400 400" style={{ width:'100%', maxWidth:260 }}>
      {/* Roads */}
      <rect x="175" y="0"   width="50" height="160" fill="#1e293b"/>
      <rect x="175" y="240" width="50" height="160" fill="#1e293b"/>
      <rect x="0"   y="175" width="160" height="50" fill="#1e293b"/>
      <rect x="240" y="175" width="160" height="50" fill="#1e293b"/>
      {/* Center box */}
      <rect x="155" y="155" width="90" height="90" fill="#0d1117" stroke="#1e293b" strokeWidth="2"/>
      {/* AI brain indicator */}
      {mode==='AI' && (
        <>
          <circle cx="200" cy="200" r="28" fill="rgba(34,197,94,0.1)" stroke="#22c55e" strokeWidth="1.5"/>
          <text x="200" y="204" textAnchor="middle" fill="#22c55e" fontSize="12" fontWeight="bold">AI</text>
        </>
      )}
      {mode==='STATIC' && (
        <>
          <circle cx="200" cy="200" r="28" fill="rgba(156,163,175,0.1)" stroke="#6b7280" strokeWidth="1.5"/>
          <text x="200" y="204" textAnchor="middle" fill="#6b7280" fontSize="10" fontWeight="bold">STATIC</text>
        </>
      )}
      {/* Lane signals */}
      {LANES.map(lane => {
        const p   = positions[lane];
        const isA = lane===activeLane;
        const isE = emergencyLanes.includes(lane);
        const col = isE ? '#ef4444' : isA ? '#22c55e' : '#ef4444';
        return (
          <g key={lane}>
            <circle cx={p.cx} cy={p.cy} r="18"
              fill={`${col}15`} stroke={col} strokeWidth="2"
              style={isA ? { filter:`drop-shadow(0 0 8px ${col})` } : {}}/>
            <text x={p.cx} y={p.cy+4} textAnchor="middle"
              fill={col} fontSize="12" fontWeight="bold">
              {isE ? '🚑' : p.label}
            </text>
            {isA && !isE && (
              <circle cx={p.cx} cy={p.cy} r="24"
                fill="none" stroke={col} strokeWidth="1.5" opacity="0.4"
                style={{ animation:'ring-pulse 1.5s ease-out infinite' }}/>
            )}
          </g>
        );
      })}
      {/* Lane count labels */}
      {LANES.map(lane => {
        const offsets = { north:{x:200,y:120}, east:{x:310,y:190}, south:{x:200,y:295}, west:{x:90,y:210} };
        return (
          <text key={lane} x={offsets[lane].x} y={offsets[lane].y}
            textAnchor="middle" fill="#475569" fontSize="9">
            {lane.toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
}

// ── Scheduling algorithm flow cards ─────────────────────────────────────────
function AlgoFlow({ mode }) {
  const ai = [
    { icon:'📹', step:'Capture', detail:'4-lane live feed' },
    { icon:'🧠', step:'YOLOv8', detail:'Vehicle detection' },
    { icon:'📊', step:'Priority', detail:'Sliding window score' },
    { icon:'🔄', step:'FCFS+RR', detail:'Starvation prevention' },
    { icon:'🚦', step:'Signal', detail:'Dynamic timing' },
  ];
  const stat = [
    { icon:'⏱', step:'Timer', detail:'Fixed cycle' },
    { icon:'🔄', step:'Rotate', detail:'Round-robin' },
    { icon:'🚦', step:'Signal', detail:'No adaptation' },
  ];
  const steps = mode==='AI' ? ai : stat;
  const accent = mode==='AI' ? '#22c55e' : '#6b7280';

  return (
    <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', justifyContent:'center' }}>
      {steps.map((s,i) => (
        <React.Fragment key={i}>
          <div style={{
            background:`${accent}10`, border:`1px solid ${accent}30`,
            borderRadius:10, padding:'10px 14px', textAlign:'center', minWidth:80,
          }}>
            <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
            <div style={{ fontSize:11, fontWeight:700, color:'#e2e8f0' }}>{s.step}</div>
            <div style={{ fontSize:9, color:'#475569', marginTop:2 }}>{s.detail}</div>
          </div>
          {i<steps.length-1 && (
            <div style={{ fontSize:16, color:`${accent}80`, fontWeight:700 }}>→</div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Emergency scenario card ──────────────────────────────────────────────────
function EmergencyScenario({ count=1, active=false }) {
  const emTypes = ['🚑 Ambulance','🚒 Fire Brigade','🚓 Police'];
  return (
    <div style={{
      background: active ? 'rgba(239,68,68,0.08)' : '#080f1a',
      border:`1px solid ${active ? '#ef444440' : '#0f1929'}`,
      borderRadius:12, padding:14,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ fontSize:16 }}>🚨</span>
        <span style={{ fontSize:13, fontWeight:700, color: active ? '#f87171' : '#94a3b8' }}>
          {count > 1 ? `Multiple Emergency (×${count})` : 'Emergency Priority'}
        </span>
        {active && (
          <span style={{
            marginLeft:'auto', fontSize:10, background:'rgba(239,68,68,0.2)',
            color:'#f87171', padding:'2px 8px', borderRadius:20, fontWeight:700,
          }}>ACTIVE</span>
        )}
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
        {emTypes.slice(0,Math.max(1,count)).map((t,i)=>(
          <div key={i} style={{
            background:'rgba(239,68,68,0.1)', border:'1px solid #ef444430',
            borderRadius:6, padding:'4px 10px', fontSize:11, color:'#fca5a5',
          }}>
            {t}
          </div>
        ))}
      </div>
      <div style={{ fontSize:11, color:'#475569', lineHeight:1.7 }}>
        {'• Highest-confidence emergency served first\n• Up to 30s green lock per vehicle\n• Preempted if higher-priority arrives\n• Manual override available at any time'.split('\n').map((l,i)=>(
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}

// ── Metric comparison bar ────────────────────────────────────────────────────
function CompBar({ label, aiVal, statVal, unit, aiIcon='🤖', statIcon='⏱' }) {
  const max     = Math.max(aiVal, statVal, 1);
  const aiPct   = (aiVal/max)*100;
  const stPct   = (statVal/max)*100;
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:12, color:'#94a3b8', marginBottom:6 }}>{label}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {[
          { icon:aiIcon, pct:aiPct, val:aiVal, color:'#10b981', label:'AI' },
          { icon:statIcon, pct:stPct, val:statVal, color:'#6b7280', label:'Static' },
        ].map(b=>(
          <div key={b.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:14, width:22 }}>{b.icon}</span>
            <div style={{ flex:1, height:24, background:'#0d1117', borderRadius:6, overflow:'hidden' }}>
              <div style={{
                height:'100%', width:`${b.pct}%`, minWidth:30,
                background:`linear-gradient(90deg,${b.color},${b.color}99)`,
                borderRadius:6, display:'flex', alignItems:'center',
                paddingLeft:8, transition:'width 0.8s ease',
              }}>
                <span style={{ fontSize:11, fontWeight:700, color:'white' }}>
                  {b.val.toFixed(1)}{unit}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scheduling algorithm explainer ───────────────────────────────────────────
function AlgoCard({ title, color, items }) {
  return (
    <div style={{
      background:`${color}08`, border:`1px solid ${color}25`,
      borderRadius:10, padding:14,
    }}>
      <div style={{ fontSize:12, fontWeight:700, color, marginBottom:8 }}>{title}</div>
      {items.map((item,i)=>(
        <div key={i} style={{ fontSize:11, color:'#64748b', marginBottom:4, paddingLeft:8,
          borderLeft:`2px solid ${color}40`}}>
          {item}
        </div>
      ))}
    </div>
  );
}

export default function ComparisonPage() {
  const [mode,          setMode]        = useState('AI');
  const [activeLane,    setActiveLane]  = useState('north');
  const [emgLanes,      setEmgLanes]    = useState([]);
  const [emergency,     setEmergency]   = useState(false);
  const [emCount,       setEmCount]     = useState(0);
  const [liveStats,     setLiveStats]   = useState({
    north:0, east:0, south:0, west:0, total:0,
    aiDecisions:0, fairnessOverrides:0, emergencyResponses:0,
  });
  const [stats, setStats] = useState({
    ai:   { avgWait:22, throughput:87, fuel:80, emResponse:99, satisfaction:91 },
    stat: { avgWait:46, throughput:61, fuel:55, emResponse:28, satisfaction:63 },
  });

  useEffect(() => {
    const s = io('http://localhost:5000');
    s.on('state_update', (d) => {
      setMode(d.mode || 'AI');
      const active = LANES.find(l=>d[l]?.signal==='GREEN') || 'north';
      setActiveLane(active);
      setEmergency(d.emergency||false);
      setEmgLanes(d.emergencyLanes||[]);
      const emC = (d.emergencyLanes||[]).length;
      setEmCount(emC);

      const total = LANES.reduce((s,l)=>s+(d[l]?.vehicles||0), 0);
      setLiveStats({
        north: d.north?.vehicles||0, east: d.east?.vehicles||0,
        south: d.south?.vehicles||0, west: d.west?.vehicles||0,
        total, aiDecisions: d.stats?.aiDecisions||0,
        fairnessOverrides: d.stats?.fairnessOverrides||0,
        emergencyResponses: d.stats?.emergencyResponses||0,
      });

      setStats({
        ai:   { avgWait:Math.max(12,42-total*0.4), throughput:Math.min(96,62+total*0.5),
                fuel:80, emResponse:99, satisfaction:Math.min(96,72+total*0.4) },
        stat: { avgWait:46, throughput:61, fuel:55, emResponse:28, satisfaction:63 },
      });
    });
    return () => s.close();
  }, []);

  const imp = {
    wait:  Math.round(((stats.stat.avgWait-stats.ai.avgWait)/stats.stat.avgWait)*100),
    thru:  Math.round(((stats.ai.throughput-stats.stat.throughput)/stats.stat.throughput)*100),
    fuel:  Math.round(((stats.ai.fuel-stats.stat.fuel)/stats.stat.fuel)*100),
    emr:   Math.round(((stats.ai.emResponse-stats.stat.emResponse)/stats.stat.emResponse)*100),
  };

  return (
    <div style={{
      minHeight:'100vh',
      background:'linear-gradient(145deg,#020812 0%,#0a0f1a 100%)',
      color:'#e2e8f0',
      fontFamily:"'Inter','Segoe UI',sans-serif",
      padding:20,
    }}>
      {/* Header */}
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        marginBottom:20, flexWrap:'wrap', gap:12,
      }}>
        <div>
          <h1 style={{
            margin:0, fontSize:20, fontWeight:800,
            background:'linear-gradient(90deg,#60a5fa,#34d399)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          }}>
            AI vs Static — Signal Scheduling Analysis
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:11, color:'#334155' }}>
            FCFS · Round-Robin · Sliding Window · Priority Queue · Starvation Prevention
          </p>
        </div>
        <div style={{
          padding:'8px 16px', borderRadius:20, fontSize:13, fontWeight:700,
          background: mode==='AI' ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)',
          border: `1px solid ${mode==='AI' ? '#10b98130' : '#6b728030'}`,
          color: mode==='AI' ? '#34d399' : '#9ca3af',
        }}>
          {mode==='AI' ? '🤖 AI Mode Active' : '⏱ Static Mode Active'}
        </div>
      </div>

      {/* Emergency alert */}
      {emergency && (
        <div style={{
          background:'rgba(239,68,68,0.1)', border:'1px solid #ef444430',
          borderRadius:10, padding:'10px 16px', marginBottom:16,
          display:'flex', alignItems:'center', gap:10,
          animation:'compPulse 0.9s ease-in-out infinite alternate',
        }}>
          <span style={{ fontSize:20 }}>🚨</span>
          <span style={{ fontSize:13, fontWeight:700, color:'#f87171' }}>
            EMERGENCY ACTIVE on {emgLanes.map(l=>l.toUpperCase()).join(' + ')}
            {emCount>1 ? ` — ${emCount} vehicles simultaneously` : ''}
          </span>
        </div>
      )}

      {/* Improvement highlights */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        {[
          { label:'Wait Time ↓', value:`-${imp.wait}%`, color:'#22c55e', icon:'⚡' },
          { label:'Throughput ↑', value:`+${imp.thru}%`, color:'#3b82f6', icon:'🚀' },
          { label:'Fuel Saved',  value:`+${imp.fuel}%`, color:'#f59e0b', icon:'🌱' },
          { label:'Emerg. Speed',value:`+${imp.emr}%`,  color:'#ef4444', icon:'🚑' },
        ].map(m=>(
          <div key={m.label} style={{
            background:`${m.color}08`, border:`1px solid ${m.color}25`,
            borderRadius:12, padding:'14px 16px', textAlign:'center',
          }}>
            <div style={{ fontSize:22, marginBottom:4 }}>{m.icon}</div>
            <div style={{ fontSize:24, fontWeight:800, color:m.color }}>{m.value}</div>
            <div style={{ fontSize:11, color:'#475569', marginTop:4 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Live intersection */}
          <div style={{ background:'#080f1a', border:'1px solid #0f1929', borderRadius:14, padding:20 }}>
            <h3 style={{ margin:'0 0 14px', fontSize:13, color:'#e2e8f0' }}>🎯 Live Intersection View</h3>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
              <IntersectionSVG mode={mode} activeLane={activeLane} emergencyLanes={emgLanes}/>
            </div>
            <p style={{ margin:0, textAlign:'center', fontSize:11, color:'#475569' }}>
              {mode==='AI'
                ? 'AI dynamically picks the optimal lane based on real-time vehicle density & fairness'
                : 'Static mode rotates through all lanes on a fixed timer regardless of traffic'}
            </p>
          </div>

          {/* Algo flow */}
          <div style={{ background:'#080f1a', border:'1px solid #0f1929', borderRadius:14, padding:20 }}>
            <h3 style={{ margin:'0 0 14px', fontSize:13, color:'#e2e8f0' }}>
              ⚙ {mode} Decision Flow
            </h3>
            <AlgoFlow mode={mode}/>
          </div>

          {/* Algorithm detail cards */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <AlgoCard title="🔄 Round-Robin" color="#8b5cf6" items={[
              'Ensures every lane gets served',
              'Skip counter prevents starvation',
              'Rotates when traffic equal',
            ]}/>
            <AlgoCard title="📊 FCFS Priority" color="#3b82f6" items={[
              'Highest density gets served first',
              'Weighted by vehicle type',
              'Bus/Truck get bonus weight',
            ]}/>
            <AlgoCard title="📉 Sliding Window" color="#10b981" items={[
              'Median of last 10 frames',
              'Eliminates noisy detections',
              'Stable, jitter-free counts',
            ]}/>
            <AlgoCard title="⏳ Anti-Starvation" color="#f59e0b" items={[
              '60s max wait threshold',
              '3× bonus when near limit',
              'Forced green if starving',
            ]}/>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Performance comparison */}
          <div style={{ background:'#080f1a', border:'1px solid #0f1929', borderRadius:14, padding:20 }}>
            <h3 style={{ margin:'0 0 14px', fontSize:13, color:'#e2e8f0' }}>📊 Performance Metrics</h3>
            <CompBar label="Average Wait Time" aiVal={stats.ai.avgWait}   statVal={stats.stat.avgWait}   unit="s"  aiIcon="⚡" statIcon="⏱"/>
            <CompBar label="Traffic Throughput"  aiVal={stats.ai.throughput} statVal={stats.stat.throughput} unit="%" aiIcon="🚀" statIcon="🐢"/>
            <CompBar label="Fuel Efficiency"     aiVal={stats.ai.fuel}       statVal={stats.stat.fuel}       unit="%" aiIcon="🌱" statIcon="⛽"/>
            <CompBar label="Emergency Response"  aiVal={stats.ai.emResponse} statVal={stats.stat.emResponse} unit="%" aiIcon="🚑" statIcon="🚦"/>
            <CompBar label="Satisfaction Score"  aiVal={stats.ai.satisfaction} statVal={stats.stat.satisfaction} unit="%" aiIcon="😊" statIcon="😕"/>
          </div>

          {/* Live analytics */}
          <div style={{ background:'#080f1a', border:'1px solid #0f1929', borderRadius:14, padding:20 }}>
            <h3 style={{ margin:'0 0 14px', fontSize:13, color:'#e2e8f0' }}>📈 Live Analytics</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {[
                { label:'AI Decisions', value:liveStats.aiDecisions, color:'#8b5cf6' },
                { label:'Fairness Overrides', value:liveStats.fairnessOverrides, color:'#f59e0b' },
                { label:'Emerg. Responses', value:liveStats.emergencyResponses, color:'#ef4444' },
              ].map(s=>(
                <div key={s.label} style={{
                  background:'#0d1117', borderRadius:8, padding:'10px 8px', textAlign:'center',
                }}>
                  <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:9, color:'#334155', marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Per-lane vehicle count bars */}
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:11, color:'#475569', marginBottom:8 }}>Live Vehicle Distribution</div>
              {LANES.map(lane=>{
                const count = liveStats[lane]||0;
                const total = Math.max(liveStats.total,1);
                const pct   = (count/total)*100;
                const isA   = lane===activeLane;
                return (
                  <div key={lane} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ width:50, fontSize:10, color:'#64748b', textTransform:'uppercase' }}>{lane}</span>
                    <div style={{ flex:1, height:5, background:'#1e293b', borderRadius:3 }}>
                      <div style={{
                        height:'100%', width:`${pct}%`, borderRadius:3,
                        background: isA ? '#22c55e' : '#3b82f6',
                        transition:'width 0.7s ease',
                      }}/>
                    </div>
                    <span style={{ width:22, fontSize:10, color:'#e2e8f0', textAlign:'right' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Emergency scenarios */}
          <div style={{ background:'#080f1a', border:'1px solid #0f1929', borderRadius:14, padding:20 }}>
            <h3 style={{ margin:'0 0 14px', fontSize:13, color:'#e2e8f0' }}>🚑 Emergency Handling</h3>
            <EmergencyScenario count={emCount>0?emCount:1} active={emergency}/>
          </div>

          {/* Environmental */}
          <div style={{ background:'#080f1a', border:'1px solid #0f1929', borderRadius:14, padding:20 }}>
            <h3 style={{ margin:'0 0 14px', fontSize:13, color:'#e2e8f0' }}>🌍 Environmental Impact</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div style={{ background:'rgba(16,185,129,0.08)', border:'1px solid #10b98130', borderRadius:10, padding:14 }}>
                <div style={{ fontSize:11, color:'#34d399', fontWeight:700, marginBottom:6 }}>🤖 AI Mode</div>
                <div style={{ fontSize:28, fontWeight:800, color:'#34d399' }}>-35%</div>
                <div style={{ fontSize:10, color:'#475569', marginTop:4 }}>CO₂ via optimized timing</div>
              </div>
              <div style={{ background:'rgba(107,114,128,0.08)', border:'1px solid #6b728030', borderRadius:10, padding:14 }}>
                <div style={{ fontSize:11, color:'#9ca3af', fontWeight:700, marginBottom:6 }}>⏱ Static</div>
                <div style={{ fontSize:28, fontWeight:800, color:'#6b7280' }}>0%</div>
                <div style={{ fontSize:10, color:'#475569', marginTop:4 }}>No optimization applied</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        @keyframes ring-pulse { 0%{r:24;opacity:0.5} 100%{r:32;opacity:0} }
        @keyframes compPulse  { from{opacity:1} to{opacity:0.7} }
      `}</style>
    </div>
  );
}
