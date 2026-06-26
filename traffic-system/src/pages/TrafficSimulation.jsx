import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

export default function TrafficSimulation() {
  const [systemData, setSystemData] = useState({
    north: { vehicles: 0, signal: 'RED', time: 0, vehicleTypes: {} },
    east: { vehicles: 0, signal: 'RED', time: 0, vehicleTypes: {} },
    south: { vehicles: 0, signal: 'RED', time: 0, vehicleTypes: {} },
    west: { vehicles: 0, signal: 'RED', time: 0, vehicleTypes: {} },
    weather: 'Clear',
    mode: 'AI',
    emergency: false,
    stats: {},
    staticConfig: { cycleTime: 30, yellowTime: 3, rainExtraTime: 10 }
  });

  const [connected, setConnected] = useState(false);
  const [staticSettings, setStaticSettings] = useState({
    cycleTime: 30,
    yellowTime: 3,
    rainExtraTime: 10
  });
  const [logs, setLogs] = useState([]);

  // Video references to control play/pause
  const videoRefs = {
    north: useRef(null),
    east: useRef(null),
    south: useRef(null),
    west: useRef(null)
  };

  // Add log entry
  const addLog = useCallback((message, type = 'info') => {
    setLogs(prev => {
      const newLogs = [{ message, type, time: new Date().toLocaleTimeString() }, ...prev];
      return newLogs.slice(0, 50); // Keep last 50 logs
    });
  }, []);

  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true);
      addLog('Connected to traffic control server', 'success');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      addLog('Disconnected from server', 'error');
    });

    socket.on('state_update', (data) => {
      setSystemData(data);
      
      // Control Video Playback
      ['north', 'east', 'south', 'west'].forEach(lane => {
        const vid = videoRefs[lane].current;
        if (vid) {
          if (data[lane].signal === 'GREEN') {
            if (vid.paused) vid.play().catch(e => console.warn('Play interrupted:', e));
          } else {
            if (!vid.paused) vid.pause();
          }
        }
      });

      // Log emergency events
      if (data.emergency) {
        addLog(`Emergency: Ambulance priority active`, 'emergency');
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('state_update');
    };
  }, [addLog]);

  const setMode = async (newMode) => {
    try {
      const response = await fetch('http://localhost:5000/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode: newMode,
          staticSettings: newMode === 'STATIC' ? staticSettings : undefined
        })
      });
      const data = await response.json();
      if (data.success) {
        addLog(`Switched to ${newMode} mode`, 'success');
      }
    } catch(e) {
      console.error(e);
      addLog(`Failed to switch mode: ${e.message}`, 'error');
    }
  };

  const updateStaticConfig = async () => {
    try {
      const response = await fetch('http://localhost:5000/static-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staticSettings)
      });
      const data = await response.json();
      if (data.success) {
        addLog(`Static config updated: ${staticSettings.cycleTime}s cycle`, 'success');
      }
    } catch (e) {
      addLog(`Failed to update config: ${e.message}`, 'error');
    }
  };

  const clearEmergency = async () => {
    try {
      await fetch('http://localhost:5000/emergency-clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      addLog('Emergency manually cleared', 'warning');
    } catch (e) {
      addLog(`Failed to clear emergency: ${e.message}`, 'error');
    }
  };

  // Calculate total vehicles across all lanes
  const totalVehicles = ['north', 'east', 'south', 'west'].reduce(
    (sum, lane) => sum + (systemData[lane]?.vehicles || 0), 0
  );

  // Vehicle type breakdown
  const getVehicleTypeBreakdown = (lane) => {
    const types = systemData[lane]?.vehicleTypes || {};
    return Object.entries(types)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ') || 'No vehicles detected';
  };

  return (
    <div style={{ backgroundColor: '#0f141f', minHeight: '100vh', color: 'white', display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1f2937', paddingBottom: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', background: 'linear-gradient(90deg, #00ffaa, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AI Traffic Control System
          </h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            Intelligent Signal Management • Real-time Detection • Emergency Priority
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', background: '#171e2e', padding: '4px 8px', borderRadius: '8px', border: '1px solid #2d3748' }}>
          <button 
            onClick={() => setMode('STATIC')}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              background: systemData.mode === 'STATIC' ? '#2563eb' : 'transparent', 
              color: systemData.mode === 'STATIC' ? 'white' : '#94a3b8', 
              border: 'none', 
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
          >
            Static Mode
          </button>
          <button 
            onClick={() => setMode('AI')}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              background: systemData.mode === 'AI' ? '#2563eb' : 'transparent', 
              color: systemData.mode === 'AI' ? 'white' : '#94a3b8', 
              border: 'none', 
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
          >
            AI Mode
          </button>
        </div>

        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', alignItems: 'center' }}>
          {systemData.emergency && (
            <button
              onClick={clearEmergency}
              style={{
                padding: '6px 12px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                animation: 'pulse 1s infinite'
              }}
            >
              Clear Emergency
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{color: '#94a3b8', fontSize: '11px'}}>Signal Link</span>
            <span style={{color: connected ? '#4ade80' : '#ef4444', fontWeight: 'bold'}}>
              {connected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div style={{ padding: '4px 12px', background: connected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', border: `1px solid ${connected ? '#22c55e' : '#ef4444'}`, color: connected ? '#4ade80' : '#ef4444', borderRadius: '20px', display: 'flex', alignItems: 'center', fontSize: '12px' }}>
            <div style={{ width: '8px', height: '8px', background: connected ? '#4ade80' : '#ef4444', borderRadius: '50%', marginRight: '8px', animation: connected ? 'pulse 2s infinite' : 'none' }}></div>
            BACKEND {connected ? 'CONNECTED' : 'DISCONNECTED'}
          </div>
        </div>
      </div>

      {/* Static Mode Configuration Panel */}
      {systemData.mode === 'STATIC' && (
        <div style={{ background: '#1e293b', borderRadius: '8px', padding: '16px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Static Mode Configuration</h3>
            <button 
              onClick={updateStaticConfig}
              style={{
                padding: '6px 12px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Apply Settings
            </button>
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Green Time (seconds)</label>
              <input
                type="number"
                value={staticSettings.cycleTime}
                onChange={(e) => setStaticSettings({...staticSettings, cycleTime: parseInt(e.target.value)})}
                style={{
                  padding: '6px 10px',
                  background: '#0f141f',
                  border: '1px solid #334155',
                  borderRadius: '4px',
                  color: 'white',
                  width: '100px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Yellow Time (seconds)</label>
              <input
                type="number"
                value={staticSettings.yellowTime}
                onChange={(e) => setStaticSettings({...staticSettings, yellowTime: parseInt(e.target.value)})}
                style={{
                  padding: '6px 10px',
                  background: '#0f141f',
                  border: '1px solid #334155',
                  borderRadius: '4px',
                  color: 'white',
                  width: '100px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Rain Extra Time (seconds)</label>
              <input
                type="number"
                value={staticSettings.rainExtraTime}
                onChange={(e) => setStaticSettings({...staticSettings, rainExtraTime: parseInt(e.target.value)})}
                style={{
                  padding: '6px 10px',
                  background: '#0f141f',
                  border: '1px solid #334155',
                  borderRadius: '4px',
                  color: 'white',
                  width: '100px'
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, gap: '16px', height: 'calc(100vh - 120px)' }}>
        
        {/* LEFT: 2x2 Video Grid */}
        <div style={{ 
          flex: '1', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2px', 
          background: '#0a0d14', border: '1px solid #2d3748', borderRadius: '8px', overflow: 'hidden'
        }}>
          {['north', 'east', 'south', 'west'].map((lane, idx) => {
            const laneObj = systemData[lane];
            const isGreen = laneObj.signal === 'GREEN';
            const isYel = laneObj.signal === 'YELLOW';
            const isEmergency = systemData.emergency && systemData[lane].signal === 'GREEN';
            let colorStr = isGreen ? '#4ade80' : (isYel ? '#facc15' : '#ef4444');
            if (isEmergency) colorStr = '#dc2626';

            return (
              <div key={lane} style={{ position: 'relative', width: '100%', height: '100%', background: '#1e293b' }}>
                <video 
                  ref={videoRefs[lane]}
                  src={`/${lane}.mp4`} 
                  loop muted 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isGreen ? 1 : 0.4, transition: 'opacity 0.3s ease' }} 
                />
                
                <div style={{ 
                  position: 'absolute', 
                  top: '16px', 
                  left: '16px', 
                  background: 'rgba(15, 20, 31, 0.9)', 
                  backdropFilter: 'blur(4px)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: `1px solid ${colorStr}`,
                  minWidth: '160px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}>
                     <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colorStr, boxShadow: isGreen ? `0 0 10px ${colorStr}` : 'none' }}></div>
                     {idx + 1} {lane}
                     {isEmergency && <span style={{ color: '#dc2626', marginLeft: '4px' }}>🚑</span>}
                  </div>
                  <div style={{ color: colorStr, fontSize: '24px', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '1px' }}>
                    {isGreen || isYel ? `${laneObj.signal} ${laneObj.time}s` : 'STOP RED'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                    {laneObj.vehicles} vehicles
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    {getVehicleTypeBreakdown(lane)}
                  </div>
                </div>

                {laneObj.vehicles > 0 && !isEmergency && (
                  <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', width: '60px', height: '60px', border: `2px solid ${colorStr}`, background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
                    <div style={{ position: 'absolute', top: '-20px', left: '0', background: colorStr, color: 'black', fontSize: '9px', padding: '2px 6px', fontWeight: 'bold', borderRadius: '2px' }}>
                      {laneObj.vehicles} vehicles
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT: Status Dashboard */}
        <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Signal Control */}
          <div style={{ background: '#171e2e', borderRadius: '12px', padding: '16px', border: '1px solid #2d3748' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
               <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></div>
               <h2 style={{ fontSize: '12px', color: '#94a3b8', letterSpacing: '2px', fontWeight: 'bold' }}>SIGNAL CONTROL</h2>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['north', 'east', 'south', 'west'].map(lane => {
                const laneObj = systemData[lane];
                const isActive = laneObj.signal === 'GREEN';
                const isYel = laneObj.signal === 'YELLOW';
                const isEmergency = systemData.emergency && isActive;
                let colorHex = isActive ? (isEmergency ? '#dc2626' : '#4ade80') : (isYel ? '#eab308' : '#ef4444');
                
                return (
                  <div key={lane} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '12px 16px', 
                    background: isActive ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.02)', 
                    border: isActive ? `1px solid ${colorHex}` : '1px solid transparent', 
                    borderRadius: '8px',
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '16px', 
                        height: '16px', 
                        borderRadius: '50%', 
                        background: colorHex, 
                        boxShadow: isActive ? `0 0 15px ${colorHex}` : 'none',
                        animation: isEmergency ? 'pulse 1s infinite' : 'none'
                      }}></div>
                      <div>
                        <div style={{ color: isActive ? colorHex : '#cbd5e1', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '13px' }}>
                          {lane}
                          {isEmergency && <span style={{ marginLeft: '6px', fontSize: '11px' }}>🚑 EMERGENCY</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {laneObj.vehicles} vehicles • {laneObj.time}s remaining
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: colorHex, fontWeight: 'bold' }}>
                      {laneObj.signal}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System Overview */}
          <div style={{ background: '#171e2e', borderRadius: '12px', padding: '16px', border: '1px solid #2d3748' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
               <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></div>
               <h2 style={{ fontSize: '12px', color: '#94a3b8', letterSpacing: '2px', fontWeight: 'bold' }}>SYSTEM OVERVIEW</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: '#0f141f', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{totalVehicles}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total Vehicles</div>
              </div>
              <div style={{ background: '#0f141f', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: systemData.weather === 'Rain' ? '#60a5fa' : '#fbbf24' }}>
                  {systemData.weather === 'Rain' ? '🌧️' : '☀️'}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{systemData.weather}</div>
              </div>
              <div style={{ background: '#0f141f', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: systemData.mode === 'AI' ? '#8b5cf6' : '#6b7280' }}>
                  {systemData.mode}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Active Mode</div>
              </div>
              <div style={{ background: '#0f141f', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: systemData.emergency ? '#dc2626' : '#22c55e' }}>
                  {systemData.emergency ? '⚠️' : '✓'}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {systemData.emergency ? 'Emergency' : 'Normal'}
                </div>
              </div>
            </div>
          </div>

          {/* Weather Impact */}
          <div style={{ background: '#171e2e', borderRadius: '12px', padding: '16px', border: '1px solid #2d3748' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
               <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></div>
               <h2 style={{ fontSize: '12px', color: '#94a3b8', letterSpacing: '2px', fontWeight: 'bold' }}>WEATHER IMPACT</h2>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
               <div style={{ fontSize: '36px' }}>{systemData.weather === 'Rain' ? '🌧️' : '☀️'}</div>
               <div>
                 <div style={{ color: 'white', fontWeight: 'bold' }}>Weather: <span style={{ color: systemData.weather === 'Rain' ? '#60a5fa' : '#fbbf24' }}>{systemData.weather}</span></div>
                 {systemData.weather === 'Rain' 
                   ? <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>Extended green time applied (+10s)<br/>Caution: Wet road conditions</div>
                   : <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>Optimal surface conditions detected<br/>Normal signal timing active</div>
                 }
               </div>
            </div>
          </div>

          {/* Event Log */}
          <div style={{ background: '#171e2e', borderRadius: '12px', padding: '16px', border: '1px solid #2d3748', flex: 1, maxHeight: '250px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
               <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></div>
               <h2 style={{ fontSize: '12px', color: '#94a3b8', letterSpacing: '2px', fontWeight: 'bold' }}>EVENT LOG</h2>
            </div>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px', 
              fontSize: '12px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {logs.length === 0 ? (
                <div style={{ color: '#64748b', fontStyle: 'italic' }}>No events yet...</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    gap: '8px',
                    color: log.type === 'emergency' ? '#ef4444' : 
                           log.type === 'error' ? '#ef4444' : 
                           log.type === 'success' ? '#22c55e' : 
                           log.type === 'warning' ? '#f59e0b' : '#94a3b8',
                    fontWeight: log.type === 'emergency' ? 'bold' : 'normal'
                  }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '10px' }}>{log.time}</span>
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
