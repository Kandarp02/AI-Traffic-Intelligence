require('dotenv').config();

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const axios    = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

// ─── Constants ────────────────────────────────────────────────────────────────
const LANES         = ['north', 'east', 'south', 'west'];
const DEFAULT_MODE  = process.env.DEFAULT_MODE  || 'AI';
const STATIC_CYCLE  = parseInt(process.env.STATIC_CYCLE_TIME) || 30;
const YELLOW_TIME   = parseInt(process.env.YELLOW_TIME)       || 3;
const PYTHON_URL    = process.env.PYTHON_API_URL || 'http://localhost:8000';
const NODE_PORT     = parseInt(process.env.NODE_API_PORT)     || 5000;

// Fairness / starvation prevention
// Raised to 120s so vehicle-count-dominant scheduling can naturally pick the busiest
// lane multiple times before a low-density lane forces a fairness override.
const MAX_WAIT_THRESHOLD = 120;  // seconds before starvation override (safety fallback)
const STARVATION_MUL    = 3;     // bonus multiplier near starvation

// ─── Live detection data (from Python) ────────────────────────────────────────
let detections = {};
for (const l of LANES) {
  detections[l] = {
    vehicles: 0, smoothed_vehicles: 0, ambulance: false,
    ambulances: [], confidence: 0, vehicle_types: {}, priority_score: 0
  };
}

// ─── System state ─────────────────────────────────────────────────────────────
let systemState = {
  mode:      DEFAULT_MODE,
  emergency: false,
  emergencyLanes: [],          // ALL lanes currently with emergency
  lanes: {}
};
for (const l of LANES) {
  systemState.lanes[l] = { vehicles: 0, signal: 'RED', time: 0, vehicleTypes: {} };
}

// ─── AI Engine ────────────────────────────────────────────────────────────────
let engine = {
  activeLane:          'north',
  phase:               'GREEN',
  timer:               STATIC_CYCLE,
  // Emergency queue: ordered list of { lane, type, conf, detectedAt }
  emergencyQueue:      [],
  // currently serving emergency
  activeEmergency:     null,   // { lane, type, conf }
  emergencyTimer:      0,
  emergencyHistoryCooldown: {},   // lane→ticks since last emergency seen
  emergencyGraceTicks: { north: 0, east: 0, south: 0, west: 0 },
  // fairness / scheduling
  waitTime:            { north: 0, east: 0, south: 0, west: 0 },
  consecutiveSkips:    { north: 0, east: 0, south: 0, west: 0 },
  priorityScores:      { north: 0, east: 0, south: 0, west: 0 },
  prevVehicles:        { north: 0, east: 0, south: 0, west: 0 },
};

// ─── Static mode config ───────────────────────────────────────────────────────
let staticConfig = { cycleTime: STATIC_CYCLE, yellowTime: YELLOW_TIME };

// ─── History / analytics ──────────────────────────────────────────────────────
const MAX_HIST = 2000;
const history = {
  signalChanges:   [],
  vehicleCounts:   [],
  emergencyEvents: [],
  modeSwitches:    [],
  fairnessEvents:  [],
  stats: {
    totalVehiclesProcessed: 0, totalEmergencyPriority: 0,
    averageGreenTime: 0,        trafficSpikesHandled: 0,
    emptyLaneSkips: 0,          aiDecisions: 0,
    fairnessOverrides: 0,       maxWaitTime: 0,
    emergencyResponses: 0,
  }
};

function pushHistory(arr, item) {
  if (arr.length >= MAX_HIST) arr.shift();
  arr.push(item);
}

