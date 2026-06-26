import os
import time
import cv2
import threading
import numpy as np
import asyncio
import aiohttp
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse, StreamingResponse
import uvicorn
from ultralytics import YOLO
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor
from collections import deque

load_dotenv()

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app_: FastAPI):
    """Start background camera & sync tasks when uvicorn starts."""
    for lane in LANES:
        asyncio.create_task(process_camera_async(lane, VIDEO_PATHS[lane]))
    asyncio.create_task(sync_to_node_async())
    print(f"\n🚦 AI Detection API  →  http://0.0.0.0:{PYTHON_API_PORT}")
    print(f"   Vehicles: Person|Bicycle|Car|Motorcycle|Bus|Truck")
    print(f"   Heuristic: Autorickshaw|Two-Wheeler|Ambulance|Fire Brigade|Police\n")
    yield   # app is running
    # (cleanup on shutdown can go here if needed)

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ─── Configuration ───────────────────────────────────────────────────────────
NODE_URL              = os.getenv("NODE_URL", "http://localhost:5000/detections")
YOLO_MODEL_PATH       = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
PYTHON_API_PORT       = int(os.getenv("PYTHON_API_PORT", 8000))
CONFIDENCE_THRESHOLD  = float(os.getenv("YOLO_CONFIDENCE_THRESHOLD", 0.40))
AMBULANCE_CONFIDENCE  = float(os.getenv("AMBULANCE_CONFIDENCE", 0.65))

LANES = ["north", "east", "south", "west"]

# ─── COCO class mapping → friendly names + display colors + priority weights ─
#   0=person 1=bicycle 2=car 3=motorcycle 5=bus 6=train 7=truck
#   Also support: autorickshaw (treated as motorcycle/car-size vehicles)

VEHICLE_CLASSES = {
    0: {"name": "Person",         "color": (255, 215, 0),   "priority": 0},   # pedestrian
    1: {"name": "Bicycle",        "color": (0,   255, 255), "priority": 1},
    2: {"name": "Car",            "color": (0,   255, 0),   "priority": 2},
    3: {"name": "Motorcycle",     "color": (255, 165, 0),   "priority": 1},   # two-wheeler
    5: {"name": "Bus",            "color": (0,   0,   255), "priority": 5},
    7: {"name": "Truck",          "color": (255, 0,   255), "priority": 4},
}

# Custom label overrides (heuristic — 3-wheel shape → Autorickshaw)
AUTORICKSHAW_ASPECT = (0.9, 1.8)  # width/height ratio typical of autos

BASE_DIR    = Path(__file__).parent.resolve()
VIDEO_PATHS = {
    "north": os.getenv("NORTH_VIDEO", str(BASE_DIR / "../../traffic-system/public/north.mp4")),
    "east":  os.getenv("EAST_VIDEO",  str(BASE_DIR / "../../traffic-system/public/east.mp4")),
    "south": os.getenv("SOUTH_VIDEO", str(BASE_DIR / "../../traffic-system/public/south.mp4")),
    "west":  os.getenv("WEST_VIDEO",  str(BASE_DIR / "../../traffic-system/public/west.mp4")),
}

# ─── Sliding window history (10 frames) for stable counts ────────────────────
WINDOW_SIZE = 10

# ─── Thread-safe global state ─────────────────────────────────────────────────
latest_detections = {
    lane: {
        "vehicles": 0,
        "vehicle_types": {},
        "ambulances": [],       # list of {conf, type} — supports MULTIPLE
        "ambulance": False,
        "ambulance_conf": 0.0,
        "ambulance_type": "unknown",
        "boxes": [],
        "priority_score": 0,
        "smoothed_vehicles": 0,
        "timestamp": 0.0,
    }
    for lane in LANES
}
detection_frames  = {lane: None for lane in LANES}
# Sliding window: deque of (vehicle_count, vehicle_types_dict) per frame
slide_win_counts  = {lane: deque(maxlen=WINDOW_SIZE) for lane in LANES}
slide_win_types   = {lane: deque(maxlen=WINDOW_SIZE) for lane in LANES}
stats_lock        = threading.Lock()
global_inference_executor = ThreadPoolExecutor(max_workers=1)

