import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const LANES = ['north', 'east', 'south', 'west'];
const SIG_COLOR = { GREEN: '#22c55e', YELLOW: '#fbbf24', RED: '#ef4444' };
const VEHICLE_ICONS = {
  'Car':'🚗','Truck':'🚛','Bus':'🚌','Motorcycle':'🏍','Two-Wheeler':'🏍',
  'Bicycle':'🚲','Person':'🚶','Autorickshaw':'🛺','Ambulance':'🚑',
  'Fire Brigade':'🚒','Police':'🚔','Utility':'🚐',
};

const JUNCTIONS = [
  { id:'j1', name:'Main Junction',    location:'Central District', cams:['north','east','south','west'], type:'Primary' },
  { id:'j2', name:'Highway Entry',    location:'National Hwy 48',  cams:['north','east','south','west'], type:'Secondary' },
  { id:'j3', name:'Market Area',      location:'District Market',  cams:['north','east','south','west'], type:'Tertiary' },
  { id:'j4', name:'Hospital Zone',    location:'Hospital Road',    cams:['north','east','south','west'], type:'Emergency Priority' },
];

// ── Radial gauge ring ────────────────────────────────────────────────────────
function GaugeRing({ value, max=100, color, size=72, label, icon }) {
  const pct   = Math.min(value / max, 1);
  const r     = (size - 10) / 2;
  const circ  = 2 * Math.PI * r;
  const dash  = pct * circ * 0.75;   // 270° arc
  const gap   = circ - dash;
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      <div style={{ position:'relative', width:size, height:size }}>
        <svg width={size} height={size} style={{ transform:'rotate(135deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke="#1e293b" strokeWidth="8"
            strokeDasharray={`${circ*0.75} ${circ*0.25}`} strokeLinecap="round"/>
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${gap + circ*0.25}`}
            strokeLinecap="round"
            style={{ transition:'stroke-dasharray 1s ease', filter:`drop-shadow(0 0 4px ${color})` }}/>
        </svg>
        <div style={{
          position:'absolute', inset:0,
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
        }}>
          <span style={{ fontSize:14 }}>{icon}</span>
          <span style={{ fontSize:13, fontWeight:800, color, lineHeight:1 }}>
            {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}
          </span>
        </div>
      </div>
      <span style={{ fontSize:10, color:'#475569', textAlign:'center', maxWidth:72 }}>{label}</span>
    </div>
  );
}

// ── Trend badge ───────────────────────────────────────────────────────────────
function TrendBadge({ delta, unit='' }) {
  const up  = delta >= 0;
  const col = up ? '#22c55e' : '#ef4444';
  return (
    <span style={{
      fontSize:10, fontWeight:700, color:col,
      background:`${col}15`, borderRadius:4, padding:'2px 6px',
    }}>
      {up ? '↑' : '↓'} {Math.abs(delta)}{unit}
    </span>
  );
}

// ── Tiny bar sparkline ────────────────────────────────────────────────────────
function Sparkline({ data=[], color='#3b82f6', height=28, width=80 }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * width;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ overflow:'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round"
        style={{ filter:`drop-shadow(0 0 3px ${color})` }}/>
      {/* dot at last point */}
      {data.length > 1 && (
        <circle cx={(width)} cy={height - (data[data.length-1]/max)*(height-4) - 2}
          r="2.5" fill={color}/>
      )}
    </svg>
  );
}

// ── Big metric card with gauge + sparkline ────────────────────────────────────
function MetricCard({ icon, label, value, max, color, unit='', sub, trend, sparkData, gaugeMax }) {
  return (
    <div style={{
      background:'linear-gradient(135deg,#080f1a,#0d1420)',
      border:`1px solid ${color}25`,
      borderRadius:14, padding:'16px 18px',
      display:'flex', flexDirection:'column', gap:10,
      position:'relative', overflow:'hidden',
    }}>
      {/* glow accent */}
      <div style={{
        position:'absolute', top:-20, right:-20, width:80, height:80,
        background:`radial-gradient(circle,${color}20,transparent 70%)`,
        pointerEvents:'none',
      }}/>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{
            width:32, height:32, borderRadius:8,
            background:`${color}15`, border:`1px solid ${color}30`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
          }}>{icon}</div>
          <span style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1 }}>
            {label}
          </span>
        </div>
        {trend !== undefined && <TrendBadge delta={trend} unit={unit}/>}
      </div>
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:30, fontWeight:800, color, lineHeight:1 }}>
            {value}{unit}
          </div>
          {sub && <div style={{ fontSize:11, color:'#334155', marginTop:4 }}>{sub}</div>}
        </div>
        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} color={color}/>
        )}
      </div>
      {/* Progress bar */}
      {gaugeMax && (
        <div style={{ height:4, background:'#1e293b', borderRadius:2, overflow:'hidden' }}>
          <div style={{
            height:'100%',
            width:`${Math.min((parseFloat(value)/gaugeMax)*100,100)}%`,
            background:`linear-gradient(90deg,${color},${color}88)`,
            borderRadius:2, transition:'width 1s ease',
          }}/>
        </div>
      )}
    </div>
  );
}

function MiniTrafficLight({ signal }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', gap:3,
      background:'#111827', borderRadius:20, padding:'5px 4px',
      border:'1px solid #1e293b', width:20,
    }}>
      {['RED','YELLOW','GREEN'].map(s => (
        <div key={s} style={{
          width:12, height:12, borderRadius:'50%',
          background: signal===s ? SIG_COLOR[s] : '#1e293b',
          boxShadow: signal===s ? `0 0 8px ${SIG_COLOR[s]}` : 'none',
          transition:'all 0.3s',
        }}/>
      ))}
    </div>
  );
}

function CamCell({ lane, laneData, mode, aiFrame }) {
  const sig = laneData.signal || 'RED';
  const col = SIG_COLOR[sig];
  const em  = laneData.hasEmergency;

  return (
    <div style={{
      position:'relative', background:'#050a12',
      border:`2px solid ${em ? '#ef444460' : sig==='GREEN' ? '#22c55e30' : '#0f1929'}`,
      borderRadius:10, overflow:'hidden',
      boxShadow: em ? '0 0 16px #ef444440' : 'none',
      transition:'all 0.4s',
    }}>
      {/* Video */}
      <div style={{ position:'relative', paddingTop:'60%' }}>
        {mode==='AI' && aiFrame ? (
          <img src={aiFrame} alt={lane}
            style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',
              opacity: sig==='RED' ? 0.4 : 1, transition:'opacity 0.4s'
            }}
          />
        ):(
          <video src={`/${lane}.mp4`} autoPlay loop muted playsInline
            style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',
              opacity: sig==='RED' ? 0.35 : 1,
              filter: sig==='RED' ? 'grayscale(40%)' : 'none',
              transition:'all 0.4s'
            }}
          />
        )}
        {em && (
          <div style={{
            position:'absolute',inset:0,
            background:'rgba(239,68,68,0.12)',
            animation:'emFlash 0.7s ease-in-out infinite alternate',
          }}/>
        )}
      </div>

      {/* Overlay info */}
      <div style={{
        position:'absolute', top:8, left:8,
        background:'rgba(0,0,0,0.8)', backdropFilter:'blur(6px)',
        border:`1px solid ${col}`, borderRadius:6,
        padding:'3px 8px', display:'flex', alignItems:'center', gap:6,
      }}>
        <MiniTrafficLight signal={sig}/>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:col, letterSpacing:1 }}>
            {lane.toUpperCase()} {em && '🚑'}
          </div>
          <div style={{ fontSize:9, color:'#475569' }}>
            {laneData.vehicles||0} veh {sig!=='RED' && `· ${laneData.time||0}s`}
          </div>
        </div>
      </div>

      {/* Vehicle types */}
      <div style={{
        position:'absolute', bottom:6, left:6, right:6,
        display:'flex', flexWrap:'wrap', gap:3,
      }}>
        {Object.entries(laneData.vehicleTypes||{}).slice(0,4).map(([t,c])=>(
          <span key={t} style={{
            background:'rgba(0,0,0,0.8)', borderRadius:4,
            padding:'1px 5px', fontSize:9, color:'#94a3b8',
          }}>
            {VEHICLE_ICONS[t]||'🚗'} {c}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [liveData, setLiveData] = useState({});
  const [frames,   setFrames]   = useState({});
  const [selJ,     setSelJ]     = useState('j1');
  const [time,     setTime]     = useState(new Date());
  const [events,   setEvents]   = useState([]);
  const [stats,    setStats]    = useState({
    processed:0, avgWait:28, emEvents:0, efficiency:85, aiDecisions:0,
    throughput:0, greenUtilization:0, fairnessOverrides:0,
    prevTotalVehicles:0, totalVehiclesSeen:0,
  });
  // sparkline history (last 20 ticks)
  const [spark, setSpark] = useState({ total:[], efficiency:[], wait:[] });
  const socketRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const s = io('http://localhost:5000');
    socketRef.current = s;

    s.on('state_update', (d) => {
      setLiveData(d);
      const total       = LANES.reduce((acc,l) => acc+(d[l]?.vehicles||0), 0);
      const aiDec       = d.stats?.aiDecisions       || 0;
      const fairOver    = d.stats?.fairnessOverrides  || 0;
      const emR         = d.stats?.emergencyResponses || 0;
      const avgWait     = Math.max(8,  44 - total * 0.55);
      const efficiency  = Math.min(98, 66 + total * 0.65);
      const greenLanes  = LANES.filter(l => d[l]?.signal==='GREEN').length;
      const greenUtil   = Math.round((greenLanes / LANES.length) * 100);
      const throughput  = Math.min(99, 55 + total * 0.8);

      setStats(prev => ({
        processed:          prev.processed + (total > 0 ? 1 : 0),
        totalVehiclesSeen:  prev.totalVehiclesSeen + total,
        avgWait,
        emEvents:           emR,
        efficiency,
        aiDecisions:        aiDec,
        throughput,
        greenUtilization:   greenUtil,
        fairnessOverrides:  fairOver,
        prevTotalVehicles:  prev.prevTotalVehicles,
      }));

      setSpark(prev => ({
        total:      [...prev.total.slice(-19), total],
        efficiency: [...prev.efficiency.slice(-19), efficiency],
        wait:       [...prev.wait.slice(-19), avgWait],
      }));

      if (d.emergency) {
        const lanes = (d.emergencyLanes||[]).map(l=>l.toUpperCase()).join(', ');
        setEvents(prev => [{
          id:Date.now(), type:'emergency',
          msg:`🚑 Emergency detected on ${lanes||'unknown'}`,
          time:new Date(),
        }, ...prev.slice(0,19)]);
      }

      const activeGreenLane = LANES.find(l => d[l]?.signal==='GREEN');
      if (activeGreenLane) {
        const veh = d[activeGreenLane]?.vehicles || 0;
        if (veh > 12) {
          setEvents(prev => [
            { id:Date.now()+'h', type:'info',
              msg:`🔴 High density: ${activeGreenLane.toUpperCase()} — ${veh} vehicles`,
              time:new Date() },
            ...prev.slice(0,19)
          ]);
        }
      }
    });

    return () => s.close();
  }, []);

  // Fetch AI frames
  useEffect(() => {
    const urls = {};
    const fetch_f = async (lane) => {
      try {
        const res = await fetch(`http://localhost:8000/frame/${lane}`);
        if (!res.ok) return;
        const url = URL.createObjectURL(await res.blob());
        if (urls[lane]) URL.revokeObjectURL(urls[lane]);
        urls[lane] = url;
        setFrames(p => ({...p, [lane]: url}));
      } catch {}
    };
    const iv = setInterval(() => LANES.forEach(l => fetch_f(l)), 300);
    return () => { clearInterval(iv); Object.values(urls).forEach(u=>u&&URL.revokeObjectURL(u)); };
  }, []);

  const junc    = JUNCTIONS.find(j=>j.id===selJ);
  const isEmerg = liveData.emergency;
  const totalV  = LANES.reduce((s,l)=>(s+(liveData[l]?.vehicles||0)),0);
  const activeLane = LANES.find(l=>liveData[l]?.signal==='GREEN') || '—';
  const mode    = liveData.mode || 'AI';

  return (
    <div style={{
      minHeight:'100vh',
      background:'linear-gradient(145deg,#020812 0%,#0a0f1a 100%)',
      color:'#e2e8f0',
      fontFamily:"'Inter','Segoe UI',sans-serif",
    }}>
      {/* Header */}
      <header style={{
        background:'rgba(5,10,18,0.95)', backdropFilter:'blur(12px)',
        borderBottom:'1px solid #0f1929', padding:'16px 24px',
        position:'sticky', top:0, zIndex:10,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ fontSize:32 }}>🏛️</div>
            <div>
              <h1 style={{ margin:0, fontSize:18, fontWeight:800, color:'#e2e8f0' }}>
                District Traffic Management System
              </h1>
              <p style={{ margin:'3px 0 0', fontSize:11, color:'#475569' }}>
                Deputy Collector · Live Monitoring Dashboard
              </p>
            </div>
          </div>

          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {isEmerg && (
              <div style={{
                background:'rgba(239,68,68,0.15)', border:'1px solid #ef444440',
                borderRadius:8, padding:'6px 12px',
                fontSize:12, color:'#f87171', fontWeight:700,
                animation:'dash_em 0.8s ease-in-out infinite alternate',
              }}>
                🚨 EMERGENCY ACTIVE
              </div>
            )}
            <div style={{
              background:'#0d1117', border:'1px solid #1e293b',
              borderRadius:8, padding:'6px 14px', textAlign:'right',
            }}>
              <div style={{ fontSize:10, color:'#334155' }}>CURRENT TIME</div>
              <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color:'#94a3b8' }}>
                {time.toLocaleTimeString()}
              </div>
            </div>
            <div style={{
              background: isEmerg ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.1)',
              border: `1px solid ${isEmerg ? '#ef4444' : '#22c55e'}40`,
              borderRadius:8, padding:'6px 14px',
            }}>
              <div style={{ fontSize:10, color:'#334155' }}>SYSTEM</div>
              <div style={{ fontSize:14, fontWeight:700, color: isEmerg ? '#f87171' : '#4ade80' }}>
                {isEmerg ? 'EMERGENCY' : '● NORMAL'}
              </div>
            </div>
          </div>
        </div>

        {/* Junction tabs */}
        <div style={{ display:'flex', gap:8, marginTop:14, overflowX:'auto', paddingBottom:2 }}>
          {JUNCTIONS.map(j => (
            <button key={j.id} onClick={()=>setSelJ(j.id)} style={{
              padding:'8px 16px', borderRadius:8, cursor:'pointer',
              background: selJ===j.id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${selJ===j.id ? '#3b82f640' : '#0f1929'}`,
              color: selJ===j.id ? '#60a5fa' : '#475569',
              fontSize:12, fontWeight:600, whiteSpace:'nowrap',
              transition:'all 0.2s',
            }}>
              {j.name}
              <span style={{ marginLeft:6, fontSize:9, color:'#22c55e' }}>● LIVE</span>
            </button>
          ))}
        </div>
      </header>

      <main style={{ padding:'20px 24px' }}>
        {/* ══ PERFORMANCE METRICS ══ */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <span style={{ fontSize:13, fontWeight:700, color:'#e2e8f0' }}>📊 Performance Metrics</span>
              <span style={{ marginLeft:10, fontSize:11, color:'#334155' }}>Live · updates every second</span>
            </div>
            <div style={{
              fontSize:10, color: mode==='AI' ? '#22c55e' : '#6b7280',
              background: mode==='AI' ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)',
              border:`1px solid ${mode==='AI' ? '#22c55e30' : '#6b728030'}`,
              padding:'3px 10px', borderRadius:20, fontWeight:700,
            }}>
              {mode==='AI' ? '🤖 AI MODE' : '⏱ STATIC MODE'}
            </div>
          </div>

          {/* Row 1 — 4 metric cards with sparklines */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:10 }}>
            <MetricCard
              icon="🚗" label="Live Vehicles" color="#3b82f6"
              value={totalV} unit="" gaugeMax={40}
              sub={`Active: ${activeLane.toUpperCase()}`}
              sparkData={spark.total}
            />
            <MetricCard
              icon="⏱" label="Avg Wait Time" color="#f59e0b"
              value={Math.round(stats.avgWait)} unit="s" gaugeMax={60}
              sub="Across all lanes"
              trend={-3}
              sparkData={spark.wait}
            />
            <MetricCard
              icon="⚡" label="Efficiency" color="#22c55e"
              value={Math.round(stats.efficiency)} unit="%" gaugeMax={100}
              sub={`${stats.aiDecisions} AI decisions`}
              trend={8}
              sparkData={spark.efficiency}
            />
            <MetricCard
              icon="🚑" label="Emergency Events" color="#ef4444"
              value={stats.emEvents} unit="" gaugeMax={20}
              sub={isEmerg ? '⚠ Currently active' : '✓ All cleared'}
            />
          </div>

          {/* Row 2 — secondary metrics + per-lane table */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 2fr', gap:10 }}>
            {/* Throughput */}
            <div style={{
              background:'linear-gradient(135deg,#080f1a,#0d1420)',
              border:'1px solid #8b5cf625', borderRadius:12, padding:'14px 16px',
            }}>
              <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Throughput</div>
              <div style={{ fontSize:26, fontWeight:800, color:'#8b5cf6' }}>{Math.round(stats.throughput)}%</div>
              <div style={{ height:4, background:'#1e293b', borderRadius:2, marginTop:8, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${stats.throughput}%`, borderRadius:2,
                  background:'linear-gradient(90deg,#8b5cf6,#6d28d9)', transition:'width 1s ease' }}/>
              </div>
              <div style={{ fontSize:10, color:'#334155', marginTop:4 }}>Vehicles per cycle</div>
            </div>
            {/* Green utilization */}
            <div style={{
              background:'linear-gradient(135deg,#080f1a,#0d1420)',
              border:'1px solid #06b6d425', borderRadius:12, padding:'14px 16px',
            }}>
              <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Green Util.</div>
              <div style={{ fontSize:26, fontWeight:800, color:'#06b6d4' }}>{stats.greenUtilization}%</div>
              <div style={{ height:4, background:'#1e293b', borderRadius:2, marginTop:8, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${stats.greenUtilization}%`, borderRadius:2,
                  background:'linear-gradient(90deg,#06b6d4,#0891b2)', transition:'width 1s ease' }}/>
              </div>
              <div style={{ fontSize:10, color:'#334155', marginTop:4 }}>Signal green ratio</div>
            </div>
            {/* Fairness */}
            <div style={{
              background:'linear-gradient(135deg,#080f1a,#0d1420)',
              border:'1px solid #f59e0b25', borderRadius:12, padding:'14px 16px',
            }}>
              <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Fairness</div>
              <div style={{ fontSize:26, fontWeight:800, color:'#f59e0b' }}>{stats.fairnessOverrides}</div>
              <div style={{ fontSize:10, color:'#334155', marginTop:8 }}>Starvation overrides</div>
              <div style={{ fontSize:9, color:'#1e293b', marginTop:2 }}>Anti-starvation triggers</div>
            </div>
            {/* Per-lane breakdown table */}
            <div style={{
              background:'linear-gradient(135deg,#080f1a,#0d1420)',
              border:'1px solid #1e293b', borderRadius:12, padding:'14px 16px',
            }}>
              <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Lane Breakdown</div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <thead>
                  <tr>
                    {['Lane','Veh','Signal','Wait','Priority'].map(h=>(
                      <th key={h} style={{ textAlign:'left', color:'#334155', fontWeight:600,
                        paddingBottom:6, fontSize:10, borderBottom:'1px solid #1e293b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LANES.map(lane => {
                    const ld  = liveData[lane] || {};
                    const sig = ld.signal || 'RED';
                    const col = { GREEN:'#22c55e', YELLOW:'#fbbf24', RED:'#ef4444' }[sig];
                    const ps  = liveData.priorityScores?.[lane] || 0;
                    const wt  = sig === 'GREEN' ? 0 : '—';
                    return (
                      <tr key={lane} style={{
                        background: sig==='GREEN' ? 'rgba(34,197,94,0.04)' : 'transparent',
                      }}>
                        <td style={{ padding:'5px 0', color:'#94a3b8', textTransform:'uppercase',
                          fontWeight:700, fontSize:11 }}>{lane}</td>
                        <td style={{ padding:'5px 0', color:'#e2e8f0', fontWeight:700 }}>{ld.vehicles||0}</td>
                        <td style={{ padding:'5px 0' }}>
                          <span style={{ color:col, fontWeight:700, fontSize:10 }}>{sig}</span>
                          {ld.time>0 && sig!=='RED' &&
                            <span style={{ color:'#334155', marginLeft:4 }}>{ld.time}s</span>}
                        </td>
                        <td style={{ padding:'5px 0', color:'#475569' }}>{wt}</td>
                        <td style={{ padding:'5px 0' }}>
                          <span style={{
                            background: ps>50 ? '#22c55e20' : '#1e293b',
                            color: ps>50 ? '#4ade80' : '#475569',
                            borderRadius:4, padding:'1px 5px', fontSize:10,
                          }}>{ps}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, alignItems:'start' }}>

          {/* 4-cam grid */}
          <div style={{ background:'#080f1a', border:'1px solid #0f1929', borderRadius:14, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h2 style={{ margin:0, fontSize:14, color:'#e2e8f0' }}>
                📹 Live CCTV — {junc?.name}
              </h2>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:10, color:'#475569', background:'#0d1117', padding:'3px 8px', borderRadius:4 }}>
                  {junc?.location}
                </span>
                <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11 }}>
                  <div style={{ width:6,height:6,borderRadius:'50%',background:'#22c55e',
                    boxShadow:'0 0 6px #22c55e'}}/>
                  <span style={{ color:'#4ade80' }}>{mode}</span>
                </div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {LANES.map(lane => (
                <CamCell
                  key={lane}
                  lane={lane}
                  laneData={liveData[lane] || {}}
                  mode={mode}
                  aiFrame={frames[lane]}
                />
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Signal status */}
            <div style={{ background:'#080f1a', border:'1px solid #0f1929', borderRadius:14, padding:16 }}>
              <h3 style={{ margin:'0 0 12px', fontSize:13, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1 }}>
                Signal Status
              </h3>
              {LANES.map(lane => {
                const ld  = liveData[lane] || {};
                const sig = ld.signal || 'RED';
                const col = SIG_COLOR[sig];
                return (
                  <div key={lane} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'8px 10px', borderRadius:8, marginBottom:6,
                    background: sig==='GREEN' ? 'rgba(34,197,94,0.05)' : 'transparent',
                    border:`1px solid ${sig==='GREEN' ? '#22c55e20' : 'transparent'}`,
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{
                        width:10,height:10,borderRadius:'50%',
                        background:col, boxShadow:`0 0 8px ${col}`,
                      }}/>
                      <span style={{ fontSize:12,fontWeight:700,color:col,letterSpacing:1,textTransform:'uppercase' }}>
                        {lane}
                      </span>
                      {ld.hasEmergency && <span style={{ fontSize:12 }}>🚑</span>}
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <span style={{ fontSize:11, color:'#475569' }}>{ld.vehicles||0}v</span>
                      <span style={{ fontSize:11,fontWeight:700,color:col }}>{sig}</span>
                      {ld.time>0 && sig!=='RED' && (
                        <span style={{ fontSize:11,color:'#334155' }}>{ld.time}s</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Priority bars */}
            <div style={{ background:'#080f1a', border:'1px solid #0f1929', borderRadius:14, padding:16 }}>
              <h3 style={{ margin:'0 0 12px', fontSize:13, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1 }}>
                Lane Priority
              </h3>
              {LANES.map(lane => {
                const score = liveData.priorityScores?.[lane] || 0;
                const maxS  = Math.max(...LANES.map(l=>liveData.priorityScores?.[l]||0), 1);
                const pct   = Math.min((score/maxS)*100, 100);
                const isGreen = liveData[lane]?.signal==='GREEN';
                const col   = isGreen ? '#22c55e' : '#3b82f6';
                return (
                  <div key={lane} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                    <span style={{ width:50,fontSize:11,color:'#64748b',textTransform:'uppercase', flexShrink:0 }}>
                      {lane}
                    </span>
                    <div style={{ flex:1, height:6, background:'#1e293b', borderRadius:3, overflow:'hidden' }}>
                      <div style={{
                        height:'100%', width:`${pct}%`, borderRadius:3,
                        background:`linear-gradient(90deg,${col},${col}88)`,
                        transition:'width 0.7s ease',
                        boxShadow: isGreen ? `0 0 6px ${col}` : 'none',
                      }}/>
                    </div>
                    <span style={{ width:36,fontSize:11,fontWeight:600,color:'#e2e8f0',textAlign:'right' }}>
                      {score}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Event log */}
            <div style={{ background:'#080f1a', border:'1px solid #0f1929', borderRadius:14, padding:16 }}>
              <h3 style={{ margin:'0 0 10px', fontSize:13, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1 }}>
                Recent Events
              </h3>
              {events.length===0 ? (
                <div style={{ fontSize:11, color:'#334155', fontStyle:'italic' }}>No events yet…</div>
              ) : events.slice(0,8).map(e => (
                <div key={e.id} style={{
                  display:'flex', gap:8, marginBottom:6,
                  fontSize:11,
                  color: e.type==='emergency' ? '#f87171' : '#64748b',
                }}>
                  <span style={{ color:'#334155', fontFamily:'monospace', flexShrink:0 }}>
                    {e.time.toLocaleTimeString()}
                  </span>
                  <span>{e.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        @keyframes emFlash { from{opacity:1} to{opacity:0.6} }
        @keyframes dash_em { from{opacity:1} to{opacity:0.7} }
      `}</style>
    </div>
  );
}