// ────────────────────────────────────────────────────────────────────────────────
// STATIC MODE HANDLER
// ────────────────────────────────────────────────────────────────────────────────
function handleStaticMode() {
  engine.timer--;

  if (engine.timer <= 0) {
    if (engine.phase === 'GREEN') {
      engine.phase = 'YELLOW';
      engine.timer = staticConfig.yellowTime;
      pushHistory(history.signalChanges, {
        timestamp: Date.now(), lane: engine.activeLane,
        from: 'GREEN', to: 'YELLOW', mode: 'STATIC'
      });

    } else if (engine.phase === 'YELLOW') {
      engine.activeLane = getNextLane(engine.activeLane);
      engine.phase = 'GREEN';
      engine.timer = staticConfig.cycleTime;
      pushHistory(history.signalChanges, {
        timestamp: Date.now(), lane: engine.activeLane,
        from: 'YELLOW', to: 'GREEN', mode: 'STATIC', duration: staticConfig.cycleTime
      });
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// AI MODE HANDLER — Round-Robin + FCFS + Sliding-Window + Emergency Priority
// ────────────────────────────────────────────────────────────────────────────────
function handleAiMode() {
  // 1. Update wait times for all lanes EXCEPT the active (serving) lane.
  //    Fixed: removed phase condition — active lane must NOT accumulate wait
  //    during YELLOW transition, otherwise it scores unfairly in the next pick.
  for (const l of LANES) {
    if (l !== engine.activeLane) {
      engine.waitTime[l] = (engine.waitTime[l] || 0) + 1;
    }
  }

  // 2. Refresh priority scores
  for (const l of LANES) {
    engine.priorityScores[l] = detections[l].priority_score || 0;
  }

  // 3. Track max wait for analytics
  const maxWait = Math.max(...LANES.map(l => engine.waitTime[l] || 0));
  if (maxWait > history.stats.maxWaitTime) history.stats.maxWaitTime = maxWait;

  // ── 4. EMERGENCY QUEUE MANAGEMENT ─────────────────────────────────────────
  //    Latching & grace period: If an emergency was detected in the last 12 seconds,
  //    we keep the emergency state active to prevent YOLO detection flicker from cancelling it.
  for (const l of LANES) {
    if (detections[l].ambulance) {
      engine.emergencyGraceTicks[l] = 12; // Latch emergency state for 12 seconds
    } else if (engine.emergencyGraceTicks[l] > 0) {
      engine.emergencyGraceTicks[l]--;
    }
  }

  const newEmergencies = LANES.filter(l => detections[l].ambulance || engine.emergencyGraceTicks[l] > 0);
  
  // Reset cooldown counters for lanes with active detection
  for (const l of newEmergencies) {
    engine.emergencyHistoryCooldown[l] = 0;
  }
  // Bump cooldown for lanes WITHOUT active detection
  for (const l of LANES) {
    if (!newEmergencies.includes(l)) {
      engine.emergencyHistoryCooldown[l] = (engine.emergencyHistoryCooldown[l] || 0) + 1;
    }
  }

  // Re-build emergency queue from current detections
  const freshQueue = newEmergencies.map(l => ({
    lane:        l,
    conf:        detections[l].confidence || 0.9,
    type:        detections[l].ambulances?.[0]?.type || 'ambulance',
    allAmbuls:   detections[l].ambulances || [],
    detectedAt:  Date.now(),
  }));
  // Sort by: highest confidence → longest detected (stale are later)
  freshQueue.sort((a, b) => b.conf - a.conf);

  // If we have an active emergency, check if it is still visible or in grace period
  if (engine.activeEmergency) {
    engine.emergencyTimer++;
    const stillActive = newEmergencies.includes(engine.activeEmergency.lane);
    const tooLong     = engine.emergencyTimer >= 35;  // max 35s per emergency

    if (!stillActive || tooLong) {
      console.log(`✅ [EMERGENCY PRIORITY] CLEARED on lane: ${engine.activeEmergency.lane.toUpperCase()} (served ${engine.emergencyTimer}s)`);
      // Emergency cleared → finish with yellow transition
      pushHistory(history.emergencyEvents, {
        timestamp: Date.now(), lane: engine.activeEmergency.lane,
        duration: engine.emergencyTimer, type: 'END'
      });
      engine.activeEmergency = null;
      engine.emergencyTimer  = 0;
      systemState.emergency  = false;
      systemState.emergencyLanes = [];
      engine.phase = 'YELLOW';
      engine.timer = 2;
      return;
    }

    // Check if a HIGHER priority emergency appeared on ANOTHER lane
    const betterLane = freshQueue.find(q =>
      q.lane !== engine.activeEmergency.lane && q.conf > engine.activeEmergency.conf + 15
    );
    if (betterLane) {
      console.log(`🚨 [EMERGENCY PREEMPT] Preempting ${engine.activeEmergency.lane.toUpperCase()} for more urgent emergency on ${betterLane.lane.toUpperCase()}`);
      pushHistory(history.emergencyEvents, {
        timestamp: Date.now(), lane: engine.activeEmergency.lane,
        duration: engine.emergencyTimer, type: 'SWITCH_PREEMPT'
      });
      engine.activeEmergency = betterLane;
      engine.emergencyTimer  = 0;
    }

    // Still serving emergency — lock green on that lane
    engine.activeLane = engine.activeEmergency.lane;
    engine.phase      = 'GREEN';
    engine.timer      = 99;
    systemState.emergency     = true;
    systemState.emergencyLanes = newEmergencies;
    return;
  }

  // No active emergency — start one if queue non-empty
  if (freshQueue.length > 0) {
    const target = freshQueue[0];
    console.log(`🚨 [EMERGENCY PRIORITY] ACTIVE on lane: ${target.lane.toUpperCase()}`);

    pushHistory(history.emergencyEvents, {
      timestamp: Date.now(), lane: target.lane,
      conf: target.conf, type: 'START',
      allLanesWithEmergency: newEmergencies
    });
    history.stats.emergencyResponses++;
    history.stats.totalEmergencyPriority++;

    engine.activeEmergency = target;
    engine.emergencyTimer  = 0;
    engine.activeLane      = target.lane;
    engine.phase           = 'GREEN';
    engine.timer           = 99;
    engine.waitTime[target.lane] = 0;
    systemState.emergency     = true;
    systemState.emergencyLanes = newEmergencies;
    return;
  }

  // ── 5. NORMAL AI SCHEDULING ───────────────────────────────────────────────
  systemState.emergency     = false;
  systemState.emergencyLanes = [];
  engine.timer--;

  if (engine.timer > 0) return;   // not yet time to switch

  if (engine.phase === 'GREEN') {
    // Transition to yellow
    engine.phase = 'YELLOW';
    engine.timer = 2;
    pushHistory(history.signalChanges, {
      timestamp: Date.now(), lane: engine.activeLane,
      from: 'GREEN', to: 'YELLOW', mode: 'AI'
    });
    return;
  }

  // ── phase === YELLOW — pick next lane ──────────────────────────────────────
  let laneScores = [];
  let totalVehicles = 0;
  let maxVehicles   = 0;

  for (const l of LANES) {
    // Use smoothed (sliding-window median) vehicle count for stability
    const vCount   = detections[l].smoothed_vehicles || detections[l].vehicles || 0;
    const rawCount = detections[l].vehicles || 0;
    const waitTime = engine.waitTime[l]         || 0;
    const skips    = engine.consecutiveSkips[l] || 0;
    const vTypes   = detections[l].vehicle_types || {};

    totalVehicles += vCount;
    maxVehicles    = Math.max(maxVehicles, vCount);

    // ── Scoring formula ─────────────────────────────────────────────────────
    // Priority order (highest to lowest):
    //   1. Emergency vehicles (Ambulance +1000/vehicle) — handled separately above but
    //      in-lane type bonus ensures consistency
    //   2. Vehicle COUNT is the primary factor: 25 pts per vehicle
    //   3. Priority vehicle types: Bus +30, Truck +20, Autorickshaw +5
    //   4. Wait time is only a small LINEAR tiebreaker: 0.3 pts/s (max ~36pts at 120s)
    //      — This ensures a lane with 1 more vehicle always beats a lane with 0 extra
    //        vehicles no matter how long it waited (unless starvation override triggers)
    //   5. Hard starvation override at MAX_WAIT_THRESHOLD (120s) kicks in as safety net
    let score = vCount * 25;

    // Small linear wait tiebreaker — deliberately capped so it cannot override vehicle count
    const waitBonus = Math.min(waitTime * 0.3, 35); // cap at 35 pts = ~1.4 extra vehicles

    if (waitTime > MAX_WAIT_THRESHOLD * 0.8 && vCount > 0) {
      console.log(`[STARVATION WARNING] ${l.toUpperCase()} waited ${waitTime}s`);
    }
    score += waitBonus;

    // Consecutive skips bonus (lowered to reduce round-robin scheduling bias)
    score += skips * 1;

    // Priority vehicle type bonuses (increased to emphasize commercial vehicles)
    if (vTypes['Bus'])          score += vTypes['Bus']          * 30;
    if (vTypes['Truck'])        score += vTypes['Truck']        * 20;
    if (vTypes['Autorickshaw']) score += vTypes['Autorickshaw'] * 5;
    if (vTypes['Ambulance'])    score += vTypes['Ambulance']    * 1000;

    laneScores.push({
      lane: l, vehicles: vCount, rawVehicles: rawCount,
      waitTime, skips, score,
      hasPriority: (vTypes['Bus'] > 0 || vTypes['Truck'] > 0),
    });
  }

  // Sort descending by score for logging / fallback references
  laneScores.sort((a, b) => b.score - a.score);

  let selected;

  // ── Decision logic ─────────────────────────────────────────────────────────

  // A) Starvation safety override: check if any lane with vehicles has starved
  const starvingCandidates = laneScores
    .filter(ls => ls.waitTime >= MAX_WAIT_THRESHOLD && ls.vehicles > 0 && ls.lane !== engine.activeLane)
    .sort((a, b) => b.waitTime - a.waitTime);
  const starvingLane = starvingCandidates[0] || null;

  if (starvingLane) {
    selected = starvingLane;
    console.log(`[FAIRNESS OVERRIDE] ${selected.lane.toUpperCase()} starved (${selected.waitTime}s)`);
    pushHistory(history.fairnessEvents, {
      timestamp: Date.now(), lane: selected.lane,
      waitTime: selected.waitTime, type: 'STARVATION_OVERRIDE'
    });
    history.stats.fairnessOverrides++;

  // B) Normal flow: select next lane dynamically based on priority and vehicle count
  } else {
    // Candidates must:
    // 1. Have at least 1 vehicle (empty lanes shouldn't block busy lanes)
    // 2. Be a different lane (rotate turn to prevent a single lane from hogging)
    let candidates = laneScores.filter(ls => ls.lane !== engine.activeLane && ls.vehicles > 0);

    if (candidates.length === 0) {
      // If no other lane has vehicles, check if active lane has vehicles to continue serving
      const activeLaneScore = laneScores.find(ls => ls.lane === engine.activeLane);
      if (activeLaneScore && activeLaneScore.vehicles > 0) {
        selected = activeLaneScore;
        console.log(`[CONTINUE-GREEN] ${selected.lane.toUpperCase()}: ${selected.vehicles}v (no other lanes waiting)`);
      } else {
        // Fallback if another lane has vehicles but was active previously (or any other case)
        const anyLaneWithVehicles = laneScores.filter(ls => ls.vehicles > 0);
        if (anyLaneWithVehicles.length > 0) {
          anyLaneWithVehicles.sort((a, b) => b.score - a.score);
          selected = anyLaneWithVehicles[0];
          console.log(`[FALLBACK] ${selected.lane.toUpperCase()}: ${selected.vehicles}v`);
        } else {
          // If absolutely all lanes are empty, perform standard round-robin
          const idx = LANES.indexOf(engine.activeLane);
          selected = { lane: LANES[(idx + 1) % LANES.length], vehicles: 0, score: 0, waitTime: 0 };
          history.stats.emptyLaneSkips++;
          console.log(`[ROUND-ROBIN] ${selected.lane.toUpperCase()} (empty intersection)`);
        }
      }
    } else {
      // Sort candidates by score descending and pick the highest
      candidates.sort((a, b) => b.score - a.score);
      selected = candidates[0];
      console.log(`[AI-SCHEDULING] ${selected.lane.toUpperCase()}: ${selected.vehicles}v score=${selected.score.toFixed(1)}`);
    }
  }

  // ── Apply selection ────────────────────────────────────────────────────────
  engine.activeLane              = selected.lane;
  engine.phase                   = 'GREEN';
  engine.waitTime[selected.lane] = 0;
  engine.consecutiveSkips[selected.lane] = 0;

  for (const ls of laneScores) {
    if (ls.lane !== selected.lane) {
      engine.consecutiveSkips[ls.lane] = (engine.consecutiveSkips[ls.lane] || 0) + 1;
    }
  }

  // ── Dynamic green time — proportional to lane's share of total traffic ────
  const totalVehForGreen = LANES.reduce(
    (s, l) => s + (detections[l].smoothed_vehicles || detections[l].vehicles || 0), 0
  );
  let greenTime;
  if (totalVehForGreen === 0 || selected.vehicles === 0) {
    greenTime = 10;   // fallback when no vehicles detected
  } else {
    // Proportional share of a 60-second max cycle, bounded [8, 45]
    greenTime = Math.max(8, Math.min(45,
      Math.round((selected.vehicles / totalVehForGreen) * 60)
    ));
  }
  // Small bonus for priority vehicle types (bus, truck)
  if (selected.hasPriority) greenTime = Math.min(50, greenTime + 5);

  engine.timer = greenTime;
  history.stats.aiDecisions++;
  history.stats.averageGreenTime = Math.round(
    (history.stats.averageGreenTime * (history.stats.aiDecisions - 1) + greenTime) / history.stats.aiDecisions
  );

  pushHistory(history.signalChanges, {
    timestamp: Date.now(), lane: selected.lane,
    from: 'YELLOW', to: 'GREEN', mode: 'AI',
    duration: greenTime, vehicles: selected.vehicles, score: selected.score.toFixed(1)
  });

  console.log(`[GREEN] ${selected.lane.toUpperCase()}: ${greenTime}s | ${selected.vehicles}v (proportional share of ${totalVehForGreen} total)`);
}

// ─── Update external state ────────────────────────────────────────────────────
function updateExternalState() {
  for (const l of LANES) {
    systemState.lanes[l].vehicles    = detections[l].smoothed_vehicles || detections[l].vehicles || 0;
    systemState.lanes[l].vehicleTypes = detections[l].vehicle_types || {};
    systemState.lanes[l].priorityScore = detections[l].priority_score || 0;
    systemState.lanes[l].ambulances   = detections[l].ambulances || [];
    systemState.lanes[l].hasEmergency = detections[l].ambulance || false;

    if (l === engine.activeLane) {
      systemState.lanes[l].signal = engine.phase;
      systemState.lanes[l].time   = engine.timer;
    } else {
      systemState.lanes[l].signal = 'RED';
      systemState.lanes[l].time   = 0;
    }
  }
}

// ─── Record analytics history ─────────────────────────────────────────────────
function recordHistory() {
  const total = LANES.reduce((s, l) => s + (detections[l].vehicles || 0), 0);
  history.stats.totalVehiclesProcessed = total;

  pushHistory(history.vehicleCounts, {
    timestamp: Date.now(), total,
    lanes: { north: detections.north.vehicles, east: detections.east.vehicles,
             south: detections.south.vehicles, west: detections.west.vehicles }
  });
}

// ─── Main 1-second tick ───────────────────────────────────────────────────────
setInterval(() => {
  if (systemState.mode === 'STATIC') {
    handleStaticMode();
  } else {
    handleAiMode();
  }

  updateExternalState();
  recordHistory();

  io.emit('state_update', {
    north:         systemState.lanes.north,
    east:          systemState.lanes.east,
    south:         systemState.lanes.south,
    west:          systemState.lanes.west,
    mode:          systemState.mode,
    emergency:     systemState.emergency,
    emergencyLanes: systemState.emergencyLanes,
    stats:         history.stats,
    staticConfig:  staticConfig,
    priorityScores: engine.priorityScores,
    activeLane:    engine.activeLane,
  });
}, 1000);

// ─── Helper ───────────────────────────────────────────────────────────────────
function getNextLane(current) {
  return LANES[(LANES.indexOf(current) + 1) % LANES.length];
}

function calculateEfficiency() {
  const totalVehicles = history.vehicleCounts.length > 0
    ? history.vehicleCounts[history.vehicleCounts.length - 1].total : 0;
  const totalCycles   = Math.max(history.signalChanges.length / 2, 1);
  return {
    vehiclesPerCycle:    (totalVehicles / totalCycles).toFixed(2),
    emergencyEvents:     history.emergencyEvents.length,
    trafficSpikesHandled: history.stats.trafficSpikesHandled,
    emptyLaneSkips:      history.stats.emptyLaneSkips,
    fairnessOverrides:   history.stats.fairnessOverrides,
    avgGreenTime:        history.stats.averageGreenTime,
  };
}

// ─── REST Endpoints ───────────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  res.json({
    system: systemState, engine,
    staticConfig,
    history: {
      recentChanges:     history.signalChanges.slice(-10),
      recentEmergencies: history.emergencyEvents.slice(-5),
      stats:             history.stats,
    }
  });
});

