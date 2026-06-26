import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');
const LANES  = ['north', 'east', 'south', 'west'];

const LANE_META = {
  north: { icon: '⬆', label: 'NORTH', dir: 'N' },
  east:  { icon: '➡', label: 'EAST',  dir: 'E' },
  south: { icon: '⬇', label: 'SOUTH', dir: 'S' },
  west:  { icon: '⬅', label: 'WEST',  dir: 'W' },
};

const VEHICLE_ICONS = {
  'Car': '🚗', 'Truck': '🚛', 'Bus': '🚌',
  'Motorcycle': '🏍', 'Two-Wheeler': '🏍',
  'Bicycle': '🚲', 'Person': '🚶',
  'Autorickshaw': '🛺', 'Ambulance': '🚑',
  'Fire Brigade': '🚒', 'Police': '🚔', 'Utility': '🚐',
};

const SIG_COLOR = { GREEN: '#22c55e', YELLOW: '#fbbf24', RED: '#ef4444' };

// ─── Circular countdown ring component ───────────────────────────────────────
function SignalRing({ signal, timer, size = 52 }) {
  const color   = SIG_COLOR[signal] || '#6b7280';
  const maxTime = signal === 'GREEN' ? 30 : signal === 'YELLOW' ? 4 : 1;
  const pct     = signal === 'RED' ? 0 : Math.min(timer / maxTime, 1);
  const r       = (size - 8) / 2;
  const circ    = 2 * Math.PI * r;
  const dash    = pct * circ;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.08)" strokeWidth="6"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.9s linear', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, color,
      }}>
        {signal === 'RED' ? '—' : `${timer}s`}
      </div>
    </div>
  );
}