print("Loading YOLO model …")
try:
    yolo_model = YOLO(YOLO_MODEL_PATH)
    print(f"✅ YOLO model loaded: {YOLO_MODEL_PATH}")
except Exception as exc:
    print(f"❌ Failed to load YOLO: {exc}")
    yolo_model = None


# ─── Emergency vehicle detection ─────────────────────────────────────────────

def detect_emergency_heuristic(box, frame, class_id):
    """
    Color-based heuristic to classify bus/truck/car as:
      ambulance, fire_brigade, police, utility, auto_rickshaw
    Returns (is_emergency: bool, score: float 0-100, em_type: str)
    """
    x1, y1, x2, y2 = map(int, box)
    h, w = frame.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)

    if x2 <= x1 or y2 <= y1:
        return False, 0.0, "unknown"

    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        return False, 0.0, "unknown"

    width, height = x2 - x1, y2 - y1
    aspect_ratio  = width / max(height, 1)
    area_ratio    = (width * height) / max(h * w, 1)

    # Shape clues
    is_van_shape    = 1.1 <= aspect_ratio <= 2.8
    is_large        = area_ratio > 0.04

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    def color_ratio(lo, hi):
        return cv2.countNonZero(cv2.inRange(hsv, np.array(lo), np.array(hi))) / max(roi.shape[0] * roi.shape[1], 1)

    red1   = color_ratio([0,  120, 80],  [10,  255, 255])
    red2   = color_ratio([160,120, 80],  [180, 255, 255])
    red    = red1 + red2
    blue   = color_ratio([100,130, 50],  [140, 255, 255])
    orange = color_ratio([10, 100, 100], [25,  255, 255])
    white  = color_ratio([0,  0,   200], [180, 30,  255])
    yellow = color_ratio([20, 100, 100], [35,  255, 255])

    score = 0.0
    em_type = "unknown"

    # ── Ambulance: red+blue light AND white body ──────────────────────────
    if is_van_shape and is_large and class_id in [5, 7, 2]:
        if red > 0.05 and blue > 0.03:
            score   = min(95, (red + blue) * 450)
            em_type = "ambulance"
        elif red > 0.10 and white > 0.20: # Stricter white check (increased to 0.20 from 0.15)
            score   = min(90, red * 450 + white * 100)
            em_type = "ambulance"
        elif red > 0.35 and white > 0.05 and class_id == 7: # Restrict Fire Brigade to Class 7 Trucks with high red ratio
            score   = min(88, red * 500)
            em_type = "fire_brigade"
        elif blue > 0.15 and class_id == 2: # Restrict Police to Class 2 Cars with high blue ratio
            score   = min(85, blue * 600)
            em_type = "police"
        elif orange > 0.12 and class_id in [5, 7]: # Restrict utility to large orange vehicles
            score   = min(72, orange * 450)
            em_type = "utility"
        elif yellow > 0.15 and is_large and class_id in [5, 7]:
            score   = min(68, yellow * 400)
            em_type = "utility"

    is_emergency = score >= AMBULANCE_CONFIDENCE * 100
    return is_emergency, min(score, 99.0), em_type


def refine_vehicle_label(class_id, box, frame):
    """
    Refine COCO labels into domain-specific categories.
    Motorcycle-class with 3-wheel aspect → Autorickshaw
    """
    if class_id != 3:
        return VEHICLE_CLASSES.get(class_id, {}).get("name", "Unknown")
    x1, y1, x2, y2 = map(int, box)
    width  = max(x2 - x1, 1)
    height = max(y2 - y1, 1)
    ar = width / height
    if AUTORICKSHAW_ASPECT[0] <= ar <= AUTORICKSHAW_ASPECT[1]:
        return "Autorickshaw"
    return "Two-Wheeler"