app.get('/history', (req, res) => {
  res.json({
    vehicleCounts:   history.vehicleCounts.slice(-200),
    signalChanges:   history.signalChanges.slice(-100),
    emergencyEvents: history.emergencyEvents,
    stats:           history.stats,
    fairnessEvents:  history.fairnessEvents.slice(-20),
  });
});

app.get('/analytics', async (req, res) => {
  try {
    const py = await axios.get(`${PYTHON_URL}/stats`, { timeout: 3000 });
    res.json({ node: history.stats, python: py.data, system: systemState, efficiency: calculateEfficiency() });
  } catch {
    res.json({ node: history.stats, python: null, system: systemState, efficiency: calculateEfficiency(), error: 'Python unavailable' });
  }
});

// Python pushes detections here
app.post('/detections', (req, res) => {
  const { detections: d } = req.body || {};
  if (d) {
    for (const l of LANES) {
      if (!d[l]) continue;
      detections[l].vehicles          = d[l].vehicles          ?? detections[l].vehicles;
      detections[l].smoothed_vehicles = d[l].smoothed_vehicles ?? detections[l].smoothed_vehicles;
      detections[l].ambulance         = d[l].ambulance         ?? detections[l].ambulance;
      detections[l].ambulances        = d[l].ambulances        ?? detections[l].ambulances;
      detections[l].confidence        = d[l].ambulance_conf    ?? detections[l].confidence;
      detections[l].vehicle_types     = d[l].vehicle_types     ?? detections[l].vehicle_types;
      detections[l].priority_score    = d[l].priority_score    ?? detections[l].priority_score;
    }
  }
  res.json({ success: true });
});