// ─── Single lane card ─────────────────────────────────────────────────────────
function LaneCard({ lane, data, frame, isEmergency, emergencyLanes, mode }) {
  const sig   = data.signal || 'RED';
  const color = SIG_COLOR[sig];
  const em    = isEmergency && emergencyLanes?.includes(lane);

  return (
    <div style={{
      position: 'relative', background: '#0d1117',
      border: `2px solid ${em ? '#ef4444' : sig === 'GREEN' ? '#22c55e33' : '#1f2937'}`,
      borderRadius: 12, overflow: 'hidden',
      boxShadow: em ? '0 0 20px #ef444455' : sig === 'GREEN' ? '0 0 14px #22c55e22' : 'none',
      transition: 'all 0.4s ease',
    }}>

      {/* Video / AI frame */}
      <div style={{ position: 'relative', paddingTop: '56.25%', background: '#050a12' }}>
        {mode === 'AI' && frame ? (
          <img
            src={frame}
            alt={`${lane} AI detection`}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', opacity: sig === 'RED' ? 0.45 : 1,
              transition: 'opacity 0.5s ease',
            }}
          />
        ) : (
          <video
            src={`/${lane}.mp4`}
            autoPlay loop muted playsInline
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover',
              opacity: sig === 'RED' ? 0.35 : 1,
              filter: sig === 'RED' ? 'grayscale(50%)' : 'none',
              transition: 'opacity 0.5s ease, filter 0.5s ease',
            }}
          />
        )}

        {/* Emergency flash overlay */}
        {em && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(239,68,68,0.15)',
            animation: 'em-flash 0.6s ease-in-out infinite alternate',
            pointerEvents: 'none',
          }}/>
        )}

        {/* Lane label badge */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          border: `1px solid ${color}`, borderRadius: 8,
          padding: '4px 10px', display: 'flex', gap: 6, alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{LANE_META[lane].dir}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: 1 }}>
            {LANE_META[lane].label}
          </span>
          {em && <span style={{ fontSize: 13, animation: 'pulse 0.8s infinite' }}>🚨</span>}
        </div>

        {/* Mode badge */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: mode === 'AI' ? 'rgba(139,92,246,0.85)' : 'rgba(100,116,139,0.85)',
          borderRadius: 6, padding: '2px 8px',
          fontSize: 10, fontWeight: 700, color: 'white',
        }}>
          {mode === 'AI' ? '🤖 AI' : '⏱ STATIC'}
        </div>
      </div>

      {/* Info bar */}
      <div style={{
        padding: '10px 14px', display: 'flex', alignItems: 'center',
        gap: 12, background: '#0d1117',
      }}>
        <SignalRing signal={sig} timer={data.time || 0} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: color, fontWeight: 700, letterSpacing: 1 }}>{sig}</span>
            {data.time > 0 && sig !== 'RED' && (
              <span style={{ fontSize: 10, color: '#64748b' }}>· {data.time}s left</span>
            )}
          </div>
          {/* Vehicle type mini chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(data.vehicleTypes || {}).slice(0, 4).map(([type, cnt]) => (
              <span key={type} style={{
                background: '#1e293b', borderRadius: 4,
                padding: '1px 6px', fontSize: 10, color: '#94a3b8',
              }}>
                {VEHICLE_ICONS[type] || '🚗'} {cnt}
              </span>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>
            {data.vehicles || 0}
          </div>
          <div style={{ fontSize: 10, color: '#64748b' }}>vehicles</div>
        </div>
      </div>
    </div>
  );
}

// ─── Priority score bar ───────────────────────────────────────────────────────
function PriorityBar({ lane, score, maxScore, isGreen, isEmergency }) {
  const pct   = maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0;
  const color = isEmergency ? '#ef4444' : isGreen ? '#22c55e' : '#3b82f6';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ width: 50, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>{lane}</span>
      <div style={{ flex: 1, height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 3,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          transition: 'width 0.7s ease',
          boxShadow: isGreen ? `0 0 6px ${color}` : 'none',
        }}/>
      </div>
      <span style={{ width: 34, textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>
        {score}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TrafficSimulation() {
  const [data, setData] = useState({
    north: { vehicles: 0, signal: 'RED', time: 0, vehicleTypes: {} },
    east:  { vehicles: 0, signal: 'RED', time: 0, vehicleTypes: {} },
    south: { vehicles: 0, signal: 'RED', time: 0, vehicleTypes: {} },
    west:  { vehicles: 0, signal: 'RED', time: 0, vehicleTypes: {} },
    mode: 'AI', emergency: false, emergencyLanes: [],
    stats: {}, staticConfig: { cycleTime: 30, yellowTime: 3 },
    priorityScores: { north: 0, east: 0, south: 0, west: 0 },
    activeLane: 'north',
  });

  const [connected,     setConnected]     = useState(socket.connected);
  const [frames,        setFrames]        = useState({ north: null, east: null, south: null, west: null });
  const [logs,          setLogs]          = useState([]);
  const [staticSettings, setStaticSettings] = useState({ cycleTime: 30, yellowTime: 3 });
  const [showConfig,    setShowConfig]    = useState(false);
  const prevDataRef = useRef(data);

  const addLog = useCallback((message, type = 'info') => {
    setLogs(prev => [{ message, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 80));
  }, []);

  // ── Socket ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Handle case where socket was already connected before this effect ran
    if (socket.connected) setConnected(true);

    socket.on('connect',    () => { setConnected(true);  addLog('Connected to control server', 'success'); });
    socket.on('disconnect', () => { setConnected(false); addLog('Lost connection to server', 'error'); });

    socket.on('state_update', (d) => {
      // Any state_update proves the socket is alive
      setConnected(true);
      setData(d);

      const prev = prevDataRef.current;
      if (d.emergency && !prev.emergency) {
        const lanes = (d.emergencyLanes || []).join(', ').toUpperCase();
        addLog(`🚨 EMERGENCY DETECTED on ${lanes || 'unknown lane'}`, 'emergency');
      }
      if (!d.emergency && prev.emergency) {
        addLog('✅ Emergency cleared — resuming normal scheduling', 'success');
      }

      const prevGreen = LANES.find(l => prev[l]?.signal === 'GREEN');
      const nowGreen  = LANES.find(l => d[l]?.signal  === 'GREEN');
      if (nowGreen && nowGreen !== prevGreen) {
        addLog(`Signal → ${nowGreen.toUpperCase()} GREEN (${d[nowGreen]?.time}s)`, 'info');
      }
      prevDataRef.current = d;
    });

    return () => { socket.off('connect'); socket.off('disconnect'); socket.off('state_update'); };
  }, [addLog]);

  // ── Fetch AI detection frames every 200ms ───────────────────────────────────
  useEffect(() => {
    const objUrls = { north: null, east: null, south: null, west: null };

    const fetch_frame = async (lane) => {
      try {
        const res  = await fetch(`http://localhost:8000/frame/${lane}`);
        if (!res.ok) return;
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        if (objUrls[lane]) URL.revokeObjectURL(objUrls[lane]);
        objUrls[lane] = url;
        setFrames(prev => ({ ...prev, [lane]: url }));
      } catch { /* python not ready */ }
    };

    const interval = setInterval(() => {
      LANES.forEach(l => fetch_frame(l));
    }, 250);

    return () => {
      clearInterval(interval);
      Object.values(objUrls).forEach(u => u && URL.revokeObjectURL(u));
    };
  }, []);

  // ── API helpers ──────────────────────────────────────────────────────────────
  const setMode = async (mode) => {
    try {
      const res = await fetch('http://localhost:5000/mode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, staticSettings: mode === 'STATIC' ? staticSettings : undefined }),
      });
      if ((await res.json()).success) addLog(`Switched to ${mode} mode`, 'success');
    } catch { addLog('Mode switch failed', 'error'); }
  };

  const updateStaticConfig = async () => {
    try {
      await fetch('http://localhost:5000/static-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staticSettings),
      });
      addLog(`Config: ${staticSettings.cycleTime}s green / ${staticSettings.yellowTime}s yellow`, 'success');
    } catch { addLog('Config update failed', 'error'); }
  };

  const clearEmergency = async () => {
    try {
      await fetch('http://localhost:5000/emergency-clear', { method: 'POST' });
      addLog('Emergency manually cleared', 'warning');
    } catch { addLog('Failed to clear emergency', 'error'); }
  };

  // ── Computed ─────────────────────────────────────────────────────────────────
  const totalVehicles  = LANES.reduce((s, l) => s + (data[l]?.vehicles || 0), 0);
  const maxPriorScore  = Math.max(...LANES.map(l => data.priorityScores?.[l] || 0), 1);
  const activeGreen    = LANES.find(l => data[l]?.signal === 'GREEN');
  const isEmergency    = data.emergency;

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(145deg, #020812 0%, #0a0f1a 60%, #0d1220 100%)',
      color: '#e2e8f0', fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: 20, boxSizing: 'border-box',
    }}>

      {/* ── Emergency Alert Banner ── */}
      {isEmergency && (
        <div style={{
          background: 'linear-gradient(90deg, #7f1d1d, #991b1b)',
          border: '1px solid #ef4444', borderRadius: 12,
          padding: '12px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12,
          animation: 'em-flash 0.8s ease-in-out infinite alternate',
          boxShadow: '0 0 24px #ef444455',
        }}>
          <span style={{ fontSize: 24, animation: 'pulse 0.6s infinite' }}>🚨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#fca5a5' }}>
              EMERGENCY VEHICLE PRIORITY ACTIVE
            </div>
            <div style={{ fontSize: 12, color: '#fca5a5', opacity: 0.8 }}>
              Lanes:{' '}
              {(data.emergencyLanes || []).map(l => l.toUpperCase()).join(' + ') || 'Unknown'}
              {' — All signals cleared for emergency passage'}
            </div>
          </div>
          <button onClick={clearEmergency} style={{
            padding: '6px 14px', background: '#dc2626',
            border: '1px solid #ef4444', borderRadius: 6,
            color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12,
          }}>
            Override &amp; Clear
          </button>
        </div>
      )}

      {/* ── Top Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 800,
            background: 'linear-gradient(90deg, #00e5ff, #a855f7, #22c55e)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: 0.5,
          }}>
            Smart Traffic Management System
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#475569' }}>
            YOLOv8 · 4-Lane Real-Time Detection · Smart Signal Scheduling
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 6, background: '#0d1117', padding: 4, borderRadius: 10, border: '1px solid #1e293b' }}>
          {['AI', 'STATIC'].map(m => (
            <button
              key={m} onClick={() => setMode(m)}
              style={{
                padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: data.mode === m
                  ? (m === 'AI' ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'linear-gradient(135deg,#374151,#4b5563)')
                  : 'transparent',
                color: data.mode === m ? 'white' : '#64748b',
                fontWeight: 700, fontSize: 13, transition: 'all 0.25s ease',
                boxShadow: data.mode === m ? '0 2px 12px rgba(79,70,229,0.4)' : 'none',
              }}
            >
              {m === 'AI' ? '🤖 AI Mode' : '⏱ Static Mode'}
            </button>
          ))}
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Config button */}
          <button
            onClick={() => setShowConfig(c => !c)}
            style={{
              padding: '6px 12px', background: '#1e293b',
              border: '1px solid #334155', borderRadius: 7,
              color: '#94a3b8', cursor: 'pointer', fontSize: 12,
            }}
          >
            ⚙ Config
          </button>

          {/* Connection dot */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#0d1117', border: `1px solid ${connected ? '#22c55e40' : '#ef444440'}`,
            borderRadius: 20, padding: '5px 12px', fontSize: 11,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: connected ? '#22c55e' : '#ef4444',
              boxShadow: connected ? '0 0 8px #22c55e' : '0 0 8px #ef4444',
              animation: connected ? 'pulse 2s infinite' : 'none',
            }}/>
            <span style={{ color: connected ? '#4ade80' : '#f87171', fontWeight: 600 }}>
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Config Panel ── */}
      {showConfig && data.mode === 'STATIC' && (
        <div style={{
          background: '#0d1117', border: '1px solid #1e293b',
          borderRadius: 12, padding: 16, marginBottom: 16,
          display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <h3 style={{ margin: '0 16px 0 0', fontSize: 13, color: '#94a3b8', alignSelf: 'center' }}>
            Static Mode Settings
          </h3>
          {[
            { key: 'cycleTime', label: 'Green Time (s)', min: 5, max: 120 },
            { key: 'yellowTime', label: 'Yellow Time (s)', min: 2, max: 10 },
          ].map(({ key, label, min, max }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</label>
              <input
                type="number" min={min} max={max}
                value={staticSettings[key]}
                onChange={e => setStaticSettings(p => ({ ...p, [key]: parseInt(e.target.value) || min }))}
                style={{
                  width: 80, padding: '6px 10px',
                  background: '#1e293b', border: '1px solid #334155',
                  borderRadius: 6, color: 'white', fontSize: 13,
                }}
              />
            </div>
          ))}
          <button
            onClick={updateStaticConfig}
            style={{
              padding: '8px 16px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              border: 'none', borderRadius: 7, color: 'white',
              fontWeight: 700, cursor: 'pointer', fontSize: 13,
            }}
          >
            Apply
          </button>
        </div>
      )}

      {/* ── Main Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

        {/* LEFT: 2×2 Lane Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {LANES.map(lane => (
            <LaneCard
              key={lane}
              lane={lane}
              data={data[lane] || {}}
              frame={frames[lane]}
              isEmergency={isEmergency}
              emergencyLanes={data.emergencyLanes}
              mode={data.mode}
            />
          ))}
        </div>

        {/* RIGHT: Dashboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Stats strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
          }}>
            {[
              { label: 'Total Vehicles', value: totalVehicles, color: '#3b82f6', icon: '🚗' },
              {
                label: 'Active Lane', icon: '🟢',
                value: activeGreen ? activeGreen.toUpperCase() : '—',
                color: activeGreen ? '#22c55e' : '#64748b',
              },
              { label: 'AI Decisions', value: data.stats?.aiDecisions || 0, color: '#8b5cf6', icon: '🧠' },
              { label: 'Emergencies', value: data.stats?.emergencyResponses || 0, color: '#ef4444', icon: '🚨' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} style={{
                background: '#0d1117', border: '1px solid #1e293b',
                borderRadius: 10, padding: '12px 14px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Signal Status */}
          <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#475569', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>
              Signal Control
            </div>
            {LANES.map(lane => {
              const ld  = data[lane] || {};
              const sig = ld.signal || 'RED';
              const col = SIG_COLOR[sig];
              const em  = isEmergency && (data.emergencyLanes || []).includes(lane);

              return (
                <div key={lane} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', marginBottom: 6, borderRadius: 8,
                  background: sig === 'GREEN' ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${sig === 'GREEN' ? '#22c55e33' : 'transparent'}`,
                  transition: 'all 0.3s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', background: col,
                      boxShadow: sig === 'GREEN' ? `0 0 10px ${col}` : 'none',
                      animation: em ? 'pulse 0.6s infinite' : 'none',
                    }}/>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: col, letterSpacing: 1 }}>
                        {lane.toUpperCase()}
                      </span>
                      {em && <span style={{ marginLeft: 6, fontSize: 11 }}>🚑 EMERGENCY</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#475569' }}>{ld.vehicles || 0}v</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: col }}>{sig}</span>
                    {ld.time > 0 && sig !== 'RED' && (
                      <span style={{ fontSize: 11, color: '#64748b' }}>{ld.time}s</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Priority Scores */}
          <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#475569', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>
              AI Priority Scores
            </div>
            {LANES.map(lane => (
              <PriorityBar
                key={lane}
                lane={lane}
                score={data.priorityScores?.[lane] || 0}
                maxScore={maxPriorScore}
                isGreen={data[lane]?.signal === 'GREEN'}
                isEmergency={isEmergency && (data.emergencyLanes || []).includes(lane)}
              />
            ))}
            <div style={{ fontSize: 10, color: '#334155', marginTop: 8 }}>
              Algo: FCFS + Round-Robin + Sliding Window + Starvation Prevention
            </div>
          </div>

          {/* Vehicle Type Summary */}
          <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#475569', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>
              Live Vehicle Breakdown
            </div>
            {LANES.map(lane => {
              const types = data[lane]?.vehicleTypes || {};
              if (Object.keys(types).length === 0) return (
                <div key={lane} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 50, fontSize: 10, color: '#475569', textTransform: 'uppercase' }}>{lane}</span>
                  <span style={{ fontSize: 10, color: '#334155' }}>No vehicles</span>
                </div>
              );
              return (
                <div key={lane} style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ width: 50, flexShrink: 0, fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{lane}</span>
                  {Object.entries(types).map(([type, cnt]) => (
                    <span key={type} style={{
                      background: '#1e293b', borderRadius: 4, padding: '2px 7px',
                      fontSize: 10, color: '#94a3b8',
                    }}>
                      {VEHICLE_ICONS[type] || '🚗'} {type} ×{cnt}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Event Log */}
          <div style={{
            background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12,
            padding: 14, maxHeight: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontSize: 10, color: '#475569', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>
              Event Log
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {logs.length === 0 ? (
                <div style={{ fontSize: 11, color: '#334155', fontStyle: 'italic' }}>Waiting for events…</div>
              ) : logs.map((log, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 8, marginBottom: 4,
                  color: log.type === 'emergency' ? '#f87171'
                       : log.type === 'error'     ? '#f87171'
                       : log.type === 'success'   ? '#4ade80'
                       : log.type === 'warning'   ? '#fbbf24'
                       : '#64748b',
                  fontSize: 11,
                }}>
                  <span style={{ color: '#334155', fontFamily: 'monospace', flexShrink: 0 }}>{log.time}</span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Global keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes em-flash { from{opacity:1} to{opacity:0.7} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
      `}</style>
    </div>
  );
}
