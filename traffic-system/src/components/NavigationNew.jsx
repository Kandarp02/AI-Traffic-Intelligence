import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Traffic Control',
    desc: 'Live 4-lane dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    accent: '#22c55e',
  },
  {
    to: '/admin',
    label: 'District Monitor',
    desc: 'Junction overview',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
      </svg>
    ),
    accent: '#3b82f6',
  },
  {
    to: '/mode',
    label: 'AI vs Static',
    desc: 'Performance comparison',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <path d="M18 20V10M12 20V4M6 20v-6"/>
      </svg>
    ),
    accent: '#8b5cf6',
  },
];

export default function Navigation() {
  const [connected, setConnected] = useState(socket.connected);
  const [emergency, setEmergency] = useState(false);
  const [totalVeh,  setTotalVeh]  = useState(0);
  const [time,      setTime]      = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    // Eagerly mark as connected if socket is already up
    if (socket.connected) setConnected(true);

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('state_update', (d) => {
      setConnected(true);   // any data proves we're live
      setEmergency(d.emergency || false);
      const t = ['north','east','south','west'].reduce((s,l) => s + (d[l]?.vehicles||0), 0);
      setTotalVeh(t);
    });
    return () => { socket.off('connect'); socket.off('disconnect'); socket.off('state_update'); };
  }, []);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
      background: 'linear-gradient(180deg, #050a12 0%, #080f1c 100%)',
      borderRight: '1px solid #0f1929',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter','Segoe UI',sans-serif",
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #0f1929' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #22c55e, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>🚦</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.2 }}>
              SmartTraffic
            </div>
            <div style={{ fontSize: 10, color: '#475569' }}>AI Management v3.0</div>
          </div>
        </div>

        {/* Live time */}
        <div style={{
          background: '#0d1117', borderRadius: 6, padding: '4px 8px',
          fontSize: 11, color: '#64748b', fontFamily: 'monospace',
          textAlign: 'center',
        }}>
          {time.toLocaleTimeString()}
        </div>
      </div>

      {/* Nav links */}
      <div style={{ flex: 1, padding: '12px 12px' }}>
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to} to={item.to} end={item.to === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10, marginBottom: 4,
              textDecoration: 'none', transition: 'all 0.2s ease',
              background: isActive ? `${item.accent}15` : 'transparent',
              border: isActive ? `1px solid ${item.accent}30` : '1px solid transparent',
              color: isActive ? item.accent : '#64748b',
            })}
          >
            {({ isActive }) => (
              <>
                <div style={{ color: isActive ? item.accent : '#475569', flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: '#334155', marginTop: 1 }}>{item.desc}</div>
                </div>
                {isActive && (
                  <div style={{
                    marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
                    background: item.accent, boxShadow: `0 0 8px ${item.accent}`, flexShrink: 0,
                  }}/>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Status panel */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #0f1929' }}>
        {/* Emergency alert */}
        {emergency && (
          <div style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid #ef444440',
            borderRadius: 8, padding: '6px 10px', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
            animation: 'navPulse 1s ease-in-out infinite alternate',
          }}>
            <span style={{ fontSize: 14 }}>🚨</span>
            <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700 }}>EMERGENCY ACTIVE</span>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <div style={{
            flex: 1, background: '#0d1117', borderRadius: 7, padding: '6px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6' }}>{totalVeh}</div>
            <div style={{ fontSize: 9, color: '#334155' }}>VEHICLES</div>
          </div>
          <div style={{
            flex: 1, background: '#0d1117', borderRadius: 7, padding: '6px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: connected ? '#22c55e' : '#ef4444' }}>
              {connected ? 'LIVE' : 'OFF'}
            </div>
            <div style={{ fontSize: 9, color: '#334155' }}>STATUS</div>
          </div>
        </div>

        {/* Connection indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 10, color: '#334155',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: connected ? '#22c55e' : '#ef4444',
            boxShadow: connected ? '0 0 6px #22c55e' : 'none',
          }}/>
          {connected ? 'System connected' : 'Disconnected — check servers'}
        </div>
      </div>

      <style>{`
        @keyframes navPulse { from{opacity:1} to{opacity:0.7} }
      `}</style>
    </nav>
  );
}
