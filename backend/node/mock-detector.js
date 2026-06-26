/**
 * mock-detector.js
 * Simulates the Python AI detection backend by posting realistic,
 * time-varying vehicle counts to the Node.js /detections endpoint.
 * Run with: node mock-detector.js
 */

const http = require('http');

const NODE_URL  = 'http://localhost:5000/detections';
const INTERVAL  = 1000; // ms — same cadence as Python sync

const LANES = ['north', 'east', 'south', 'west'];

// ─── Lane traffic profiles ─────────────────────────────────────────────────
// Each lane has a "base" vehicle count + randomness + occasional spikes.
const PROFILES = {
  north: { base: 6,  spike: 18, spikeChance: 0.08 },
  east:  { base: 12, spike: 22, spikeChance: 0.12 },
  south: { base: 3,  spike: 10, spikeChance: 0.06 },
  west:  { base: 9,  spike: 20, spikeChance: 0.10 },
};

// ─── State ─────────────────────────────────────────────────────────────────
let tick         = 0;
let spikeActive  = {};   // lane → ticks remaining in spike
let emergency    = null; // { lane, ticksLeft }

LANES.forEach(l => { spikeActive[l] = 0; });

// ─── Vehicle type distributions ────────────────────────────────────────────
function randomTypes(total) {
  const types = {};
  let remaining = total;

  const splits = [
    ['Car',          0.45],
    ['Motorcycle',   0.20],
    ['Bus',          0.08],
    ['Truck',        0.07],
    ['Autorickshaw', 0.10],
    ['Bicycle',      0.05],
    ['Person',       0.05],
  ];

  for (const [type, ratio] of splits) {
    const count = Math.round(total * ratio * (0.7 + Math.random() * 0.6));
    if (count > 0 && remaining > 0) {
      types[type] = Math.min(count, remaining);
      remaining  -= types[type];
    }
  }
  return types;
}

// ─── Calculate priority score (mirrors Python logic) ───────────────────────
function calcPriority(types, hasEmergency) {
  const weights = {
    Ambulance: 500, Bus: 8, Truck: 5, Car: 2,
    Autorickshaw: 2, 'Two-Wheeler': 1, Motorcycle: 1, Bicycle: 1, Person: 0,
  };
  let score = hasEmergency ? 1000 : 0;
  for (const [t, c] of Object.entries(types)) {
    score += (weights[t] || 1) * c;
  }
  return score;
}

// ─── Build one frame of detection data ─────────────────────────────────────
function buildDetections() {
  tick++;

  // Every ~40 ticks trigger a random emergency on a random lane (lasts 15s)
  if (!emergency && Math.random() < 0.025) {
    emergency = { lane: LANES[Math.floor(Math.random() * LANES.length)], ticksLeft: 15 };
    console.log(`🚨 EMERGENCY triggered on ${emergency.lane.toUpperCase()} (15s)`);
  }
  if (emergency) emergency.ticksLeft--;
  if (emergency && emergency.ticksLeft <= 0) {
    console.log(`✅ Emergency on ${emergency.lane.toUpperCase()} cleared`);
    emergency = null;
  }

  const detections = {};

  for (const lane of LANES) {
    const prof = PROFILES[lane];

    // Spike logic
    if (spikeActive[lane] > 0) {
      spikeActive[lane]--;
    } else if (Math.random() < prof.spikeChance) {
      spikeActive[lane] = Math.floor(Math.random() * 8) + 5;
      console.log(`📈 Spike on ${lane.toUpperCase()} (${spikeActive[lane]}s)`);
    }

    const inSpike  = spikeActive[lane] > 0;
    const rawCount = inSpike
      ? prof.spike + Math.floor((Math.random() - 0.5) * 6)
      : prof.base  + Math.floor((Math.random() - 0.5) * 4);
    const vehicles = Math.max(0, rawCount);

    // Emergency vehicle
    const isEmergencyLane = emergency && emergency.lane === lane;
    const ambulances      = isEmergencyLane
      ? [{ conf: 75 + Math.random() * 20, type: 'ambulance' }]
      : [];

    const vTypes = randomTypes(vehicles);
    if (isEmergencyLane && ambulances.length) vTypes['Ambulance'] = 1;

    const priority_score = calcPriority(vTypes, isEmergencyLane);

    // Build a simple sliding-window smoothed count (just ±1 noise reduction)
    detections[lane] = {
      vehicles,
      smoothed_vehicles: Math.max(0, vehicles + Math.floor((Math.random() - 0.5) * 2)),
      ambulance:         isEmergencyLane,
      ambulance_conf:    isEmergencyLane ? ambulances[0].conf : 0,
      ambulances,
      vehicle_types:     vTypes,
      priority_score,
    };
  }

  return detections;
}

// ─── Post to Node.js ────────────────────────────────────────────────────────
function postDetections(detections) {
  const body    = JSON.stringify({ detections });
  const options = {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };

  const url = new URL(NODE_URL);
  const req = http.request({ ...options, hostname: url.hostname, port: url.port, path: url.pathname }, res => {
    if (res.statusCode !== 200) console.warn(`[mock] Node responded ${res.statusCode}`);
  });
  req.on('error', () => {}); // silent — node may not be ready yet
  req.write(body);
  req.end();
}

// ─── Main loop ──────────────────────────────────────────────────────────────
console.log('🚗 Mock Vehicle Detector started');
console.log(`   Posting to: ${NODE_URL}`);
console.log('   Profiles: N=6 | E=12 | S=3 | W=9 base vehicles');
console.log('   Emergency events: ~every 40s on a random lane\n');

setInterval(() => {
  const detections = buildDetections();
  postDetections(detections);

  // Log summary every 5 ticks
  if (tick % 5 === 0) {
    const summary = LANES.map(l =>
      `${l[0].toUpperCase()}:${detections[l].vehicles}${detections[l].ambulance ? '🚨' : ''}`
    ).join(' ');
    console.log(`[tick ${String(tick).padStart(4)}] ${summary}`);
  }
}, INTERVAL);
