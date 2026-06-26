import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const LeafIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-3.1 11.15-10 13Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
);

const WindIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>
);

const TrendDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
);

export default function PollutionControl() {
  const [socket, setSocket] = useState(null);
  const [metrics, setMetrics] = useState({ co2Saved: 0, fuelSaved: 0, idleTimeReduced: 0, airQualityIndex: 85 });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('state_update', (data) => {
      const totalVehicles = data.total_vehicles || 0;
      const efficiencyGain = data.mode === 'AI' ? 0.35 : 0;
      const co2Saved = Math.round(totalVehicles * 0.12 * efficiencyGain * 100) / 100;
      const fuelSaved = Math.round(totalVehicles * 0.05 * efficiencyGain * 100) / 100;
      const idleTimeReduced = Math.round(totalVehicles * 8 * efficiencyGain);
      
      setMetrics({ co2Saved, fuelSaved, idleTimeReduced, airQualityIndex: data.mode === 'AI' ? 72 : 85 });
      setHistory(prev => [{ time: new Date(), co2: co2Saved, fuel: fuelSaved }, ...prev.slice(0, 19)]);
    });

    return () => newSocket.close();
  }, []);

  const getAQIColor = (aqi) => aqi <= 50 ? 'bg-emerald-500' : aqi <= 100 ? 'bg-amber-500' : aqi <= 150 ? 'bg-orange-500' : 'bg-red-500';
  const getAQIText = (aqi) => aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Unhealthy for Sensitive' : 'Unhealthy';

  return (
    <div className="min-h-screen bg-[#06080F] text-white p-4 md:p-8 font-sans">
      <div className="mb-8 p-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-900/20 to-[#0A0D15] backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400"><LeafIcon /></div>
          <div>
            <h1 className="text-3xl font-bold text-white">Environmental Impact</h1>
            <p className="text-gray-400 mt-1">Real-time pollution monitoring & AI optimization benefits</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="p-6 rounded-2xl border border-gray-800 bg-[#0A0D15]/80">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><WindIcon /></div>
            <span className="text-gray-400 text-sm">CO₂ Emissions Reduced</span>
          </div>
          <div className="text-3xl font-bold text-white">{metrics.co2Saved.toFixed(1)}</div>
          <div className="text-sm text-emerald-400 mt-1 flex items-center gap-1"><TrendDownIcon /> kg saved today</div>
        </div>

        <div className="p-6 rounded-2xl border border-gray-800 bg-[#0A0D15]/80">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
            </div>
            <span className="text-gray-400 text-sm">Fuel Saved</span>
          </div>
          <div className="text-3xl font-bold text-white">{metrics.fuelSaved.toFixed(1)}</div>
          <div className="text-sm text-amber-400 mt-1 flex items-center gap-1"><TrendDownIcon /> liters today</div>
        </div>

        <div className="p-6 rounded-2xl border border-gray-800 bg-[#0A0D15]/80">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <span className="text-gray-400 text-sm">Idle Time Reduced</span>
          </div>
          <div className="text-3xl font-bold text-white">{metrics.idleTimeReduced}</div>
          <div className="text-sm text-blue-400 mt-1">seconds today</div>
        </div>

        <div className="p-6 rounded-2xl border border-gray-800 bg-[#0A0D15]/80">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>
            </div>
            <span className="text-gray-400 text-sm">Air Quality Index</span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getAQIColor(metrics.airQualityIndex)}`}></div>
            <span className="text-2xl font-bold text-white">{metrics.airQualityIndex}</span>
          </div>
          <div className="text-sm text-gray-400 mt-1">{getAQIText(metrics.airQualityIndex)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border border-gray-800 bg-[#0A0D15]/80">
          <h3 className="text-lg font-bold mb-4">Live Environmental Impact</h3>
          <div className="h-48 flex items-end gap-1">
            {history.slice(0, 20).reverse().map((point, i) => (
              <div key={i} className="flex-1 flex flex-col gap-0.5">
                <div className="bg-emerald-500/60 rounded-t" style={{ height: `${Math.min(point.co2 * 10, 100)}px` }}></div>
                <div className="bg-amber-500/60 rounded-t" style={{ height: `${Math.min(point.fuel * 15, 80)}px` }}></div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500/60 rounded"></div><span className="text-gray-400">CO₂ Saved</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500/60 rounded"></div><span className="text-gray-400">Fuel Saved</span></div>
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-gray-800 bg-[#0A0D15]/80">
          <h3 className="text-lg font-bold mb-4">AI Traffic Management Benefits</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5"><LeafIcon /></div>
              <div>
                <h4 className="font-semibold text-emerald-400">35% Reduction in Emissions</h4>
                <p className="text-sm text-gray-400 mt-1">AI optimization reduces vehicle idle time and stop-and-go traffic</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <div>
                <h4 className="font-semibold text-blue-400">Improved Air Quality</h4>
                <p className="text-sm text-gray-400 mt-1">Real-time monitoring helps reduce pollutants in high-traffic areas</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div>
                <h4 className="font-semibold text-amber-400">Cost Savings</h4>
                <p className="text-sm text-gray-400 mt-1">Reduced fuel consumption saves money for commuters and city</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