app.post('/mode', (req, res) => {
  const { mode, staticSettings } = req.body;
  if (!['AI', 'STATIC'].includes(mode)) return res.status(400).json({ error: 'Invalid mode' });

  pushHistory(history.modeSwitches, { timestamp: Date.now(), from: systemState.mode, to: mode });
  systemState.mode = mode;

  if (staticSettings) {
    if (staticSettings.cycleTime)  staticConfig.cycleTime  = parseInt(staticSettings.cycleTime);
    if (staticSettings.yellowTime) staticConfig.yellowTime = parseInt(staticSettings.yellowTime);
  }

  // Smooth transition
  engine.phase = 'YELLOW';
  engine.timer = 2;
  res.json({ success: true, mode, staticConfig });
});

app.post('/static-config', (req, res) => {
  if (req.body.cycleTime)  staticConfig.cycleTime  = parseInt(req.body.cycleTime);
  if (req.body.yellowTime) staticConfig.yellowTime = parseInt(req.body.yellowTime);
  res.json({ success: true, config: staticConfig });
});

app.post('/emergency-clear', (req, res) => {
  engine.activeEmergency    = null;
  engine.emergencyTimer     = 0;
  systemState.emergency     = false;
  systemState.emergencyLanes = [];
  engine.phase = 'YELLOW';
  engine.timer = 2;
  res.json({ success: true, message: 'Emergency manually cleared' });
});

app.post('/force-lane', (req, res) => {
  const { lane } = req.body;
  if (!LANES.includes(lane)) return res.status(400).json({ error: 'Invalid lane' });
  engine.activeLane = lane;
  engine.phase      = 'GREEN';
  engine.timer      = 15;
  res.json({ success: true, lane });
});

server.listen(NODE_PORT, () => {
  console.log(`\n🚦 Traffic Control Node  →  http://localhost:${NODE_PORT}`);
  console.log(`   Mode: ${DEFAULT_MODE}  |  StaticCycle: ${STATIC_CYCLE}s  |  Yellow: ${YELLOW_TIME}s`);
  console.log(`   Python AI Backend: ${PYTHON_URL}\n`);
});