def calculate_priority_score(vehicle_types: dict, has_emergency: bool) -> int:
    """Weighted priority score for a lane."""
    score = 1000 if has_emergency else 0
    weights = {
        "Ambulance":    500, "Fire_Brigade": 400, "Police":       300,
        "Bus":          8,   "Truck":         5,  "Car":           2,
        "Autorickshaw": 2,   "Two-Wheeler":   1,  "Motorcycle":    1,
        "Bicycle":      1,   "Person":        0,
    }
    for vtype, count in vehicle_types.items():
        score += weights.get(vtype, 1) * count
    return score


# ─── Frame processing ─────────────────────────────────────────────────────────

def process_frame(frame, lane_id: str):
    """
    Run YOLO inference on a single frame.
    Returns (detection_result: dict, annotated_frame: ndarray)
    """
    annotated     = frame.copy()
    veh_count     = 0
    veh_types     = {}
    ambulances    = []      # list of detected emergency vehicles this frame
    boxes_list    = []

    if yolo_model is not None:
        try:
            results = yolo_model(frame, verbose=False, conf=CONFIDENCE_THRESHOLD)
        except Exception as exc:
            print(f"[{lane_id}] YOLO error: {exc}")
            results = []

        for result in results:
            if result.boxes is None:
                continue

            for box in result.boxes:
                cls_id = int(box.cls[0])
                conf   = float(box.conf[0])

                if cls_id not in VEHICLE_CLASSES:
                    continue  # skip irrelevant classes (cat, dog, etc.)

                veh_count += 1
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()

                # Refine label
                veh_label = refine_vehicle_label(cls_id, [x1, y1, x2, y2], frame)

                # Emergency detection for large vehicle classes
                is_em, em_conf, em_type = False, 0.0, "unknown"
                if cls_id in [2, 5, 7]:
                    is_em, em_conf, em_type = detect_emergency_heuristic(
                        [x1, y1, x2, y2], frame, cls_id
                    )

                if is_em:
                    veh_label = em_type.replace("_", " ").title()  # "Fire Brigade"
                    ambulances.append({"conf": em_conf, "type": em_type})
                    color = (0, 0, 255)
                else:
                    color = VEHICLE_CLASSES[cls_id]["color"]

                # Count
                veh_types[veh_label] = veh_types.get(veh_label, 0) + 1

                # Draw bounding box
                cv2.rectangle(annotated, (int(x1), int(y1)), (int(x2), int(y2)), color, 3)

                if is_em:
                    label_text = f"SOS {em_type.upper()} {em_conf:.0f}%"
                else:
                    label_text = f"{veh_label} {conf:.0%}"

                (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
                cv2.rectangle(annotated, (int(x1), int(y1) - th - 8), (int(x1) + tw, int(y1)), color, -1)
                cv2.putText(annotated, label_text,
                            (int(x1), int(y1) - 4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

                boxes_list.append({
                    "type":          veh_label,
                    "confidence":    round(conf, 2),
                    "box":           [int(x1), int(y1), int(x2), int(y2)],
                    "is_emergency":  is_em,
                    "emergency_conf": round(em_conf, 1) if is_em else 0,
                    "emergency_type": em_type if is_em else "",
                })

    # Sort ambulances by confidence desc
    ambulances.sort(key=lambda a: a["conf"], reverse=True)
    has_emergency  = len(ambulances) > 0
    top_ambul_conf = ambulances[0]["conf"] if ambulances else 0.0
    top_ambul_type = ambulances[0]["type"] if ambulances else "unknown"
    priority_score = calculate_priority_score(veh_types, has_emergency)

    # ── Overlay HUD ─────────────────────────────────────────────────────────
    overlay_h = 160 if has_emergency else 110
    overlay   = annotated[:overlay_h, :max(annotated.shape[1], 400)].copy()
    cv2.rectangle(annotated, (0, 0), (annotated.shape[1], overlay_h), (0, 0, 0), -1)
    annotated[:overlay_h, :annotated.shape[1]] = (
        cv2.addWeighted(overlay, 0.3, np.zeros_like(overlay), 0, 0)
    )

    cv2.putText(annotated, f"LANE: {lane_id.upper()}",
                (10, 28),  cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
    cv2.putText(annotated, f"Vehicles: {veh_count}",
                (10, 58),  cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 120), 2)
    cv2.putText(annotated, f"Priority: {priority_score}",
                (10, 88),  cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 230, 0), 2)

    if has_emergency:
        flash    = int(time.time() * 4) % 2 == 0
        em_color = (0, 0, 255) if flash else (0, 60, 200)
        label    = " | ".join(f"SOS {a['type'].upper()} {a['conf']:.0f}%" for a in ambulances[:3])
        cv2.putText(annotated, label,
                    (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.7, em_color, 2)
        if flash:
            cv2.rectangle(annotated, (2, 2), (annotated.shape[1]-2, overlay_h-2), (0, 0, 255), 3)

    ts = time.strftime("%H:%M:%S")
    cv2.putText(annotated, ts,
                (annotated.shape[1] - 90, annotated.shape[0] - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)

    return {
        "vehicles":       veh_count,
        "vehicle_types":  veh_types,
        "ambulances":     ambulances,        # multiple
        "ambulance":      has_emergency,
        "ambulance_conf": round(top_ambul_conf, 1),
        "ambulance_type": top_ambul_type,
        "boxes":          boxes_list,
        "priority_score": priority_score,
    }, annotated


# ─── Per-lane async camera loop ───────────────────────────────────────────────

async def process_camera_async(lane_id: str, video_path: str):
    print(f"[{lane_id.upper()}] Starting → {video_path}")
    cap = None
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise IOError(f"Cannot open: {video_path}")
    except Exception as exc:
        print(f"[{lane_id.upper()}] ⚠ Video error: {exc} — using blank feed")
        cap = None

    frame_idx        = 0
    last_proc_time   = 0.0
    loop             = asyncio.get_event_loop()
    MIN_PROC_INTERVAL = 0.1   # max ~10 fps inference

    while True:
        if cap:
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                await asyncio.sleep(0.01)
                continue
        else:
            await asyncio.sleep(0.033)
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(frame, f"{lane_id.upper()} — NO FEED",
                        (140, 240), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (120, 120, 120), 2)

        frame_idx += 1
        now = time.time()

        if now - last_proc_time < MIN_PROC_INTERVAL:
            if frame_idx % 3 != 0:
                await asyncio.sleep(0.005)
                continue

        detection_result, annotated_frame = await loop.run_in_executor(
            global_inference_executor, process_frame, frame, lane_id
        )
        last_proc_time = time.time()

        with stats_lock:
            # ── Sliding window update ────────────────────────────────────
            slide_win_counts[lane_id].append(detection_result["vehicles"])
            slide_win_types[lane_id].append(detection_result["vehicle_types"])

            # Smoothed vehicle count (median over window)
            counts  = list(slide_win_counts[lane_id])
            smoothed = int(sorted(counts)[len(counts) // 2]) if counts else 0

            # Aggregate vehicle type counts over the window
            agg_types: dict = {}
            for td in slide_win_types[lane_id]:
                for vt, cnt in td.items():
                    agg_types[vt] = agg_types.get(vt, 0) + cnt
            # Average across window
            win_len = len(slide_win_types[lane_id])
            agg_types = {k: max(1, round(v / win_len)) for k, v in agg_types.items()}

            latest_detections[lane_id] = {
                **detection_result,
                "smoothed_vehicles": smoothed,
                "agg_vehicle_types": agg_types,   # stable type counts
                "timestamp": time.time(),
            }
            detection_frames[lane_id] = annotated_frame

        await asyncio.sleep(0.01)


# ─── Sync to Node.js ─────────────────────────────────────────────────────────

async def sync_to_node_async():
    async with aiohttp.ClientSession() as session:
        while True:
            await asyncio.sleep(1)
            try:
                with stats_lock:
                    payload = {"detections": dict(latest_detections), "timestamp": time.time()}

                async with session.post(
                    NODE_URL, json=payload,
                    timeout=aiohttp.ClientTimeout(total=2)
                ) as resp:
                    if resp.status == 200:
                        d = latest_detections
                        ems = [l for l in LANES if d[l].get("ambulance")]
                        print(
                            f"Sync | N:{d['north']['vehicles']} E:{d['east']['vehicles']} "
                            f"S:{d['south']['vehicles']} W:{d['west']['vehicles']} "
                            f"| Emerg:{ems if ems else 'None'}"
                        )
            except Exception:
                pass     # Node not ready yet — silent retry


# ─── FastAPI Endpoints ────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "status":        "AI Traffic Detection API",
        "model":         "YOLOv8",
        "lanes":         LANES,
        "window_size":   WINDOW_SIZE,
        "features":      [
            "multi_vehicle_detection",
            "autorickshaw_heuristic",
            "multi_emergency_detection",
            "sliding_window_smoothing",
            "priority_scoring",
        ],
    }

@app.get("/health")
def health_check():
    return {
        "status":       "healthy",
        "model_loaded": yolo_model is not None,
        "lanes_active": {lane: detection_frames[lane] is not None for lane in LANES},
        "timestamp":    time.time(),
    }

@app.get("/detections")
def get_detections():
    with stats_lock:
        return {k: dict(v) for k, v in latest_detections.items()}

@app.get("/stats")
def get_stats():
    with stats_lock:
        total     = sum(d["vehicles"] for d in latest_detections.values())
        max_lane  = max(latest_detections.items(), key=lambda x: x[1]["vehicles"])
        em_lanes  = [l for l in LANES if latest_detections[l]["ambulance"]]
        return {
            "total_vehicles":      total,
            "max_vehicles_lane":   max_lane[0],
            "max_vehicles_count":  max_lane[1]["vehicles"],
            "emergency_active":    len(em_lanes) > 0,
            "emergency_lanes":     em_lanes,
            "lanes": {
                lane: {
                    "vehicles":         data["vehicles"],
                    "smoothed_vehicles": data.get("smoothed_vehicles", data["vehicles"]),
                    "types":            data["vehicle_types"],
                    "agg_types":        data.get("agg_vehicle_types", {}),
                    "ambulance":        data["ambulance"],
                    "ambulance_type":   data.get("ambulance_type", "unknown"),
                    "ambulances":       data.get("ambulances", []),
                    "priority_score":   data["priority_score"],
                }
                for lane, data in latest_detections.items()
            },
            "timestamp": time.time(),
        }

@app.get("/frame/{lane_id}")
def get_frame(lane_id: str):
    if lane_id not in LANES:
        return JSONResponse({"error": "Invalid lane"}, status_code=400)
    with stats_lock:
        frame = detection_frames[lane_id]
    if frame is None:
        return JSONResponse({"error": "No frame yet"}, status_code=404)
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
    return Response(content=buf.tobytes(), media_type="image/jpeg")

@app.get("/stream/{lane_id}")
async def stream_lane(lane_id: str):
    """MJPEG stream for browser <img> tag."""
    if lane_id not in LANES:
        return JSONResponse({"error": "Invalid lane"}, status_code=400)

    async def generate():
        while True:
            with stats_lock:
                frame = detection_frames[lane_id]
            if frame is not None:
                _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 72])
                yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                       + buf.tobytes() + b"\r\n")
            await asyncio.sleep(0.1)

    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")


# ─── Entry point ─────────────────────────────────────────────────────────────
# Camera tasks are started via the lifespan() handler above.
# Run directly with:  python main.py  OR  uvicorn main:app --reload

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=PYTHON_API_PORT, reload=False, log_level="warning")
